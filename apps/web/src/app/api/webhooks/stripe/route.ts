/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler
 * Processes subscription lifecycle events, payment events, and other Stripe notifications
 *
 * IMPORTANT: This endpoint must be publicly accessible (no authentication)
 * Stripe webhook signatures provide cryptographic verification
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

  if (!signature) {
    console.error('[Stripe Webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  if (!WEBHOOK_CONFIG.secret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event

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

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`)

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
      processed: false,
    })

    // Handle event by type
    switch (event.type) {
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
      .set({ processed: true, processedAt: new Date() })
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
          processed: true,
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
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription, db: Awaited<ReturnType<typeof getDb>>) {
  const orgId = subscription.metadata.orgId

  if (!orgId) {
    console.error('[Stripe Webhook] No orgId in subscription metadata')
    return
  }

  const tier = (subscription.metadata.tier as any) || 'starter'

  // Update subscription in database
  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
    .limit(1)

  if (existingSubscription) {
    // Update existing subscription
    await db
      .update(subscriptions)
      .set({
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
  }

  // Update organization
  await db
    .update(organizations)
    .set({
      subscriptionStatus: subscription.status as any,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    })
    .where(eq(organizations.id, orgId))

  console.log(`[Stripe Webhook] Updated subscription for org ${orgId}, status: ${subscription.status}`)
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
  const subscriptionId = invoice.subscription

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
  const subscriptionId = invoice.subscription

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
