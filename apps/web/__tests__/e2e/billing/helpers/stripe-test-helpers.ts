/**
 * Stripe Test Mode Helpers
 *
 * Provides functions for creating and managing Stripe resources in test mode.
 * Uses real Stripe API calls with test mode keys.
 *
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: sk_test_... (Stripe test mode secret key)
 * - STRIPE_PRICE_ID_STARTER: Test mode price ID for Starter tier
 * - STRIPE_PRICE_ID_PRO: Test mode price ID for Pro tier
 * - STRIPE_PRICE_ID_MAX: Test mode price ID for Max tier
 */

import Stripe from 'stripe'

// Initialize Stripe with test mode key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  console.warn('[stripe-test-helpers] STRIPE_SECRET_KEY not set - Stripe tests will be skipped')
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null

// Price IDs from environment
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER || '',
  pro: process.env.STRIPE_PRICE_ID_PRO || '',
  max: process.env.STRIPE_PRICE_ID_MAX || '',
}

// Test card payment method tokens
export const TEST_PAYMENT_METHODS = {
  visa: 'pm_card_visa', // 4242424242424242 - always succeeds
  declined: 'pm_card_chargeDeclined', // 4000000000000002 - always fails
  requiresAuth: 'pm_card_authenticationRequired', // 4000002500003155 - requires 3DS
}

/**
 * Check if Stripe is configured for testing
 */
export function isStripeConfigured(): boolean {
  return !!stripe && !!STRIPE_PRICE_IDS.starter
}

/**
 * Create a Stripe test customer
 */
export async function createTestCustomer(
  email: string,
  orgId: string,
  testClockId?: string
): Promise<Stripe.Customer> {
  if (!stripe) throw new Error('Stripe not configured')

  const params: Stripe.CustomerCreateParams = {
    email,
    name: `Test Customer ${Date.now()}`,
    metadata: {
      orgId,
      testUser: 'true',
      createdAt: new Date().toISOString(),
    },
  }

  // Attach to test clock if provided (for time simulation)
  if (testClockId) {
    params.test_clock = testClockId
  }

  return stripe.customers.create(params)
}

/**
 * Attach a test payment method to a customer and set as default
 */
export async function attachTestPaymentMethod(
  customerId: string,
  paymentMethod: string = TEST_PAYMENT_METHODS.visa
): Promise<Stripe.PaymentMethod> {
  if (!stripe) throw new Error('Stripe not configured')

  // Attach the payment method
  const pm = await stripe.paymentMethods.attach(paymentMethod, {
    customer: customerId,
  })

  // Set as default for invoices
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: pm.id,
    },
  })

  return pm
}

/**
 * Create a subscription for a customer
 *
 * By default, this confirms payment immediately using the attached payment method.
 * For test mode, this means the subscription will be active immediately.
 */
export async function createTestSubscription(
  customerId: string,
  tier: 'starter' | 'pro' | 'max',
  orgId: string,
  options: {
    trialDays?: number
  } = {}
): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe not configured')

  const priceId = STRIPE_PRICE_IDS[tier]
  if (!priceId) {
    throw new Error(`No Stripe price configured for tier: ${tier}`)
  }

  // Get the customer's default payment method
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method

  if (!defaultPaymentMethod) {
    throw new Error('Customer has no default payment method. Call attachTestPaymentMethod first.')
  }

  const params: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: defaultPaymentMethod as string,
    metadata: {
      orgId,
      tier,
      testSubscription: 'true',
    },
  }

  // Add trial if specified
  if (options.trialDays && options.trialDays > 0) {
    params.trial_end = Math.floor(Date.now() / 1000) + options.trialDays * 24 * 60 * 60
  }

  return stripe.subscriptions.create(params)
}

/**
 * Update subscription to a new tier
 */
export async function updateSubscriptionTier(
  subscriptionId: string,
  newTier: 'starter' | 'pro' | 'max',
  options: {
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
  } = {}
): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe not configured')

  const newPriceId = STRIPE_PRICE_IDS[newTier]
  if (!newPriceId) {
    throw new Error(`No Stripe price configured for tier: ${newTier}`)
  }

  // Get current subscription to find the item ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const itemId = subscription.items.data[0]?.id

  if (!itemId) {
    throw new Error('Subscription has no items')
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: itemId,
        price: newPriceId,
      },
    ],
    proration_behavior: options.prorationBehavior || 'create_prorations',
    metadata: {
      ...subscription.metadata,
      tier: newTier,
    },
  })
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  options: {
    atPeriodEnd?: boolean
    reason?: string
  } = {}
): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe not configured')

  if (options.atPeriodEnd) {
    // Schedule cancellation at period end
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: options.reason
        ? { comment: options.reason }
        : undefined,
    })
  } else {
    // Cancel immediately
    return stripe.subscriptions.cancel(subscriptionId, {
      prorate: true,
    })
  }
}

/**
 * Reactivate a subscription scheduled for cancellation
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe not configured')

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}

/**
 * Create a test clock for time simulation
 * Test clocks allow advancing time to test billing cycles
 */
export async function createTestClock(
  frozenTime?: number
): Promise<Stripe.TestHelpers.TestClock> {
  if (!stripe) throw new Error('Stripe not configured')

  return stripe.testHelpers.testClocks.create({
    frozen_time: frozenTime || Math.floor(Date.now() / 1000),
    name: `billing-test-${Date.now()}`,
  })
}

/**
 * Advance a test clock to a specific time
 */
export async function advanceTestClock(
  testClockId: string,
  frozenTime: number
): Promise<Stripe.TestHelpers.TestClock> {
  if (!stripe) throw new Error('Stripe not configured')

  return stripe.testHelpers.testClocks.advance(testClockId, {
    frozen_time: frozenTime,
  })
}

/**
 * Get a test clock's current state
 */
export async function getTestClock(
  testClockId: string
): Promise<Stripe.TestHelpers.TestClock> {
  if (!stripe) throw new Error('Stripe not configured')

  return stripe.testHelpers.testClocks.retrieve(testClockId)
}

/**
 * Delete a test clock and all associated resources
 */
export async function deleteTestClock(testClockId: string): Promise<void> {
  if (!stripe) throw new Error('Stripe not configured')

  try {
    await stripe.testHelpers.testClocks.del(testClockId)
  } catch (error) {
    // Ignore if already deleted
    console.warn(`[stripe-test-helpers] Failed to delete test clock ${testClockId}:`, error)
  }
}

/**
 * Cleanup a test customer and all associated resources
 */
export async function cleanupStripeCustomer(customerId: string): Promise<void> {
  if (!stripe) return

  try {
    // Cancel all subscriptions first
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
    })

    for (const sub of subscriptions.data) {
      if (sub.status !== 'canceled') {
        try {
          await stripe.subscriptions.cancel(sub.id)
        } catch (e) {
          console.warn(`[stripe-test-helpers] Failed to cancel subscription ${sub.id}:`, e)
        }
      }
    }

    // Delete the customer
    await stripe.customers.del(customerId)
  } catch (error) {
    console.warn(`[stripe-test-helpers] Failed to cleanup customer ${customerId}:`, error)
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe not configured')

  return stripe.subscriptions.retrieve(subscriptionId)
}

/**
 * List all invoices for a customer
 */
export async function listInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  if (!stripe) throw new Error('Stripe not configured')

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  })

  return invoices.data
}

/**
 * Helper to wait for Stripe to process async operations
 */
export async function waitForStripeProcessing(ms: number = 1000): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
