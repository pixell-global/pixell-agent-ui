/**
 * Stripe Configuration
 *
 * Centralizes Stripe initialization and configuration constants
 */

import Stripe from 'stripe'

// Initialize Stripe client (only if secret key is provided)
let stripeInstance: Stripe | null = null

export const stripe = (() => {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not configured. Stripe features will be disabled.')
    return null as any // Return a mock object to prevent errors
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    })
  }
  return stripeInstance
})()

/**
 * Subscription Plan Configuration
 *
 * Action-based billing: 1 action = 1 count (regardless of output size)
 *
 * | Plan    | Research | Ideation | Auto-posting | Monitors |
 * |---------|----------|----------|--------------|----------|
 * | Free    | 2        | 10       | N/A          | N/A      |
 * | Starter | 10       | 30       | N/A          | N/A      |
 * | Pro     | 60       | 300      | 30           | 3        |
 * | Max     | 300      | 3,000    | 300          | 20       |
 */
export const SUBSCRIPTION_PLANS = {
  free: {
    tier: 'free' as const,
    name: 'Free',
    price: 0,
    stripePriceId: null, // No Stripe price for free tier
    quotas: {
      research: 2,
      ideation: 10,
      autoPosting: 0, // N/A
      monitors: 0, // N/A
    },
    features: [
      '2 research actions/month',
      '10 ideation runs/month',
      'Community support',
    ],
  },
  starter: {
    tier: 'starter' as const,
    name: 'Starter',
    price: 9.99,
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER || '',
    quotas: {
      research: 10,
      ideation: 30,
      autoPosting: 0, // N/A
      monitors: 0, // N/A
    },
    features: [
      '10 research actions/month',
      '30 ideation runs/month',
      'Email support',
      'Priority task queue',
    ],
  },
  pro: {
    tier: 'pro' as const,
    name: 'Pro',
    price: 99,
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || '',
    quotas: {
      research: 60,
      ideation: 300,
      autoPosting: 30,
      monitors: 3, // Concurrent limit
    },
    features: [
      '60 research actions/month',
      '300 ideation runs/month',
      '30 auto-posts/month',
      '3 concurrent monitors',
      'Priority support',
      'Advanced analytics',
    ],
  },
  max: {
    tier: 'max' as const,
    name: 'Max',
    price: 499.99,
    stripePriceId: process.env.STRIPE_PRICE_ID_MAX || '',
    quotas: {
      research: 300,
      ideation: 3000,
      autoPosting: 300,
      monitors: 20, // Concurrent limit
    },
    features: [
      '300 research actions/month',
      '3,000 ideation runs/month',
      '300 auto-posts/month',
      '20 concurrent monitors',
      'Dedicated support',
      'Custom SLA',
      'API access',
    ],
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS

/**
 * Trial Configuration
 */
export const TRIAL_CONFIG = {
  durationDays: 7,
  requireCard: false,
} as const

/**
 * Webhook Configuration
 */
export const WEBHOOK_CONFIG = {
  secret: process.env.STRIPE_WEBHOOK_SECRET || '',
  toleranceSeconds: 300, // 5 minutes
} as const

/**
 * Helper function to get plan by tier
 */
export function getPlanByTier(tier: SubscriptionTier) {
  return SUBSCRIPTION_PLANS[tier]
}

/**
 * Helper function to get Stripe price ID by tier
 */
export function getStripePriceId(tier: SubscriptionTier): string | null {
  return SUBSCRIPTION_PLANS[tier].stripePriceId || null
}

/**
 * Helper function to validate tier
 */
export function isValidTier(tier: string): tier is SubscriptionTier {
  return tier in SUBSCRIPTION_PLANS
}

/**
 * Helper function to get plan quotas
 */
export function getPlanQuotas(tier: SubscriptionTier) {
  const plan = SUBSCRIPTION_PLANS[tier]
  return {
    researchLimit: plan.quotas.research,
    ideationLimit: plan.quotas.ideation,
    autoPostingLimit: plan.quotas.autoPosting,
    monitorsLimit: plan.quotas.monitors,
    researchAvailable: plan.quotas.research > 0,
    ideationAvailable: plan.quotas.ideation > 0,
    autoPostingAvailable: plan.quotas.autoPosting > 0,
    monitorsAvailable: plan.quotas.monitors > 0,
  }
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET
  const hasStarterPrice = !!process.env.STRIPE_PRICE_ID_STARTER
  const hasProPrice = !!process.env.STRIPE_PRICE_ID_PRO
  const hasMaxPrice = !!process.env.STRIPE_PRICE_ID_MAX

  return hasSecretKey && hasWebhookSecret && hasStarterPrice && hasProPrice && hasMaxPrice
}
