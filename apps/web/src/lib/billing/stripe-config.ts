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
 */
export const SUBSCRIPTION_PLANS = {
  free: {
    tier: 'free' as const,
    name: 'Free',
    price: 0,
    stripePriceId: null, // No Stripe price for free tier
    credits: {
      small: 10,
      medium: 4,
      large: 2,
      xl: 1,
    },
    features: [
      '10 small actions/month',
      '4 medium actions/month',
      '2 large actions/month',
      '1 XL action/month',
      'Community support',
    ],
  },
  starter: {
    tier: 'starter' as const,
    name: 'Starter',
    price: 9.99,
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER || '',
    credits: {
      small: 50,
      medium: 20,
      large: 10,
      xl: 5,
    },
    features: [
      '50 small actions/month',
      '20 medium actions/month',
      '10 large actions/month',
      '5 XL actions/month',
      'Email support',
      'Priority task queue',
    ],
  },
  pro: {
    tier: 'pro' as const,
    name: 'Pro',
    price: 99,
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || '',
    credits: {
      small: 500,
      medium: 200,
      large: 100,
      xl: 50,
    },
    features: [
      '500 small actions/month',
      '200 medium actions/month',
      '100 large actions/month',
      '50 XL actions/month',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
    ],
  },
  max: {
    tier: 'max' as const,
    name: 'Max',
    price: 499.99,
    stripePriceId: process.env.STRIPE_PRICE_ID_MAX || '',
    credits: {
      small: 2500,
      medium: 1000,
      large: 500,
      xl: 250,
    },
    features: [
      '2,500 small actions/month',
      '1,000 medium actions/month',
      '500 large actions/month',
      '250 XL actions/month',
      'Dedicated support',
      'Custom SLA',
      'White-label options',
      'API access',
    ],
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS

/**
 * Credit Pricing for Top-ups
 * 500 credits for $20 = $0.04 per credit
 */
export const CREDIT_TOPUP = {
  amount: 500,
  price: 20,
  pricePerCredit: 0.04,
  stripePriceId: process.env.STRIPE_PRICE_ID_TOPUP_500 || '',
} as const

/**
 * Credit costs per action tier (in credits)
 */
export const ACTION_CREDIT_COSTS = {
  small: 1,
  medium: 2.5,
  large: 5,
  xl: 15,
} as const

export type ActionTier = keyof typeof ACTION_CREDIT_COSTS

/**
 * Trial Configuration
 */
export const TRIAL_CONFIG = {
  durationDays: 7,
  requireCard: false,
} as const

/**
 * Auto Top-up Configuration
 */
export const AUTO_TOPUP_CONFIG = {
  defaultThreshold: 50, // credits
  defaultAmount: 500, // credits to add
  minThreshold: 10,
  maxThreshold: 500,
  allowedAmounts: [100, 250, 500, 1000], // allowed top-up amounts
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
 * Helper function to calculate credit balance for a plan
 */
export function calculatePlanCredits(tier: SubscriptionTier) {
  const plan = SUBSCRIPTION_PLANS[tier]
  return {
    includedSmall: plan.credits.small,
    includedMedium: plan.credits.medium,
    includedLarge: plan.credits.large,
    includedXl: plan.credits.xl,
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
