/**
 * Billing Lifecycle Integration Tests
 *
 * End-to-end tests for the complete billing lifecycle with:
 * - Real Stripe Test Mode subscriptions
 * - Full Python agent execution for quota consumption
 * - Webhook simulation for subscription updates and period renewals
 *
 * Test Flow:
 * 1. User signup → free tier → quotas initialized
 * 2. Agent uses quotas → blocking when limit hit
 * 3. Upgrade to Starter via Stripe → new limits, usage preserved
 * 4. Upgrade to Pro → new features unlocked (auto_posting, monitors)
 * 5. Hit new limits → verify blocking
 * 6. Downgrade to Starter → limits reduced, usage preserved
 * 7. Billing period renewal → usage reset (except monitors)
 * 8. Cancellation → downgrade to free
 *
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: sk_test_... (Stripe test mode secret key)
 * - STRIPE_PRICE_ID_STARTER: Test mode price ID for Starter tier
 * - STRIPE_PRICE_ID_PRO: Test mode price ID for Pro tier
 * - STRIPE_PRICE_ID_MAX: Test mode price ID for Max tier
 * - STRIPE_SKIP_SIGNATURE_CHECK: Set to 'true' for local webhook testing
 * - SERVICE_TOKEN_SECRET: Service token for internal API calls
 * - Database credentials (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)
 * - NEXT_PUBLIC_BASE_URL: Base URL (default: http://localhost:3003)
 */

import { test, expect, APIRequestContext } from '@playwright/test'
import {
  stripe,
  isStripeConfigured,
  createTestCustomer,
  attachTestPaymentMethod,
  createTestSubscription,
  updateSubscriptionTier,
  cancelSubscription,
  createTestClock,
  advanceTestClock,
  deleteTestClock,
  cleanupStripeCustomer,
  getSubscription,
  STRIPE_PRICE_IDS,
  waitForStripeProcessing,
} from './helpers/stripe-test-helpers'
import {
  simulateSubscriptionUpdated,
  simulateSubscriptionDeleted,
  simulateInvoicePaymentSucceeded,
  simulateCheckoutCompleted,
} from './helpers/webhook-simulator'
import {
  checkQuota,
  recordQuotaUsage,
  decrementQuotaUsage,
  getQuotaStatus,
  simulateAgentAction,
  useQuotaUntilLimit,
} from './helpers/agent-executor'

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'
const API_BASE = `${BASE_URL}/api`
const SERVICE_TOKEN = process.env.SERVICE_TOKEN_SECRET || ''

// Tier limits for assertions
const TIER_LIMITS = {
  free: { research: 2, ideation: 10, autoPosting: 0, monitors: 0 },
  starter: { research: 10, ideation: 30, autoPosting: 0, monitors: 0 },
  pro: { research: 60, ideation: 300, autoPosting: 30, monitors: 3 },
  max: { research: 300, ideation: 3000, autoPosting: 300, monitors: 20 },
}

// =============================================================================
// TYPES
// =============================================================================

interface BillingTestUser {
  id: string
  email: string
  displayName: string
  orgId: string
  sessionCookie: string
  sessionCookieName: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  testClockId?: string
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique test email address
 */
function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `billing-test-${timestamp}-${random}@test.pixell.ai`
}

/**
 * Create a test user via API signup and bootstrap
 */
async function createTestUser(request: APIRequestContext): Promise<BillingTestUser> {
  const email = generateTestEmail()
  const password = 'TestPassword123@'
  const displayName = `Billing Test User ${Date.now()}`

  // Step 1: Sign up via API
  const signupResponse = await request.post(`${API_BASE}/auth/signup`, {
    data: { email, password, displayName },
  })

  if (!signupResponse.ok()) {
    const errorBody = await signupResponse.json()
    throw new Error(`Signup failed: ${signupResponse.status()} - ${JSON.stringify(errorBody)}`)
  }

  const signupData = await signupResponse.json()
  const userId = signupData.user.id

  // Extract session cookie from response
  const cookies = signupResponse.headers()['set-cookie']
  const sessionCookieNames = ['SESSION', 'session']
  let sessionCookie = ''
  let sessionCookieName = 'SESSION'

  if (cookies) {
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies]
    for (const cookie of cookieArray) {
      for (const name of sessionCookieNames) {
        if (cookie.startsWith(`${name}=`)) {
          sessionCookieName = name
          sessionCookie = cookie.split(';')[0].split('=')[1]
          break
        }
      }
      if (sessionCookie) break
    }
  }

  if (!sessionCookie) {
    throw new Error('No session cookie received from signup')
  }

  // Step 2: Bootstrap organization (creates subscription + quota)
  const orgName = `Billing Test Org ${Date.now()}`
  const bootstrapResponse = await request.post(`${API_BASE}/bootstrap`, {
    data: { orgName },
    headers: {
      Cookie: `${sessionCookieName}=${sessionCookie}`,
    },
  })

  if (!bootstrapResponse.ok()) {
    const errorBody = await bootstrapResponse.json()
    throw new Error(`Bootstrap failed: ${bootstrapResponse.status()} - ${JSON.stringify(errorBody)}`)
  }

  const bootstrapData = await bootstrapResponse.json()

  return {
    id: userId,
    email,
    displayName,
    orgId: bootstrapData.orgId,
    sessionCookie,
    sessionCookieName,
  }
}

/**
 * Create a test user with Stripe customer and test clock
 */
async function createTestUserWithStripe(
  request: APIRequestContext
): Promise<BillingTestUser> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe not configured - cannot create Stripe test user')
  }

  const testUser = await createTestUser(request)

  // Create test clock for time simulation
  const testClock = await createTestClock()
  testUser.testClockId = testClock.id

  // Create Stripe customer attached to test clock
  const customer = await createTestCustomer(testUser.email, testUser.orgId, testClock.id)
  testUser.stripeCustomerId = customer.id

  // Attach test payment method
  await attachTestPaymentMethod(customer.id)

  return testUser
}

/**
 * Cleanup test user and all associated resources
 */
async function cleanupTestUser(
  request: APIRequestContext,
  testUser: BillingTestUser
): Promise<void> {
  try {
    // 1. Cleanup Stripe resources
    if (testUser.stripeCustomerId) {
      await cleanupStripeCustomer(testUser.stripeCustomerId)
    }
    if (testUser.testClockId) {
      await deleteTestClock(testUser.testClockId)
    }

    // 2. Cleanup database (via API if available, or direct DB access)
    // For now, we rely on the Stripe cleanup and accept orphaned DB records
    // In a full implementation, we'd call a cleanup endpoint or use DB helpers
    console.log(`[cleanup] Cleaned up test user: ${testUser.email}`)
  } catch (error) {
    console.warn(`[cleanup] Failed to cleanup test user ${testUser.email}:`, error)
  }
}

/**
 * Get current subscription from database via API
 */
async function getDbSubscription(
  request: APIRequestContext,
  orgId: string,
  sessionCookie: string,
  sessionCookieName: string
): Promise<{ tier: string; status: string } | null> {
  const response = await request.get(`${API_BASE}/billing/subscription?orgId=${orgId}`, {
    headers: {
      Cookie: `${sessionCookieName}=${sessionCookie}`,
    },
  })

  if (!response.ok()) {
    return null
  }

  const data = await response.json()
  return {
    tier: data.subscription?.planTier || 'free',
    status: data.subscription?.status || 'unknown',
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe.serial('Billing Lifecycle Integration Tests', () => {
  // Skip all tests if Stripe is not configured
  test.beforeAll(async () => {
    if (!isStripeConfigured()) {
      console.warn('Stripe not configured - billing tests will be skipped')
    }
  })

  // Shared test user across suites
  let testUser: BillingTestUser

  // =============================================================================
  // Suite 1: Free Tier Initialization
  // =============================================================================

  test.describe('1. Free Tier Initialization', () => {
    test('1.1 signup creates free subscription in database', async ({ request }) => {
      // Create test user (creates free subscription via bootstrap)
      testUser = await createTestUser(request)

      // Verify subscription was created
      const subscription = await getDbSubscription(
        request,
        testUser.orgId,
        testUser.sessionCookie,
        testUser.sessionCookieName
      )

      expect(subscription).not.toBeNull()
      expect(subscription?.tier).toBe('free')
      expect(subscription?.status).toBe('active')
    })

    test('1.2 quotas initialized with free limits (2/10/0/0)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.success).toBe(true)
      expect(quotaStatus.quotas?.tier).toBe('free')

      // Check research limits
      expect(quotaStatus.quotas?.features.research.limit).toBe(TIER_LIMITS.free.research)
      expect(quotaStatus.quotas?.features.research.used).toBe(0)
      expect(quotaStatus.quotas?.features.research.remaining).toBe(TIER_LIMITS.free.research)

      // Check ideation limits
      expect(quotaStatus.quotas?.features.ideation.limit).toBe(TIER_LIMITS.free.ideation)
      expect(quotaStatus.quotas?.features.ideation.used).toBe(0)
    })

    test('1.3 pro-only features marked unavailable', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.success).toBe(true)

      // Auto-posting should be unavailable on free tier
      expect(quotaStatus.quotas?.features.autoPosting.available).toBe(false)
      expect(quotaStatus.quotas?.features.autoPosting.limit).toBe(0)

      // Monitors should be unavailable on free tier
      expect(quotaStatus.quotas?.features.monitors.available).toBe(false)
      expect(quotaStatus.quotas?.features.monitors.limit).toBe(0)
    })
  })

  // =============================================================================
  // Suite 2: Quota Usage with Simulated Agent
  // =============================================================================

  test.describe('2. Quota Usage with Simulated Agent', () => {
    test('2.1 first research action succeeds (1/2 used)', async ({ request }) => {
      const result = await simulateAgentAction(request, testUser.orgId, testUser.id, 'research', {
        agentId: 'reddit-agent',
      })

      expect(result.allowed).toBe(true)
      expect(result.quotaUsed).toBe(true)
      expect(result.newUsage).toBe(1)
    })

    test('2.2 second research action succeeds (2/2 used)', async ({ request }) => {
      const result = await simulateAgentAction(request, testUser.orgId, testUser.id, 'research', {
        agentId: 'reddit-agent',
      })

      expect(result.allowed).toBe(true)
      expect(result.quotaUsed).toBe(true)
      expect(result.newUsage).toBe(2)
    })

    test('2.3 third research action blocked (quota exhausted)', async ({ request }) => {
      const result = await simulateAgentAction(request, testUser.orgId, testUser.id, 'research', {
        agentId: 'reddit-agent',
      })

      expect(result.allowed).toBe(false)
      expect(result.quotaUsed).toBe(false)
      expect(result.error).toBeTruthy() // Error message about quota limit
    })

    test('2.4 quota status shows 0 remaining', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.success).toBe(true)
      expect(quotaStatus.quotas?.features.research.used).toBe(2)
      expect(quotaStatus.quotas?.features.research.remaining).toBe(0)
    })
  })

  // =============================================================================
  // Suite 3: Upgrade to Starter via Stripe
  // =============================================================================

  test.describe('3. Stripe Upgrade to Starter', () => {
    test.skip(!isStripeConfigured(), 'Stripe not configured')

    test('3.1 create Stripe customer and subscription', async ({ request }) => {
      if (!stripe) return

      // Create Stripe customer for this user
      const customer = await createTestCustomer(testUser.email, testUser.orgId)
      testUser.stripeCustomerId = customer.id

      // Attach payment method
      await attachTestPaymentMethod(customer.id)

      // Create Starter subscription
      const subscription = await createTestSubscription(customer.id, 'starter', testUser.orgId)
      testUser.stripeSubscriptionId = subscription.id

      expect(subscription.status).toBe('active')
    })

    test('3.2 simulate checkout.session.completed webhook', async ({ request }) => {
      if (!testUser.stripeSubscriptionId) return

      const subscription = await getSubscription(testUser.stripeSubscriptionId)

      const webhookResult = await simulateCheckoutCompleted(request, {
        id: `cs_test_${Date.now()}`,
        customer: testUser.stripeCustomerId as string,
        subscription: testUser.stripeSubscriptionId,
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
        metadata: {
          orgId: testUser.orgId,
          tier: 'starter',
        },
      })

      // Log webhook response for debugging
      if (!webhookResult.ok) {
        console.error('[Test] Webhook failed:', webhookResult.status, JSON.stringify(webhookResult.body, null, 2))
      }

      expect(webhookResult.ok).toBe(true)
    })

    test('3.3 verify subscription updated to Starter in DB', async ({ request }) => {
      // Wait for webhook processing
      await waitForStripeProcessing(1000)

      const subscription = await getDbSubscription(
        request,
        testUser.orgId,
        testUser.sessionCookie,
        testUser.sessionCookieName
      )

      expect(subscription?.tier).toBe('starter')
      expect(subscription?.status).toBe('active')
    })

    test('3.4 verify quota limits increased (10/30/0/0)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.success).toBe(true)
      expect(quotaStatus.quotas?.tier).toBe('starter')
      expect(quotaStatus.quotas?.features.research.limit).toBe(TIER_LIMITS.starter.research)
      expect(quotaStatus.quotas?.features.ideation.limit).toBe(TIER_LIMITS.starter.ideation)
    })

    test('3.5 verify existing usage preserved (still 2 research used)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.success).toBe(true)
      // Previous usage should be preserved
      expect(quotaStatus.quotas?.features.research.used).toBe(2)
      // But now we have more remaining
      expect(quotaStatus.quotas?.features.research.remaining).toBe(8) // 10 - 2 = 8
    })
  })

  // =============================================================================
  // Suite 4: Upgrade to Pro - New Features
  // =============================================================================

  test.describe('4. Upgrade to Pro', () => {
    test.skip(!isStripeConfigured(), 'Stripe not configured')

    test('4.1 update subscription to Pro tier', async ({ request }) => {
      if (!testUser.stripeSubscriptionId) return

      const updatedSub = await updateSubscriptionTier(testUser.stripeSubscriptionId, 'pro')
      expect(updatedSub.status).toBe('active')

      // Simulate webhook
      await simulateSubscriptionUpdated(request, {
        id: testUser.stripeSubscriptionId,
        customer: testUser.stripeCustomerId as string,
        status: 'active',
        metadata: {
          orgId: testUser.orgId,
          tier: 'pro',
        },
      })

      await waitForStripeProcessing(1000)
    })

    test('4.2 verify quota limits (60/300/30/3)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.success).toBe(true)
      expect(quotaStatus.quotas?.features.research.limit).toBe(TIER_LIMITS.pro.research)
      expect(quotaStatus.quotas?.features.ideation.limit).toBe(TIER_LIMITS.pro.ideation)
      expect(quotaStatus.quotas?.features.autoPosting.limit).toBe(TIER_LIMITS.pro.autoPosting)
      expect(quotaStatus.quotas?.features.monitors.limit).toBe(TIER_LIMITS.pro.monitors)
    })

    test('4.3 verify auto_posting now available', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.quotas?.features.autoPosting.available).toBe(true)
      expect(quotaStatus.quotas?.features.autoPosting.limit).toBe(30)
    })

    test('4.4 verify monitors now available', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.quotas?.features.monitors.available).toBe(true)
      expect(quotaStatus.quotas?.features.monitors.limit).toBe(3)
    })

    test('4.5 agent can use auto_posting feature', async ({ request }) => {
      const result = await simulateAgentAction(
        request,
        testUser.orgId,
        testUser.id,
        'auto_posting',
        { agentId: 'vivid-commenter' }
      )

      expect(result.allowed).toBe(true)
      expect(result.quotaUsed).toBe(true)
      expect(result.newUsage).toBe(1)
    })
  })

  // =============================================================================
  // Suite 5: Quota Blocking at Limits
  // =============================================================================

  test.describe('5. Quota Limits and Blocking', () => {
    test('5.1 use research quota to approach limit', async ({ request }) => {
      // Get current usage
      const status = await getQuotaStatus(request, testUser.orgId)
      const currentUsed = status.quotas?.features.research.used || 0
      const limit = status.quotas?.features.research.limit || 0

      // Use quota until we're near the limit (leave 1 remaining for blocking test)
      // Make parallel requests to speed up the test (batches of 10)
      const toUse = limit - currentUsed - 1
      const useCapped = Math.min(toUse, 60) // Cap at 60 (Pro tier limit)

      // Execute in batches to speed up
      const batchSize = 10
      for (let batch = 0; batch < Math.ceil(useCapped / batchSize); batch++) {
        const batchPromises = []
        for (let i = 0; i < batchSize && batch * batchSize + i < useCapped; i++) {
          batchPromises.push(recordQuotaUsage(request, testUser.orgId, testUser.id, 'research'))
        }
        await Promise.all(batchPromises)
      }

      // Use one more to hit the limit
      const result = await simulateAgentAction(request, testUser.orgId, testUser.id, 'research')
      expect(result.quotaUsed).toBe(true)
    }, { timeout: 120000 }) // 2 minute timeout for this test

    test('5.2 next action blocked at pre-check', async ({ request }) => {
      // First verify we're at the limit
      const status = await getQuotaStatus(request, testUser.orgId)
      expect(status.quotas?.features.research.remaining).toBe(0)

      // Try to use more
      const result = await checkQuota(request, testUser.orgId, 'research')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    test('5.3 monitor creation at limit blocked', async ({ request }) => {
      // Use all 3 monitors
      for (let i = 0; i < 3; i++) {
        await recordQuotaUsage(request, testUser.orgId, testUser.id, 'monitors')
      }

      // Verify at limit
      const status = await getQuotaStatus(request, testUser.orgId)
      expect(status.quotas?.features.monitors.active).toBe(3)

      // Try to create 4th
      const result = await checkQuota(request, testUser.orgId, 'monitors')
      expect(result.allowed).toBe(false)
    })

    test('5.4 monitor deletion decrements active count', async ({ request }) => {
      // Decrement one monitor
      const decrementResult = await decrementQuotaUsage(
        request,
        testUser.orgId,
        testUser.id,
        'monitors'
      )
      expect(decrementResult.success).toBe(true)

      // Verify count decreased
      const status = await getQuotaStatus(request, testUser.orgId)
      expect(status.quotas?.features.monitors.active).toBe(2)

      // Now can create a new one
      const checkResult = await checkQuota(request, testUser.orgId, 'monitors')
      expect(checkResult.allowed).toBe(true)
    })
  })

  // =============================================================================
  // Suite 6: Downgrade to Starter
  // =============================================================================

  test.describe('6. Downgrade to Starter', () => {
    test.skip(!isStripeConfigured(), 'Stripe not configured')

    test('6.1 update subscription to Starter tier', async ({ request }) => {
      if (!testUser.stripeSubscriptionId) return

      const updatedSub = await updateSubscriptionTier(testUser.stripeSubscriptionId, 'starter')
      expect(updatedSub.status).toBe('active')

      // Simulate webhook
      await simulateSubscriptionUpdated(request, {
        id: testUser.stripeSubscriptionId,
        customer: testUser.stripeCustomerId as string,
        status: 'active',
        metadata: {
          orgId: testUser.orgId,
          tier: 'starter',
        },
      })

      await waitForStripeProcessing(1000)
    })

    test('6.2 verify limits reduced (10/30/0/0)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.quotas?.tier).toBe('starter')
      expect(quotaStatus.quotas?.features.research.limit).toBe(TIER_LIMITS.starter.research)
      expect(quotaStatus.quotas?.features.autoPosting.limit).toBe(0)
      expect(quotaStatus.quotas?.features.monitors.limit).toBe(0)
    })

    test('6.3 verify usage preserved (may exceed new limit)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      // Usage should be preserved even if it exceeds the new limit
      // The used count should be >= the new limit
      expect(quotaStatus.quotas?.features.research.used).toBeGreaterThanOrEqual(10)
    })

    test('6.4 verify blocked until usage resets', async ({ request }) => {
      // Since usage exceeds limit, should be blocked
      const checkResult = await checkQuota(request, testUser.orgId, 'research')
      expect(checkResult.allowed).toBe(false)

      // Auto-posting should now be unavailable
      const autoPostCheck = await checkQuota(request, testUser.orgId, 'auto_posting')
      expect(autoPostCheck.featureAvailable).toBe(false)
    })
  })

  // =============================================================================
  // Suite 7: Billing Period Renewal
  // =============================================================================

  test.describe('7. Billing Period Renewal', () => {
    test('7.1 simulate invoice.payment_succeeded webhook for new period', async ({ request }) => {
      const now = Math.floor(Date.now() / 1000)
      const newPeriodStart = now
      const newPeriodEnd = now + 30 * 24 * 60 * 60

      const webhookResult = await simulateInvoicePaymentSucceeded(request, {
        id: `in_test_${Date.now()}`,
        customer: testUser.stripeCustomerId as string,
        subscription: testUser.stripeSubscriptionId as string,
        billing_reason: 'subscription_cycle',
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
        paid: true,
        status: 'paid',
        metadata: {
          orgId: testUser.orgId,
        },
      })

      expect(webhookResult.ok).toBe(true)
    })

    test('7.2 verify billing period dates updated', async ({ request }) => {
      await waitForStripeProcessing(1000)

      const quotaStatus = await getQuotaStatus(request, testUser.orgId)
      expect(quotaStatus.success).toBe(true)

      // Period dates should be recent
      const periodStart = new Date(quotaStatus.quotas?.billingPeriodStart || '')
      const now = new Date()
      const diffHours = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60)
      expect(diffHours).toBeLessThan(24) // Within last 24 hours
    })

    test('7.3 verify usage counters reset', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      // Research and ideation should be reset to 0
      expect(quotaStatus.quotas?.features.research.used).toBe(0)
      expect(quotaStatus.quotas?.features.ideation.used).toBe(0)
    })

    test('7.4 verify can use quota again after reset', async ({ request }) => {
      const result = await simulateAgentAction(request, testUser.orgId, testUser.id, 'research')

      expect(result.allowed).toBe(true)
      expect(result.quotaUsed).toBe(true)
      expect(result.newUsage).toBe(1)
    })
  })

  // =============================================================================
  // Suite 8: Subscription Cancellation
  // =============================================================================

  test.describe('8. Subscription Cancellation', () => {
    test.skip(!isStripeConfigured(), 'Stripe not configured')

    test('8.1 cancel subscription at period end', async ({ request }) => {
      if (!testUser.stripeSubscriptionId) return

      const canceledSub = await cancelSubscription(testUser.stripeSubscriptionId, {
        atPeriodEnd: true,
        reason: 'Test cancellation',
      })

      expect(canceledSub.cancel_at_period_end).toBe(true)
    })

    test('8.2 verify cancelAtPeriodEnd = true', async ({ request }) => {
      if (!testUser.stripeSubscriptionId) return

      const subscription = await getSubscription(testUser.stripeSubscriptionId)
      expect(subscription.cancel_at_period_end).toBe(true)
      expect(subscription.status).toBe('active') // Still active until period end
    })

    test('8.3 simulate subscription.deleted webhook', async ({ request }) => {
      // Wait for any real Stripe webhooks from the cancellation to be processed first
      // Real Stripe sends subscription.updated when cancel_at_period_end changes
      await waitForStripeProcessing(4000)

      console.log('[Test 8.3] Sending subscription.deleted webhook:', {
        subscriptionId: testUser.stripeSubscriptionId,
        customerId: testUser.stripeCustomerId,
        orgId: testUser.orgId,
      })

      const webhookResult = await simulateSubscriptionDeleted(request, {
        id: testUser.stripeSubscriptionId as string,
        customer: testUser.stripeCustomerId as string,
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000),
        ended_at: Math.floor(Date.now() / 1000),
        metadata: {
          orgId: testUser.orgId,
          tier: 'starter',
        },
      })

      console.log('[Test 8.3] Webhook response:', webhookResult.status, webhookResult.body)
      expect(webhookResult.ok).toBe(true)
    })

    test('8.4 verify downgraded to free tier', async ({ request }) => {
      await waitForStripeProcessing(2000) // Wait longer for webhook processing

      const subscription = await getDbSubscription(
        request,
        testUser.orgId,
        testUser.sessionCookie,
        testUser.sessionCookieName
      )

      // Debug logging
      console.log('[Test 8.4] Subscription after deletion webhook:', {
        tier: subscription?.tier,
        status: subscription?.status,
        orgId: testUser.orgId,
        stripeSubId: testUser.stripeSubscriptionId,
      })

      expect(subscription?.tier).toBe('free')
    })

    test('8.5 verify quota limits reset to free (2/10/0/0)', async ({ request }) => {
      const quotaStatus = await getQuotaStatus(request, testUser.orgId)

      expect(quotaStatus.quotas?.tier).toBe('free')
      expect(quotaStatus.quotas?.features.research.limit).toBe(TIER_LIMITS.free.research)
      expect(quotaStatus.quotas?.features.ideation.limit).toBe(TIER_LIMITS.free.ideation)
      expect(quotaStatus.quotas?.features.autoPosting.available).toBe(false)
      expect(quotaStatus.quotas?.features.monitors.available).toBe(false)
    })
  })

  // =============================================================================
  // Cleanup
  // =============================================================================

  test.afterAll(async ({ request }) => {
    if (testUser) {
      await cleanupTestUser(request, testUser)
    }
  })
})
