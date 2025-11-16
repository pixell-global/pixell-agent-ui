/**
 * Subscription Manager
 *
 * Handles subscription lifecycle: create, update, cancel, retrieve
 */

import { db } from '@pixell/db-mysql'
import { subscriptions, organizations, creditBalances } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'
import { stripe } from './stripe-config'
import { getStripePriceId, type SubscriptionTier, calculatePlanCredits } from './stripe-config'
import { initializeCreditBalance, resetCreditsForNewPeriod } from './credit-manager'
import { v4 as uuidv4 } from 'uuid'
import Stripe from 'stripe'

export interface CreateSubscriptionParams {
  orgId: string
  orgName: string
  userEmail: string
  tier: SubscriptionTier
  trialDays?: number
}

export interface UpdateSubscriptionParams {
  orgId: string
  newTier: SubscriptionTier
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}

export interface CancelSubscriptionParams {
  orgId: string
  cancelAtPeriodEnd: boolean
  reason?: string
}

/**
 * Get subscription for organization
 */
export async function getSubscription(orgId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1)

  return subscription || null
}

/**
 * Create a new subscription
 */
export async function createSubscription(params: CreateSubscriptionParams) {
  const { orgId, orgName, userEmail, tier, trialDays = 7 } = params

  // Get organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    throw new Error('Organization not found')
  }

  // Check if subscription already exists
  const existingSubscription = await getSubscription(orgId)
  if (existingSubscription) {
    throw new Error('Subscription already exists for this organization')
  }

  // Free tier: create subscription record without Stripe
  if (tier === 'free') {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const subscriptionId = uuidv4()

    // Create subscription record
    await db.insert(subscriptions).values({
      id: subscriptionId,
      orgId,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCustomerId: org.stripeCustomerId || null,
      planTier: tier,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      endedAt: null,
    })

    // Initialize credit balance
    await initializeCreditBalance(orgId, tier, now, periodEnd)

    // Update organization
    await db
      .update(organizations)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: 'active',
        trialEndsAt: null,
      })
      .where(eq(organizations.id, orgId))

    return {
      subscriptionId,
      status: 'active' as const,
      tier,
    }
  }

  // Paid tier: create Stripe customer and subscription
  let customerId = org.stripeCustomerId

  // Create Stripe customer if doesn't exist
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      name: orgName,
      metadata: {
        orgId,
      },
    })
    customerId = customer.id

    // Update organization with customer ID
    await db
      .update(organizations)
      .set({
        stripeCustomerId: customerId,
      })
      .where(eq(organizations.id, orgId))
  }

  // Get Stripe price ID
  const priceId = getStripePriceId(tier)
  if (!priceId) {
    throw new Error(`No Stripe price configured for tier: ${tier}`)
  }

  // Calculate trial end
  const trialEnd = Math.floor(Date.now() / 1000) + trialDays * 24 * 60 * 60

  // Create Stripe subscription
  const stripeSubscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_end: trialEnd,
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      orgId,
      tier,
    },
  })

  const subscriptionId = uuidv4()

  // Create subscription record
  await db.insert(subscriptions).values({
    id: subscriptionId,
    orgId,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    stripeCustomerId: customerId,
    planTier: tier,
    status: stripeSubscription.status as any,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
    endedAt: stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000) : null,
  })

  // Initialize credit balance
  await initializeCreditBalance(
    orgId,
    tier,
    new Date(stripeSubscription.current_period_start * 1000),
    new Date(stripeSubscription.current_period_end * 1000)
  )

  // Update organization
  await db
    .update(organizations)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: stripeSubscription.status as any,
      trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
    })
    .where(eq(organizations.id, orgId))

  // Get client secret for payment confirmation
  const invoice = stripeSubscription.latest_invoice as Stripe.Invoice | null
  const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null
  const clientSecret = paymentIntent?.client_secret || null

  return {
    subscriptionId,
    stripeSubscriptionId: stripeSubscription.id,
    status: stripeSubscription.status,
    tier,
    clientSecret,
  }
}

/**
 * Update subscription to a new tier
 */
export async function updateSubscription(params: UpdateSubscriptionParams) {
  const { orgId, newTier, prorationBehavior = 'create_prorations' } = params

  const subscription = await getSubscription(orgId)
  if (!subscription) {
    throw new Error('No subscription found')
  }

  // If downgrading to free, cancel Stripe subscription
  if (newTier === 'free') {
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
        prorate: true,
      })
    }

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    // Update subscription to free
    await db
      .update(subscriptions)
      .set({
        planTier: newTier,
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .where(eq(subscriptions.orgId, orgId))

    // Reset credits for free tier
    await resetCreditsForNewPeriod(orgId, newTier, now, periodEnd)

    // Update organization
    await db
      .update(organizations)
      .set({
        subscriptionTier: newTier,
        subscriptionStatus: 'active',
      })
      .where(eq(organizations.id, orgId))

    return {
      success: true,
      tier: newTier,
    }
  }

  // Upgrading or changing paid tier
  if (!subscription.stripeSubscriptionId) {
    throw new Error('Cannot upgrade from free tier. Please create a new subscription.')
  }

  const newPriceId = getStripePriceId(newTier)
  if (!newPriceId) {
    throw new Error(`No Stripe price configured for tier: ${newTier}`)
  }

  // Update Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)

  const updatedSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [
      {
        id: stripeSubscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: prorationBehavior,
    metadata: {
      ...stripeSubscription.metadata,
      tier: newTier,
    },
  })

  // Update subscription record
  await db
    .update(subscriptions)
    .set({
      planTier: newTier,
      stripePriceId: newPriceId,
      status: updatedSubscription.status as any,
    })
    .where(eq(subscriptions.orgId, orgId))

  // Update credit balance for new tier (keep current period)
  const credits = calculatePlanCredits(newTier)
  await db
    .update(creditBalances)
    .set({
      includedSmall: credits.includedSmall,
      includedMedium: credits.includedMedium,
      includedLarge: credits.includedLarge,
      includedXl: credits.includedXl,
    })
    .where(eq(creditBalances.orgId, orgId))

  // Update organization
  await db
    .update(organizations)
    .set({
      subscriptionTier: newTier,
      subscriptionStatus: updatedSubscription.status as any,
    })
    .where(eq(organizations.id, orgId))

  return {
    success: true,
    tier: newTier,
    status: updatedSubscription.status,
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(params: CancelSubscriptionParams) {
  const { orgId, cancelAtPeriodEnd, reason } = params

  const subscription = await getSubscription(orgId)
  if (!subscription) {
    throw new Error('No subscription found')
  }

  if (!subscription.stripeSubscriptionId) {
    // Free tier, just mark as canceled
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        endedAt: new Date(),
      })
      .where(eq(subscriptions.orgId, orgId))

    await db
      .update(organizations)
      .set({
        subscriptionStatus: 'canceled',
      })
      .where(eq(organizations.id, orgId))

    return { success: true }
  }

  // Cancel Stripe subscription
  if (cancelAtPeriodEnd) {
    const updatedSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: reason ? { comment: reason } : undefined,
    })

    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        status: updatedSubscription.status as any,
      })
      .where(eq(subscriptions.orgId, orgId))
  } else {
    const canceledSubscription = await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
      prorate: true,
    })

    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        endedAt: new Date(canceledSubscription.canceled_at! * 1000),
      })
      .where(eq(subscriptions.orgId, orgId))

    await db
      .update(organizations)
      .set({
        subscriptionStatus: 'canceled',
      })
      .where(eq(organizations.id, orgId))
  }

  return { success: true }
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(orgId: string) {
  const subscription = await getSubscription(orgId)
  if (!subscription) {
    throw new Error('No subscription found')
  }

  if (!subscription.stripeSubscriptionId) {
    throw new Error('Cannot reactivate free tier subscription')
  }

  if (!subscription.cancelAtPeriodEnd) {
    throw new Error('Subscription is not scheduled for cancellation')
  }

  // Remove cancellation from Stripe
  const updatedSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
  })

  // Update subscription record
  await db
    .update(subscriptions)
    .set({
      cancelAtPeriodEnd: false,
      canceledAt: null,
      status: updatedSubscription.status as any,
    })
    .where(eq(subscriptions.orgId, orgId))

  return { success: true }
}
