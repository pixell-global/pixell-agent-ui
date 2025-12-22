/**
 * Stripe Configuration Tests
 *
 * Tests for the action-based billing configuration.
 */

import {
  SUBSCRIPTION_PLANS,
  TRIAL_CONFIG,
  getPlanByTier,
  getStripePriceId,
  isValidTier,
  getPlanQuotas,
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

    it('should have quota allocations for all tiers', () => {
      Object.values(SUBSCRIPTION_PLANS).forEach((plan) => {
        expect(plan.quotas).toHaveProperty('research')
        expect(plan.quotas).toHaveProperty('ideation')
        expect(plan.quotas).toHaveProperty('autoPosting')
        expect(plan.quotas).toHaveProperty('monitors')
      })
    })

    it('should have increasing quotas with higher tiers', () => {
      expect(SUBSCRIPTION_PLANS.starter.quotas.research).toBeGreaterThan(SUBSCRIPTION_PLANS.free.quotas.research)
      expect(SUBSCRIPTION_PLANS.pro.quotas.research).toBeGreaterThan(SUBSCRIPTION_PLANS.starter.quotas.research)
      expect(SUBSCRIPTION_PLANS.max.quotas.research).toBeGreaterThan(SUBSCRIPTION_PLANS.pro.quotas.research)
    })

    it('should have correct action-based quotas for free tier', () => {
      expect(SUBSCRIPTION_PLANS.free.quotas.research).toBe(2)
      expect(SUBSCRIPTION_PLANS.free.quotas.ideation).toBe(10)
      expect(SUBSCRIPTION_PLANS.free.quotas.autoPosting).toBe(0)
      expect(SUBSCRIPTION_PLANS.free.quotas.monitors).toBe(0)
    })

    it('should have correct action-based quotas for starter tier', () => {
      expect(SUBSCRIPTION_PLANS.starter.quotas.research).toBe(10)
      expect(SUBSCRIPTION_PLANS.starter.quotas.ideation).toBe(30)
      expect(SUBSCRIPTION_PLANS.starter.quotas.autoPosting).toBe(0)
      expect(SUBSCRIPTION_PLANS.starter.quotas.monitors).toBe(0)
    })

    it('should have correct action-based quotas for pro tier', () => {
      expect(SUBSCRIPTION_PLANS.pro.quotas.research).toBe(60)
      expect(SUBSCRIPTION_PLANS.pro.quotas.ideation).toBe(300)
      expect(SUBSCRIPTION_PLANS.pro.quotas.autoPosting).toBe(30)
      expect(SUBSCRIPTION_PLANS.pro.quotas.monitors).toBe(3)
    })

    it('should have correct action-based quotas for max tier', () => {
      expect(SUBSCRIPTION_PLANS.max.quotas.research).toBe(300)
      expect(SUBSCRIPTION_PLANS.max.quotas.ideation).toBe(3000)
      expect(SUBSCRIPTION_PLANS.max.quotas.autoPosting).toBe(300)
      expect(SUBSCRIPTION_PLANS.max.quotas.monitors).toBe(20)
    })

    it('should have features array for all tiers', () => {
      Object.values(SUBSCRIPTION_PLANS).forEach((plan) => {
        expect(Array.isArray(plan.features)).toBe(true)
        expect(plan.features.length).toBeGreaterThan(0)
      })
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
      expect(plan).toHaveProperty('quotas')
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

  describe('getPlanQuotas', () => {
    it('should return correct quotas for free tier', () => {
      const quotas = getPlanQuotas('free')
      expect(quotas).toEqual({
        researchLimit: 2,
        ideationLimit: 10,
        autoPostingLimit: 0,
        monitorsLimit: 0,
        researchAvailable: true,
        ideationAvailable: true,
        autoPostingAvailable: false,
        monitorsAvailable: false,
      })
    })

    it('should return correct quotas for starter tier', () => {
      const quotas = getPlanQuotas('starter')
      expect(quotas).toEqual({
        researchLimit: 10,
        ideationLimit: 30,
        autoPostingLimit: 0,
        monitorsLimit: 0,
        researchAvailable: true,
        ideationAvailable: true,
        autoPostingAvailable: false,
        monitorsAvailable: false,
      })
    })

    it('should return correct quotas for pro tier', () => {
      const quotas = getPlanQuotas('pro')
      expect(quotas).toEqual({
        researchLimit: 60,
        ideationLimit: 300,
        autoPostingLimit: 30,
        monitorsLimit: 3,
        researchAvailable: true,
        ideationAvailable: true,
        autoPostingAvailable: true,
        monitorsAvailable: true,
      })
    })

    it('should return correct quotas for max tier', () => {
      const quotas = getPlanQuotas('max')
      expect(quotas).toEqual({
        researchLimit: 300,
        ideationLimit: 3000,
        autoPostingLimit: 300,
        monitorsLimit: 20,
        researchAvailable: true,
        ideationAvailable: true,
        autoPostingAvailable: true,
        monitorsAvailable: true,
      })
    })
  })

  describe('isStripeConfigured', () => {
    it('should return boolean based on env vars', () => {
      const result = isStripeConfigured()
      expect(typeof result).toBe('boolean')
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

  describe('Quota Economics Validation', () => {
    it('should have increasing quotas for research', () => {
      expect(SUBSCRIPTION_PLANS.starter.quotas.research).toBeGreaterThan(SUBSCRIPTION_PLANS.free.quotas.research)
      expect(SUBSCRIPTION_PLANS.pro.quotas.research).toBeGreaterThan(SUBSCRIPTION_PLANS.starter.quotas.research)
      expect(SUBSCRIPTION_PLANS.max.quotas.research).toBeGreaterThan(SUBSCRIPTION_PLANS.pro.quotas.research)
    })

    it('should have increasing quotas for ideation', () => {
      expect(SUBSCRIPTION_PLANS.starter.quotas.ideation).toBeGreaterThan(SUBSCRIPTION_PLANS.free.quotas.ideation)
      expect(SUBSCRIPTION_PLANS.pro.quotas.ideation).toBeGreaterThan(SUBSCRIPTION_PLANS.starter.quotas.ideation)
      expect(SUBSCRIPTION_PLANS.max.quotas.ideation).toBeGreaterThan(SUBSCRIPTION_PLANS.pro.quotas.ideation)
    })

    it('should have premium features only in pro and max', () => {
      expect(SUBSCRIPTION_PLANS.free.quotas.autoPosting).toBe(0)
      expect(SUBSCRIPTION_PLANS.starter.quotas.autoPosting).toBe(0)
      expect(SUBSCRIPTION_PLANS.pro.quotas.autoPosting).toBeGreaterThan(0)
      expect(SUBSCRIPTION_PLANS.max.quotas.autoPosting).toBeGreaterThan(0)

      expect(SUBSCRIPTION_PLANS.free.quotas.monitors).toBe(0)
      expect(SUBSCRIPTION_PLANS.starter.quotas.monitors).toBe(0)
      expect(SUBSCRIPTION_PLANS.pro.quotas.monitors).toBeGreaterThan(0)
      expect(SUBSCRIPTION_PLANS.max.quotas.monitors).toBeGreaterThan(0)
    })
  })
})
