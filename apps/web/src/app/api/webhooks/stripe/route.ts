/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler - PRIMARY database synchronization mechanism
 * Processes subscription lifecycle events, payment events, and other Stripe notifications
 *
 * IMPORTANT: This endpoint must be publicly accessible (no authentication)
 * Stripe webhook signatures provide cryptographic verification
 *
 * =============================================================================
 * DATABASE SYNCHRONIZATION ARCHITECTURE (For AI Agents)
 * =============================================================================
 *
 * STRIPE IS THE SINGLE SOURCE OF TRUTH (SSoT) FOR ALL SUBSCRIPTION DATA
 *
 * Our database (subscriptions, organizations tables) is a READ-OPTIMIZED CACHE
 * that must stay synchronized with Stripe. We use a dual-sync strategy:
 *
 * 1. PRIMARY SYNC: This webhook handler (real-time)
 *    - Receives events from Stripe when subscription state changes
 *    - Immediately updates database to match Stripe state
 *    - Events: checkout.session.completed, customer.subscription.*, invoice.*
 *
 * 2. BACKUP SYNC: Lambda reconciliation job (weekly - Sundays 3am UTC)
 *    - Location: packages/workers/subscription-reconciliation/
 *    - Catches missed webhooks (network failures, downtime, bugs)
 *    - Reconciles drift from manual Stripe dashboard changes
 *    - Ensures eventual consistency
 *
 * CONFLICT RESOLUTION: Stripe ALWAYS wins
 *    - Never update Stripe based on database state (except user-initiated actions)
 *    - If webhook updates differ from DB, Stripe data overwrites DB data
 *    - Database is rebuilt from Stripe on conflicts
 *
 * Related Files:
 *    - Lambda reconciliation: packages/workers/subscription-reconciliation/
 *    - Database schema: packages/db-mysql/schema.ts
 *    - Architecture docs: BILLING_SYSTEM_ARCHITECTURE.md
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe, WEBHOOK_CONFIG } from '@/lib/billing/stripe-config'
import { getDb } from '@pixell/db-mysql'
import { subscriptions, organizations, webhookEvents, creditPurchases } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'
import { resetCreditsForNewPeriod, addTopupCredits } from '@/lib/billing/credit-manager'
import Stripe from 'stripe'

/**
 * Disable body parsing - Stripe requires raw body for signature verification
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Allow bypassing signature verification in local development
  const isDevelopment = process.env.NODE_ENV === 'development'
  const skipSignatureVerification = isDevelopment && process.env.STRIPE_SKIP_SIGNATURE_CHECK === 'true'

  let event: Stripe.Event

  if (skipSignatureVerification) {
    // Development mode: Parse event directly without signature verification
    console.warn('[Stripe Webhook] ⚠️  SKIPPING signature verification (development mode)')
    try {
      event = JSON.parse(body)
    } catch (error) {
      console.error('[Stripe Webhook] Failed to parse webhook body:', error)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  } else {
    // Production mode: Verify signature
    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    if (!WEBHOOK_CONFIG.secret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_CONFIG.secret)
    } catch (error) {
      console.error('[Stripe Webhook] Signature verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`) // v2

  try {
    const db = await getDb()

    // Check if we've already processed this event (idempotency)
    const [existingEvent] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.stripeEventId, event.id))
      .limit(1)

    if (existingEvent) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`)
      return NextResponse.json({ received: true, cached: true })
    }

    // Log webhook event
    await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as any,
      processedAt: null,
    })

    // Handle event by type
    switch (event.type) {
      // Checkout completion
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, db)
        break

      // Subscription lifecycle events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, db)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription, db)
        break

      // Payment events
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, db)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, db)
        break

      // Payment intent events (for one-time purchases like credits)
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, db)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, db)
        break

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    // Mark event as processed
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.stripeEventId, event.id))

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)

    try {
      const db = await getDb()
      // Mark event as failed
      await db
        .update(webhookEvents)
        .set({
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(webhookEvents.stripeEventId, event.id))
    } catch (dbError) {
      console.error('[Stripe Webhook] Failed to update webhook event:', dbError)
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle checkout session completed
 * Creates the initial subscription record when checkout is completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, db: Awaited<ReturnType<typeof getDb>>) {
  // Only handle subscription checkouts
  if (session.mode !== 'subscription') {
    console.log('[Stripe Webhook] Checkout session is not for subscription, skipping')
    return
  }

  const orgId = session.metadata?.orgId
  const tier = session.metadata?.tier

  if (!orgId) {
    console.error('[Stripe Webhook] No orgId in checkout session metadata')
    return
  }

  if (!tier) {
    console.error('[Stripe Webhook] No tier in checkout session metadata')
    return
  }

  const subscriptionId = session.subscription as string

  if (!subscriptionId) {
    console.error('[Stripe Webhook] No subscription ID in checkout session')
    return
  }

  console.log(`[Stripe Webhook] Checkout completed for org ${orgId}, tier: ${tier}, subscription: ${subscriptionId}`)

  // Fetch the full subscription object from Stripe to get all details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Create or update subscription record in database
  const now = new Date()
  const sub = subscription as any // Cast to access all fields safely
  const currentPeriodStart = new Date(sub.current_period_start * 1000)
  const currentPeriodEnd = new Date(sub.current_period_end * 1000)

  // Check if subscription already exists for this org
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1)

  if (existingSub) {
    // Update existing subscription
    await db
      .update(subscriptions)
      .set({
        planTier: tier as any,
        status: sub.status as any,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: sub.items?.data?.[0]?.price?.id || null,
        stripeCustomerId: sub.customer as string,
        currentPeriodStart,
        currentPeriodEnd,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
        updatedAt: now,
      })
      .where(eq(subscriptions.orgId, orgId))
  } else {
    // Create new subscription
    await db.insert(subscriptions).values({
      orgId,
      planTier: tier as any,
      status: sub.status as any,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: sub.items?.data?.[0]?.price?.id || null,
      stripeCustomerId: sub.customer as string,
      currentPeriodStart,
      currentPeriodEnd,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Update organization
  await db
    .update(organizations)
    .set({
      subscriptionTier: tier as any,
      subscriptionStatus: sub.status as any,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    })
    .where(eq(organizations.id, orgId))

  // Reset credits for the new plan tier
  await resetCreditsForNewPeriod(orgId, tier as any, currentPeriodStart, currentPeriodEnd)

  console.log(`[Stripe Webhook] Created subscription record for org ${orgId}, tier: ${tier}`)
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription, db: Awaited<ReturnType<typeof getDb>>) {
  const orgId = subscription.metadata.orgId

  if (!orgId) {
    console.error('[Stripe Webhook] No orgId in subscription metadata')
    return
  }

  const tier = (subscription.metadata.tier as any) || 'starter'
  const newPriceId = subscription.items.data[0]?.price.id || null

  // Update subscription in database
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
    .limit(1)

  if (existingSubscription) {
    // Update existing subscription - including tier and price
    await db
      .update(subscriptions)
      .set({
        planTier: tier as any,
        stripePriceId: newPriceId,
        status: subscription.status as any,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        trialEnd: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : null,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        canceledAt: (subscription as any).canceled_at ? new Date((subscription as any).canceled_at * 1000) : null,
        endedAt: (subscription as any).ended_at ? new Date((subscription as any).ended_at * 1000) : null,
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))

    console.log(`[Stripe Webhook] Updated subscription for org ${orgId}, tier: ${tier}, status: ${subscription.status}`)
  }

  // Update organization - including tier
  await db
    .update(organizations)
    .set({
      subscriptionTier: tier as any,
      subscriptionStatus: subscription.status as any,
      trialEndsAt: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : null,
    })
    .where(eq(organizations.id, orgId))

  console.log(`[Stripe Webhook] Updated organization ${orgId} subscription, tier: ${tier}, status: ${subscription.status}`)
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, db: Awaited<ReturnType<typeof getDb>>) {
  const orgId = subscription.metadata.orgId

  if (!orgId) {
    console.error('[Stripe Webhook] No orgId in subscription metadata')
    return
  }

  // Update subscription
  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))

  // Downgrade organization to free tier
  await db
    .update(organizations)
    .set({
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
    })
    .where(eq(organizations.id, orgId))

  // Reset credits to free tier
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await resetCreditsForNewPeriod(orgId, 'free', now, periodEnd)

  console.log(`[Stripe Webhook] Subscription deleted for org ${orgId}, downgraded to free tier`)
}

/**
 * Handle trial will end (3 days before trial expires)
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription, db: Awaited<ReturnType<typeof getDb>>) {
  const orgId = subscription.metadata.orgId

  if (!orgId) {
    console.error('[Stripe Webhook] No orgId in subscription metadata')
    return
  }

  // TODO: Send "trial ending soon" email
  console.log(`[Stripe Webhook] Trial ending soon for org ${orgId}`)
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, db: Awaited<ReturnType<typeof getDb>>) {
  const subscriptionId = (invoice as any).subscription

  if (!subscriptionId || typeof subscriptionId !== 'string') {
    console.log('[Stripe Webhook] Invoice not associated with subscription, skipping')
    return
  }

  // Get subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1)

  if (!subscription) {
    console.error('[Stripe Webhook] Subscription not found:', subscriptionId)
    return
  }

  // Check for scheduled downgrade in Stripe metadata
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  const scheduledTier = stripeSubscription.metadata.scheduled_tier

  if (scheduledTier) {
    console.log(`[Stripe Webhook] Applying scheduled downgrade to ${scheduledTier} for org ${subscription.orgId}`)

    // Get the price ID for the new tier
    const { getStripePriceId } = await import('@/lib/billing/stripe-config')
    const newPriceId = getStripePriceId(scheduledTier as any)

    if (newPriceId) {
      // Update the Stripe subscription to the new tier
      await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        metadata: {
          ...stripeSubscription.metadata,
          tier: scheduledTier,
          scheduled_tier: '', // Clear the scheduled downgrade
        },
        proration_behavior: 'none', // No proration for downgrades at period end
      })

      // Update database
      await db
        .update(subscriptions)
        .set({
          planTier: scheduledTier as any,
          stripePriceId: newPriceId,
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))

      await db
        .update(organizations)
        .set({
          subscriptionTier: scheduledTier as any,
        })
        .where(eq(organizations.id, subscription.orgId))

      // Reset credits for new tier
      const { resetCreditsForNewPeriod } = await import('@/lib/billing/credit-manager')
      await resetCreditsForNewPeriod(
        subscription.orgId,
        scheduledTier as any,
        new Date((stripeSubscription as any).current_period_start * 1000),
        new Date((stripeSubscription as any).current_period_end * 1000)
      )

      console.log(`[Stripe Webhook] Successfully downgraded org ${subscription.orgId} to ${scheduledTier}`)
    }
  }

  // If subscription was past_due, mark as active
  if (subscription.status === 'past_due') {
    await db
      .update(subscriptions)
      .set({
        status: 'active',
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))

    await db
      .update(organizations)
      .set({
        subscriptionStatus: 'active',
      })
      .where(eq(organizations.id, subscription.orgId))
  }

  console.log(`[Stripe Webhook] Invoice paid for subscription ${subscriptionId}`)
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, db: Awaited<ReturnType<typeof getDb>>) {
  const subscriptionId = (invoice as any).subscription

  if (!subscriptionId || typeof subscriptionId !== 'string') {
    console.log('[Stripe Webhook] Invoice not associated with subscription, skipping')
    return
  }

  // Get subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1)

  if (!subscription) {
    console.error('[Stripe Webhook] Subscription not found:', subscriptionId)
    return
  }

  // Mark subscription as past_due
  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))

  await db
    .update(organizations)
    .set({
      subscriptionStatus: 'past_due',
    })
    .where(eq(organizations.id, subscription.orgId))

  // TODO: Send "payment failed" email
  console.log(`[Stripe Webhook] Invoice payment failed for subscription ${subscriptionId}`)
}

/**
 * Handle payment intent succeeded (credit purchases)
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, db: Awaited<ReturnType<typeof getDb>>) {
  // Check if this is a credit purchase
  const purchaseId = paymentIntent.metadata.purchaseId

  if (!purchaseId) {
    console.log('[Stripe Webhook] PaymentIntent not associated with credit purchase, skipping')
    return
  }

  // Update credit purchase
  const [purchase] = await db
    .select()
    .from(creditPurchases)
    .where(eq(creditPurchases.stripePaymentIntentId, paymentIntent.id))
    .limit(1)

  if (!purchase) {
    console.error('[Stripe Webhook] Credit purchase not found:', paymentIntent.id)
    return
  }

  // Mark purchase as succeeded
  await db
    .update(creditPurchases)
    .set({
      status: 'succeeded',
      completedAt: new Date(),
    })
    .where(eq(creditPurchases.id, purchaseId))

  // Add credits to organization
  await addTopupCredits(purchase.orgId, purchase.creditsAmount)

  console.log(`[Stripe Webhook] Credit purchase succeeded: ${purchase.creditsAmount} credits for org ${purchase.orgId}`)
}

/**
 * Handle payment intent failed (credit purchases)
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, db: Awaited<ReturnType<typeof getDb>>) {
  const purchaseId = paymentIntent.metadata.purchaseId

  if (!purchaseId) {
    console.log('[Stripe Webhook] PaymentIntent not associated with credit purchase, skipping')
    return
  }

  // Update credit purchase
  await db
    .update(creditPurchases)
    .set({
      status: 'failed',
      completedAt: new Date(),
    })
    .where(eq(creditPurchases.stripePaymentIntentId, paymentIntent.id))

  console.log(`[Stripe Webhook] Credit purchase failed: ${paymentIntent.id}`)
}
