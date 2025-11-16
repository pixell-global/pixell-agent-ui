/**
 * Stripe Configuration Tests
 */

import {
  SUBSCRIPTION_PLANS,
  ACTION_CREDIT_COSTS,
  CREDIT_TOPUP,
  TRIAL_CONFIG,
  AUTO_TOPUP_CONFIG,
  getPlanByTier,
  getStripePriceId,
  isValidTier,
  calculatePlanCredits,
  isStripeConfigured,
} from '../stripe-config'

describe('Stripe Configuration', () => {
  describe('SUBSCRIPTION_PLANS', () => {
    it('should have all 4 tier levels', () => {
      expect(Object.keys(SUBSCRIPTION_PLANS)).toEqual(['free', 'starter', 'pro', 'max'])
    })

    it('should have correct pricing', () => {
      expect(SUBSCRIPTION_PLANS.free.price).toBe(0)
      expect(SUBSCRIPTION_PLANS.starter.price).toBe(9.99)
      expect(SUBSCRIPTION_PLANS.pro.price).toBe(99)
      expect(SUBSCRIPTION_PLANS.max.price).toBe(499.99)
    })

    it('should have Stripe price IDs for paid tiers', () => {
      expect(SUBSCRIPTION_PLANS.free.stripePriceId).toBeNull()
      expect(SUBSCRIPTION_PLANS.starter.stripePriceId).toBeTruthy()
      expect(SUBSCRIPTION_PLANS.pro.stripePriceId).toBeTruthy()
      expect(SUBSCRIPTION_PLANS.max.stripePriceId).toBeTruthy()
    })

    it('should have credit allocations for all tiers', () => {
      Object.values(SUBSCRIPTION_PLANS).forEach((plan) => {
        expect(plan.credits).toHaveProperty('small')
        expect(plan.credits).toHaveProperty('medium')
        expect(plan.credits).toHaveProperty('large')
        expect(plan.credits).toHaveProperty('xl')
      })
    })

    it('should have increasing credits with higher tiers', () => {
      expect(SUBSCRIPTION_PLANS.starter.credits.small).toBeGreaterThan(SUBSCRIPTION_PLANS.free.credits.small)
      expect(SUBSCRIPTION_PLANS.pro.credits.small).toBeGreaterThan(SUBSCRIPTION_PLANS.starter.credits.small)
      expect(SUBSCRIPTION_PLANS.max.credits.small).toBeGreaterThan(SUBSCRIPTION_PLANS.pro.credits.small)
    })

    it('should have features array for all tiers', () => {
      Object.values(SUBSCRIPTION_PLANS).forEach((plan) => {
        expect(Array.isArray(plan.features)).toBe(true)
        expect(plan.features.length).toBeGreaterThan(0)
      })
    })
  })

  describe('ACTION_CREDIT_COSTS', () => {
    it('should have all 4 action tiers', () => {
      expect(Object.keys(ACTION_CREDIT_COSTS)).toEqual(['small', 'medium', 'large', 'xl'])
    })

    it('should have correct credit costs', () => {
      expect(ACTION_CREDIT_COSTS.small).toBe(1)
      expect(ACTION_CREDIT_COSTS.medium).toBe(2.5)
      expect(ACTION_CREDIT_COSTS.large).toBe(5)
      expect(ACTION_CREDIT_COSTS.xl).toBe(15)
    })

    it('should have increasing costs', () => {
      expect(ACTION_CREDIT_COSTS.medium).toBeGreaterThan(ACTION_CREDIT_COSTS.small)
      expect(ACTION_CREDIT_COSTS.large).toBeGreaterThan(ACTION_CREDIT_COSTS.medium)
      expect(ACTION_CREDIT_COSTS.xl).toBeGreaterThan(ACTION_CREDIT_COSTS.large)
    })
  })

  describe('CREDIT_TOPUP', () => {
    it('should have correct topup configuration', () => {
      expect(CREDIT_TOPUP.amount).toBe(500)
      expect(CREDIT_TOPUP.price).toBe(20)
      expect(CREDIT_TOPUP.pricePerCredit).toBe(0.04)
    })

    it('should have consistent pricing calculation', () => {
      expect(CREDIT_TOPUP.price / CREDIT_TOPUP.amount).toBe(CREDIT_TOPUP.pricePerCredit)
    })

    it('should have Stripe price ID', () => {
      expect(CREDIT_TOPUP.stripePriceId).toBeTruthy()
    })
  })

  describe('TRIAL_CONFIG', () => {
    it('should have 7-day trial', () => {
      expect(TRIAL_CONFIG.durationDays).toBe(7)
    })

    it('should not require card', () => {
      expect(TRIAL_CONFIG.requireCard).toBe(false)
    })
  })

  describe('AUTO_TOPUP_CONFIG', () => {
    it('should have valid default values', () => {
      expect(AUTO_TOPUP_CONFIG.defaultThreshold).toBe(50)
      expect(AUTO_TOPUP_CONFIG.defaultAmount).toBe(500)
    })

    it('should have valid threshold range', () => {
      expect(AUTO_TOPUP_CONFIG.minThreshold).toBeLessThan(AUTO_TOPUP_CONFIG.maxThreshold)
      expect(AUTO_TOPUP_CONFIG.defaultThreshold).toBeGreaterThanOrEqual(AUTO_TOPUP_CONFIG.minThreshold)
      expect(AUTO_TOPUP_CONFIG.defaultThreshold).toBeLessThanOrEqual(AUTO_TOPUP_CONFIG.maxThreshold)
    })

    it('should have allowed amounts array', () => {
      expect(Array.isArray(AUTO_TOPUP_CONFIG.allowedAmounts)).toBe(true)
      expect(AUTO_TOPUP_CONFIG.allowedAmounts).toContain(AUTO_TOPUP_CONFIG.defaultAmount)
    })
  })

  describe('getPlanByTier', () => {
    it('should return correct plan for valid tier', () => {
      const freePlan = getPlanByTier('free')
      expect(freePlan.tier).toBe('free')
      expect(freePlan.name).toBe('Free')
    })

    it('should return plan with all required properties', () => {
      const plan = getPlanByTier('starter')
      expect(plan).toHaveProperty('tier')
      expect(plan).toHaveProperty('name')
      expect(plan).toHaveProperty('price')
      expect(plan).toHaveProperty('stripePriceId')
      expect(plan).toHaveProperty('credits')
      expect(plan).toHaveProperty('features')
    })
  })

  describe('getStripePriceId', () => {
    it('should return null for free tier', () => {
      expect(getStripePriceId('free')).toBeNull()
    })

    it('should return price ID for paid tiers', () => {
      expect(getStripePriceId('starter')).toBe(process.env.STRIPE_PRICE_ID_STARTER)
      expect(getStripePriceId('pro')).toBe(process.env.STRIPE_PRICE_ID_PRO)
      expect(getStripePriceId('max')).toBe(process.env.STRIPE_PRICE_ID_MAX)
    })
  })

  describe('isValidTier', () => {
    it('should return true for valid tiers', () => {
      expect(isValidTier('free')).toBe(true)
      expect(isValidTier('starter')).toBe(true)
      expect(isValidTier('pro')).toBe(true)
      expect(isValidTier('max')).toBe(true)
    })

    it('should return false for invalid tiers', () => {
      expect(isValidTier('invalid')).toBe(false)
      expect(isValidTier('premium')).toBe(false)
      expect(isValidTier('')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(isValidTier('Free')).toBe(false)
      expect(isValidTier('STARTER')).toBe(false)
    })
  })

  describe('calculatePlanCredits', () => {
    it('should return correct credits for free tier', () => {
      const credits = calculatePlanCredits('free')
      expect(credits).toEqual({
        includedSmall: 10,
        includedMedium: 4,
        includedLarge: 2,
        includedXl: 1,
      })
    })

    it('should return correct credits for starter tier', () => {
      const credits = calculatePlanCredits('starter')
      expect(credits).toEqual({
        includedSmall: 50,
        includedMedium: 20,
        includedLarge: 10,
        includedXl: 5,
      })
    })

    it('should return correct credits for pro tier', () => {
      const credits = calculatePlanCredits('pro')
      expect(credits).toEqual({
        includedSmall: 500,
        includedMedium: 200,
        includedLarge: 100,
        includedXl: 50,
      })
    })

    it('should return correct credits for max tier', () => {
      const credits = calculatePlanCredits('max')
      expect(credits).toEqual({
        includedSmall: 2500,
        includedMedium: 1000,
        includedLarge: 500,
        includedXl: 250,
      })
    })

    it('should return object with all credit types', () => {
      const credits = calculatePlanCredits('starter')
      expect(Object.keys(credits)).toEqual([
        'includedSmall',
        'includedMedium',
        'includedLarge',
        'includedXl',
      ])
    })
  })

  describe('isStripeConfigured', () => {
    it('should return true when all required env vars are set', () => {
      expect(isStripeConfigured()).toBe(true)
    })

    it('should return false when STRIPE_SECRET_KEY is missing', () => {
      const original = process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_SECRET_KEY
      expect(isStripeConfigured()).toBe(false)
      process.env.STRIPE_SECRET_KEY = original
    })

    it('should return false when STRIPE_WEBHOOK_SECRET is missing', () => {
      const original = process.env.STRIPE_WEBHOOK_SECRET
      delete process.env.STRIPE_WEBHOOK_SECRET
      expect(isStripeConfigured()).toBe(false)
      process.env.STRIPE_WEBHOOK_SECRET = original
    })

    it('should return false when price IDs are missing', () => {
      const originalStarter = process.env.STRIPE_PRICE_ID_STARTER
      delete process.env.STRIPE_PRICE_ID_STARTER
      expect(isStripeConfigured()).toBe(false)
      process.env.STRIPE_PRICE_ID_STARTER = originalStarter
    })
  })

  describe('Price Economics Validation', () => {
    it('should have reasonable pricing ratios', () => {
      // Starter should be ~10x free
      const starterToFreeRatio = SUBSCRIPTION_PLANS.starter.credits.small / SUBSCRIPTION_PLANS.free.credits.small
      expect(starterToFreeRatio).toBe(5)

      // Pro should be ~10x starter
      const proToStarterRatio = SUBSCRIPTION_PLANS.pro.credits.small / SUBSCRIPTION_PLANS.starter.credits.small
      expect(proToStarterRatio).toBe(10)
    })

    it('should have consistent price-to-value ratio', () => {
      // Calculate value per dollar (small credits per dollar)
      const starterValue = SUBSCRIPTION_PLANS.starter.credits.small / SUBSCRIPTION_PLANS.starter.price
      const proValue = SUBSCRIPTION_PLANS.pro.credits.small / SUBSCRIPTION_PLANS.pro.price
      const maxValue = SUBSCRIPTION_PLANS.max.credits.small / SUBSCRIPTION_PLANS.max.price

      // Pro tier should have better value than Starter
      expect(proValue).toBeGreaterThan(starterValue)

      // All values should be positive and reasonable (between 1-10 credits per dollar)
      expect(starterValue).toBeGreaterThan(1)
      expect(starterValue).toBeLessThan(10)
      expect(proValue).toBeGreaterThan(1)
      expect(proValue).toBeLessThan(10)
      expect(maxValue).toBeGreaterThan(1)
      expect(maxValue).toBeLessThan(10)
    })
  })
})
