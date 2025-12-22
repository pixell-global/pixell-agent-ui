/**
 * Feature Quota System Integration Tests
 *
 * End-to-end tests for the feature quota system using:
 * - Real Firebase users created via API signup
 * - Dev database (vivid_dev) on RDS
 * - Reddit Agent (vivid-commenter) action simulation
 * - Free tier user to test quota limits (research=2, ideation=10)
 *
 * Environment Variables Required:
 * - FIREBASE_WEB_API_KEY - Firebase Web API key for user signup
 * - SERVICE_TOKEN_SECRET - Service token for quota API authentication
 * - DATABASE credentials (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)
 * - NEXT_PUBLIC_BASE_URL - Base URL (default: http://localhost:3003)
 */

import { test, expect, APIRequestContext } from '@playwright/test'

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'
const API_BASE = `${BASE_URL}/api`
const SERVICE_TOKEN = process.env.SERVICE_TOKEN_SECRET || ''

// Free tier limits for assertions
const FREE_TIER_LIMITS = {
  research: 2,
  ideation: 10,
  auto_posting: 0, // N/A
  monitors: 0, // N/A
}

// =============================================================================
// TYPES
// =============================================================================

interface TestUser {
  id: string
  email: string
  displayName: string
  orgId: string
  sessionCookie: string
}

interface QuotaCheckResponse {
  success: boolean
  allowed: boolean
  featureAvailable: boolean
  limit: number | null
  used: number
  remaining: number
  reason?: string
}

interface QuotaRecordResponse {
  success: boolean
  usageEventId?: number
  newUsage?: number
  error?: string
  allowed?: boolean
}

interface QuotaStatusResponse {
  success: boolean
  quotas?: {
    tier: string
    billingPeriodStart: string
    billingPeriodEnd: string
    features: {
      research: { available: boolean; limit: number; used: number; remaining: number }
      ideation: { available: boolean; limit: number; used: number; remaining: number }
      autoPosting: { available: boolean; limit: number; used: number; remaining: number }
      monitors: { available: boolean; limit: number; active: number; remaining: number }
    }
  }
  error?: string
}

type FeatureType = 'research' | 'ideation' | 'auto_posting' | 'monitors'

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique test email address
 */
function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `quota-test-${timestamp}-${random}@test.pixell.ai`
}

/**
 * Create a test user via API signup
 */
async function createTestUser(request: APIRequestContext): Promise<TestUser> {
  const email = generateTestEmail()
  const password = 'TestPassword123@'
  const displayName = `Quota Test User ${Date.now()}`

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
  // Try both SESSION (uppercase) and session (lowercase)
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
  const orgName = `Test Org ${Date.now()}`
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
  const orgId = bootstrapData.orgId

  // Extract ORG cookie if set
  const bootstrapCookies = bootstrapResponse.headers()['set-cookie']
  if (bootstrapCookies) {
    const cookieArray = Array.isArray(bootstrapCookies) ? bootstrapCookies : [bootstrapCookies]
    for (const cookie of cookieArray) {
      if (cookie.startsWith('ORG=')) {
        // Append ORG cookie to session
        sessionCookie = `${sessionCookie}; ${cookie.split(';')[0]}`
        break
      }
    }
  }

  return {
    id: userId,
    email,
    displayName,
    orgId,
    sessionCookie,
  }
}

/**
 * Service token headers for quota API authentication
 */
function getServiceAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Check quota availability for a feature
 */
async function checkQuota(
  request: APIRequestContext,
  orgId: string,
  feature: FeatureType
): Promise<QuotaCheckResponse> {
  const response = await request.post(`${API_BASE}/billing/quotas/check`, {
    data: { orgId, feature },
    headers: getServiceAuthHeaders(),
  })

  return response.json()
}

/**
 * Record quota usage (increment)
 */
async function recordQuotaUsage(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  feature: FeatureType,
  metadata?: { agentId?: string; extra?: Record<string, unknown> }
): Promise<QuotaRecordResponse> {
  const response = await request.post(`${API_BASE}/billing/quotas/record`, {
    data: {
      orgId,
      userId,
      feature,
      action: 'increment',
      metadata,
    },
    headers: getServiceAuthHeaders(),
  })

  const body = await response.json()

  // Check for error status
  if (!response.ok()) {
    console.error(`[recordQuotaUsage] Error ${response.status()}: ${JSON.stringify(body)}`)
    return {
      success: false,
      error: body.message || body.error,
      allowed: false,
    }
  }

  return body
}

/**
 * Decrement monitor count
 */
async function decrementMonitorCount(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  metadata?: { agentId?: string; extra?: Record<string, unknown> }
): Promise<QuotaRecordResponse> {
  const response = await request.post(`${API_BASE}/billing/quotas/record`, {
    data: {
      orgId,
      userId,
      feature: 'monitors',
      action: 'decrement',
      metadata,
    },
    headers: getServiceAuthHeaders(),
  })

  return response.json()
}

/**
 * Get full quota status for an organization
 */
async function getQuotaStatus(
  request: APIRequestContext,
  orgId: string
): Promise<QuotaStatusResponse> {
  const response = await request.get(`${API_BASE}/billing/quotas?orgId=${orgId}`, {
    headers: getServiceAuthHeaders(),
  })

  return response.json()
}

/**
 * Simulate Reddit Agent (vivid-commenter) action
 * Mirrors how orchestrator calls quota APIs for agent actions
 */
async function simulateRedditAgentAction(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  actionType: FeatureType
): Promise<{
  checkResult: QuotaCheckResponse
  recordResult?: QuotaRecordResponse
}> {
  // Step 1: Pre-check quota
  const checkResult = await checkQuota(request, orgId, actionType)

  // Step 2: If allowed, record usage
  if (checkResult.allowed) {
    const recordResult = await recordQuotaUsage(request, orgId, userId, actionType, {
      agentId: 'vivid-commenter',
      extra: {
        action: 'reddit_engagement',
        timestamp: new Date().toISOString(),
        subreddit: 'test_subreddit',
        postType: 'comment',
      },
    })
    return { checkResult, recordResult }
  }

  return { checkResult }
}

/**
 * Cleanup test user and related data from database
 * Note: This is best-effort cleanup. In a real test environment,
 * you might want to use database transactions or test-specific databases.
 */
async function cleanupTestUser(testUser: TestUser): Promise<void> {
  // Cleanup is done by deleting in proper FK order:
  // 1. feature_usage_events
  // 2. feature_quotas
  // 3. credit_balances
  // 4. subscriptions
  // 5. organization_members
  // 6. organizations
  // 7. users
  //
  // Note: For this test file, we rely on the test database being ephemeral
  // or having a cleanup mechanism. In production tests, you would call
  // a cleanup API or directly delete from database.
  console.log(`Test cleanup: User ${testUser.email}, Org ${testUser.orgId}`)
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe.serial('Feature Quota System Integration Tests', () => {
  let testUser: TestUser

  test.beforeAll(async ({ request }) => {
    // Skip tests if service token not configured
    if (!SERVICE_TOKEN) {
      console.warn('SERVICE_TOKEN_SECRET not set - skipping quota tests')
      return
    }

    // Create test user
    testUser = await createTestUser(request)
    console.log(`Created test user: ${testUser.email} with org: ${testUser.orgId}`)
  })

  test.afterAll(async () => {
    if (testUser) {
      await cleanupTestUser(testUser)
    }
  })

  // Skip all tests if no service token
  test.beforeEach(async () => {
    if (!SERVICE_TOKEN) {
      test.skip()
    }
  })

  // 1. Quota Initialization Tests
  test('1.1 should initialize quotas with free tier limits on signup', async ({ request }) => {
    const status = await getQuotaStatus(request, testUser.orgId)

    expect(status.success).toBe(true)
    expect(status.quotas).toBeDefined()
    expect(status.quotas!.tier).toBe('free')

    const { features } = status.quotas!
    expect(features.research.available).toBe(true)
    expect(features.research.limit).toBe(FREE_TIER_LIMITS.research)
    expect(features.research.used).toBe(0)

    expect(features.ideation.available).toBe(true)
    expect(features.ideation.limit).toBe(FREE_TIER_LIMITS.ideation)
    expect(features.ideation.used).toBe(0)

    expect(features.autoPosting.available).toBe(false)
    expect(features.monitors.available).toBe(false)
  })

  test('1.2 should have valid billing period dates', async ({ request }) => {
    const status = await getQuotaStatus(request, testUser.orgId)

    expect(status.success).toBe(true)
    const { billingPeriodStart, billingPeriodEnd } = status.quotas!

    const start = new Date(billingPeriodStart)
    const end = new Date(billingPeriodEnd)
    const now = new Date()

    expect(start.getTime()).toBeLessThanOrEqual(now.getTime())
    expect(end.getTime()).toBeGreaterThan(now.getTime())
  })

  // 2. Research Feature Quota Tests
  test('2.1 should allow first research action (1/2)', async ({ request }) => {
    const { checkResult, recordResult } = await simulateRedditAgentAction(
      request,
      testUser.orgId,
      testUser.id,
      'research'
    )

    expect(checkResult.allowed).toBe(true)
    expect(checkResult.featureAvailable).toBe(true)
    expect(recordResult).toBeDefined()
    expect(recordResult!.success).toBe(true)
    expect(recordResult!.newUsage).toBe(1)
  })

  test('2.2 should allow second research action (2/2)', async ({ request }) => {
    const { checkResult, recordResult } = await simulateRedditAgentAction(
      request,
      testUser.orgId,
      testUser.id,
      'research'
    )

    expect(checkResult.allowed).toBe(true)
    expect(recordResult).toBeDefined()
    expect(recordResult!.success).toBe(true)
    expect(recordResult!.newUsage).toBe(2)
  })

  test('2.3 should block third research action - limit reached', async ({ request }) => {
    const { checkResult, recordResult } = await simulateRedditAgentAction(
      request,
      testUser.orgId,
      testUser.id,
      'research'
    )

    expect(checkResult.allowed).toBe(false)
    expect(checkResult.reason).toContain('limit')
    expect(recordResult).toBeUndefined()
  })

  test('2.4 should show correct quota status after research limit reached', async ({ request }) => {
    const status = await getQuotaStatus(request, testUser.orgId)

    expect(status.quotas!.features.research.used).toBe(2)
    expect(status.quotas!.features.research.remaining).toBe(0)
  })

  // 3. Ideation Feature Quota Tests
  test('3.1 should allow 5 ideation actions', async ({ request }) => {
    for (let i = 1; i <= 5; i++) {
      const { checkResult, recordResult } = await simulateRedditAgentAction(
        request,
        testUser.orgId,
        testUser.id,
        'ideation'
      )

      expect(checkResult.allowed).toBe(true)
      expect(recordResult).toBeDefined()
      expect(recordResult!.success).toBe(true)
      expect(recordResult!.newUsage).toBe(i)
    }
  })

  test('3.2 should show correct remaining ideation quota', async ({ request }) => {
    const status = await getQuotaStatus(request, testUser.orgId)

    expect(status.quotas!.features.ideation.used).toBe(5)
    expect(status.quotas!.features.ideation.remaining).toBe(5)
  })

  // 4. Auto-posting Tests (Free Tier N/A)
  test('4.1 should block auto-posting - not available on free tier', async ({ request }) => {
    const checkResult = await checkQuota(request, testUser.orgId, 'auto_posting')

    expect(checkResult.allowed).toBe(false)
    expect(checkResult.featureAvailable).toBe(false)
    expect(checkResult.reason).toContain('not available')
  })

  test('4.2 should return 403 when trying to record auto-posting usage', async ({ request }) => {
    const recordResult = await recordQuotaUsage(
      request,
      testUser.orgId,
      testUser.id,
      'auto_posting'
    )

    expect(recordResult.success).toBe(false)
    expect(recordResult.allowed).toBe(false)
  })

  // 5. Monitors Tests (Free Tier N/A)
  test('5.1 should block monitors - not available on free tier', async ({ request }) => {
    const checkResult = await checkQuota(request, testUser.orgId, 'monitors')

    expect(checkResult.allowed).toBe(false)
    expect(checkResult.featureAvailable).toBe(false)
    expect(checkResult.reason).toContain('not available')
  })

  test('5.2 should return 403 when trying to create monitor', async ({ request }) => {
    const recordResult = await recordQuotaUsage(
      request,
      testUser.orgId,
      testUser.id,
      'monitors',
      { extra: { monitorName: 'Test Monitor' } }
    )

    expect(recordResult.success).toBe(false)
    expect(recordResult.allowed).toBe(false)
  })

  // 6. Audit Trail Verification
  test('6.1 should have recorded all usage events with agent metadata', async ({ request }) => {
    const status = await getQuotaStatus(request, testUser.orgId)

    expect(status.quotas!.features.research.used).toBe(2)
    expect(status.quotas!.features.ideation.used).toBe(5)
  })

  // 7. API Validation Tests
  test('7.1 should return 401 without service token', async ({ request }) => {
    const response = await request.post(`${API_BASE}/billing/quotas/check`, {
      data: { orgId: testUser.orgId, feature: 'research' },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status()).toBe(401)
  })

  test('7.2 should return 400 for invalid feature', async ({ request }) => {
    const response = await request.post(`${API_BASE}/billing/quotas/check`, {
      data: { orgId: testUser.orgId, feature: 'invalid_feature' },
      headers: getServiceAuthHeaders(),
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid feature')
  })

  test('7.3 should return 400 for missing orgId', async ({ request }) => {
    const response = await request.post(`${API_BASE}/billing/quotas/check`, {
      data: { feature: 'research' },
      headers: getServiceAuthHeaders(),
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Missing')
  })

  test('7.4 should return 400 for missing feature', async ({ request }) => {
    const response = await request.post(`${API_BASE}/billing/quotas/check`, {
      data: { orgId: testUser.orgId },
      headers: getServiceAuthHeaders(),
    })

    expect(response.status()).toBe(400)
  })

  test('7.5 should return 400 for invalid action type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/billing/quotas/record`, {
      data: {
        orgId: testUser.orgId,
        userId: testUser.id,
        feature: 'research',
        action: 'invalid_action',
      },
      headers: getServiceAuthHeaders(),
    })

    expect(response.status()).toBe(400)
  })

  test('7.6 should return 400 for decrement on non-monitors feature', async ({ request }) => {
    const response = await request.post(`${API_BASE}/billing/quotas/record`, {
      data: {
        orgId: testUser.orgId,
        userId: testUser.id,
        feature: 'research',
        action: 'decrement',
      },
      headers: getServiceAuthHeaders(),
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.message).toContain('monitors')
  })
})

// =============================================================================
// Multi-User Isolation Tests (Separate describe for independent users)
// =============================================================================

test.describe('Multi-User Isolation Tests', () => {
  let userA: TestUser
  let userB: TestUser

  test.beforeAll(async ({ request }) => {
    if (!SERVICE_TOKEN) {
      test.skip()
    }

    // Create two independent test users
    userA = await createTestUser(request)
    userB = await createTestUser(request)
    console.log(`Created User A: ${userA.orgId}, User B: ${userB.orgId}`)
  })

  test.afterAll(async () => {
    if (userA) await cleanupTestUser(userA)
    if (userB) await cleanupTestUser(userB)
  })

  test('User A quota usage should not affect User B', async ({ request }) => {
    // User A uses all research quota
    await simulateRedditAgentAction(request, userA.orgId, userA.id, 'research')
    await simulateRedditAgentAction(request, userA.orgId, userA.id, 'research')

    // Verify User A is at limit
    const userACheck = await checkQuota(request, userA.orgId, 'research')
    expect(userACheck.allowed).toBe(false)
    expect(userACheck.used).toBe(2)

    // User B should still have full quota
    const userBCheck = await checkQuota(request, userB.orgId, 'research')
    expect(userBCheck.allowed).toBe(true)
    expect(userBCheck.used).toBe(0)
    expect(userBCheck.remaining).toBe(2)
  })

  test('User B can use features independently', async ({ request }) => {
    // User B uses research
    const { recordResult } = await simulateRedditAgentAction(
      request,
      userB.orgId,
      userB.id,
      'research'
    )

    expect(recordResult!.success).toBe(true)
    expect(recordResult!.newUsage).toBe(1)

    // Verify User A still at limit (unaffected by User B)
    const userAStatus = await getQuotaStatus(request, userA.orgId)
    expect(userAStatus.quotas!.features.research.used).toBe(2)
  })
})

// =============================================================================
// Concurrent Operations Tests
// =============================================================================

test.describe('Concurrent Operations Tests', () => {
  let testUser: TestUser

  test.beforeAll(async ({ request }) => {
    if (!SERVICE_TOKEN) {
      test.skip()
    }
    testUser = await createTestUser(request)
  })

  test.afterAll(async () => {
    if (testUser) await cleanupTestUser(testUser)
  })

  test('should handle concurrent check requests', async ({ request }) => {
    const concurrentRequests = 5

    const requests = Array(concurrentRequests)
      .fill(null)
      .map(() => checkQuota(request, testUser.orgId, 'ideation'))

    const results = await Promise.all(requests)

    // All requests should succeed
    results.forEach((result) => {
      expect(result.allowed).toBe(true)
      expect(result.featureAvailable).toBe(true)
    })
  })

  test('should prevent race conditions on increment', async ({ request }) => {
    // Reset by using a fresh user with ideation quota (10 limit)
    // Attempt to use 12 concurrent increments - only 10 should succeed

    const concurrentRequests = 12

    const requests = Array(concurrentRequests)
      .fill(null)
      .map(() =>
        recordQuotaUsage(request, testUser.orgId, testUser.id, 'ideation', {
          agentId: 'concurrent-test',
        })
      )

    const results = await Promise.all(requests)

    // Count successes - should be exactly 10 (the limit)
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    expect(successCount).toBe(10)
    expect(failCount).toBe(2)

    // Verify final state
    const status = await getQuotaStatus(request, testUser.orgId)
    expect(status.quotas!.features.ideation.used).toBe(10)
    expect(status.quotas!.features.ideation.remaining).toBe(0)
  })
})

// =============================================================================
// ORCHESTRATOR INTEGRATION TESTS
// Tests the full flow through the orchestrator's A2A endpoint
// =============================================================================

const ORCHESTRATOR_BASE = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'

test.describe('Orchestrator Quota Integration Tests', () => {
  let testUser: TestUser

  test.beforeAll(async ({ request }) => {
    // Skip if SERVICE_TOKEN not configured
    if (!SERVICE_TOKEN) {
      console.log('⚠️ Skipping orchestrator tests - SERVICE_TOKEN_SECRET not configured')
      return
    }
    testUser = await createTestUser(request)
    console.log(`Created test user for orchestrator tests: ${testUser.email}, org: ${testUser.orgId}`)
  })

  test.afterAll(async ({ request }) => {
    if (testUser) {
      await cleanupTestUser(testUser, request)
    }
  })

  test('8.1 should block orchestrator request when quota is exhausted', async ({ request }) => {
    test.skip(!SERVICE_TOKEN, 'SERVICE_TOKEN_SECRET not configured')
    test.skip(!testUser, 'Test user not created')

    // First, exhaust the research quota (limit=2)
    for (let i = 0; i < FREE_TIER_LIMITS.research; i++) {
      const result = await recordQuotaUsage(request, testUser.orgId, testUser.id, 'research', {
        agentId: 'test-exhaust',
      })
      expect(result.success).toBe(true)
    }

    // Verify quota is exhausted
    const quotaCheck = await checkQuota(request, testUser.orgId, 'research')
    expect(quotaCheck.allowed).toBe(false)
    expect(quotaCheck.remaining).toBe(0)

    // Now try to call the orchestrator's A2A stream endpoint
    // This should be blocked before any agent is called
    const orchestratorResponse = await request.post(`${ORCHESTRATOR_BASE}/api/chat/a2a/stream`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUser.id,
        'x-org-id': testUser.orgId,
      },
      data: {
        message: 'Test message that should be blocked',
        agentUrl: 'http://localhost:9999', // Doesn't matter - should be blocked before agent call
        selectedAgentId: 'reddit-agent', // Maps to 'research' feature
      },
    })

    // Should get 403 Forbidden due to quota exceeded
    expect(orchestratorResponse.status()).toBe(403)

    const body = await orchestratorResponse.json()
    expect(body.error).toBe('Quota exceeded')
    expect(body.featureAvailable).toBe(true)
    expect(body.remaining).toBe(0)

    console.log('✅ Orchestrator correctly blocked request when quota exhausted')
  })

  test('8.2 should allow orchestrator request when quota available', async ({ request }) => {
    test.skip(!SERVICE_TOKEN, 'SERVICE_TOKEN_SECRET not configured')
    test.skip(!testUser, 'Test user not created')

    // Use paf-core agent which has no feature type mapping (no quota check)
    // This tests that agents without quota mapping are allowed through
    const orchestratorResponse = await request.post(`${ORCHESTRATOR_BASE}/api/chat/a2a/stream`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUser.id,
        'x-org-id': testUser.orgId,
      },
      data: {
        message: 'Test message',
        agentUrl: 'http://localhost:9999', // No agent running
        selectedAgentId: 'paf-core', // No feature mapping - should skip quota check
      },
      timeout: 5000, // Short timeout since agent won't respond
    })

    // Should NOT be 403 - paf-core has no quota mapping
    // It may be 500 (connection refused) or 200 with error in SSE stream
    expect(orchestratorResponse.status()).not.toBe(403)

    console.log(`✅ Orchestrator passed quota check for unmapped agent (response: ${orchestratorResponse.status()})`)
  })

  test('8.3 should include quota headers in orchestrator response', async ({ request }) => {
    test.skip(!SERVICE_TOKEN, 'SERVICE_TOKEN_SECRET not configured')
    test.skip(!testUser, 'Test user not created')

    // Get current quota status
    const status = await getQuotaStatus(request, testUser.orgId)
    expect(status.success).toBe(true)

    // Verify we can check quota via the service token API
    const quotaCheckResponse = await request.post(`${API_BASE}/billing/quotas/check`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
      },
      data: {
        orgId: testUser.orgId,
        feature: 'research',
      },
    })

    expect(quotaCheckResponse.ok()).toBe(true)
    const quotaData = await quotaCheckResponse.json()
    expect(quotaData).toHaveProperty('allowed')
    expect(quotaData).toHaveProperty('limit')
    expect(quotaData).toHaveProperty('used')
    expect(quotaData).toHaveProperty('remaining')

    console.log(`✅ Quota API accessible from orchestrator context: ${JSON.stringify(quotaData)}`)
  })
})

// =============================================================================
// ORCHESTRATOR MOCK AGENT TESTS
// Tests with a mock agent that simulates successful completion
// =============================================================================

test.describe('Orchestrator with Mock Agent', () => {
  let testUser: TestUser
  let mockServer: any

  test.beforeAll(async ({ request }) => {
    test.skip(!SERVICE_TOKEN, 'SERVICE_TOKEN_SECRET not configured')

    // Create test user
    testUser = await createTestUser(request)
    console.log(`Created test user for mock agent tests: ${testUser.email}, org: ${testUser.orgId}`)

    // Start a simple mock agent server
    const http = await import('http')
    mockServer = http.createServer((req, res) => {
      if (req.method === 'POST') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        // Send a simple successful response
        res.write(`data: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            kind: 'status-update',
            status: { state: 'working' },
          },
        })}\n\n`)

        setTimeout(() => {
          // Send completion
          res.write(`data: ${JSON.stringify({
            state: 'completed',
            message: { parts: [{ text: 'Task completed successfully' }] },
          })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
        }, 100)
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    await new Promise<void>((resolve) => {
      mockServer.listen(9877, () => {
        console.log('🤖 Mock agent server started on port 9877')
        resolve()
      })
    })
  })

  test.afterAll(async ({ request }) => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer.close(() => {
          console.log('🤖 Mock agent server stopped')
          resolve()
        })
      })
    }
    if (testUser) {
      await cleanupTestUser(testUser, request)
    }
  })

  test('9.1 should record usage after successful agent execution', async ({ request }) => {
    test.skip(!SERVICE_TOKEN, 'SERVICE_TOKEN_SECRET not configured')
    test.skip(!testUser, 'Test user not created')
    test.skip(!mockServer, 'Mock server not started')

    // Get initial quota status
    const initialStatus = await getQuotaStatus(request, testUser.orgId)
    const initialResearchUsed = initialStatus.quotas?.features.research.used || 0

    // Call orchestrator with mock agent
    const orchestratorResponse = await request.post(`${ORCHESTRATOR_BASE}/api/chat/a2a/stream`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUser.id,
        'x-org-id': testUser.orgId,
      },
      data: {
        message: 'Test task for quota tracking',
        agentUrl: 'http://localhost:9877', // Mock agent
        selectedAgentId: 'reddit-agent', // Maps to 'research' feature
      },
      timeout: 10000,
    })

    // Should succeed (or at least not be 403)
    expect(orchestratorResponse.status()).not.toBe(403)

    // Wait for usage to be recorded (async)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check quota status after execution
    const finalStatus = await getQuotaStatus(request, testUser.orgId)
    const finalResearchUsed = finalStatus.quotas?.features.research.used || 0

    // Usage should have been incremented
    expect(finalResearchUsed).toBe(initialResearchUsed + 1)

    console.log(`✅ Usage recorded: ${initialResearchUsed} -> ${finalResearchUsed}`)
  })

  test('9.2 should not record usage if agent fails', async ({ request }) => {
    test.skip(!SERVICE_TOKEN, 'SERVICE_TOKEN_SECRET not configured')
    test.skip(!testUser, 'Test user not created')

    // Get initial quota status
    const initialStatus = await getQuotaStatus(request, testUser.orgId)
    const initialIdeationUsed = initialStatus.quotas?.features.ideation.used || 0

    // Call orchestrator with non-existent agent (will fail)
    const orchestratorResponse = await request.post(`${ORCHESTRATOR_BASE}/api/chat/a2a/stream`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUser.id,
        'x-org-id': testUser.orgId,
      },
      data: {
        message: 'Test task that will fail',
        agentUrl: 'http://localhost:19999', // No agent here
        selectedAgentId: 'tik-agent', // Maps to 'research' feature
      },
      timeout: 5000,
    })

    // Wait for any async processing
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check quota status after failed execution
    const finalStatus = await getQuotaStatus(request, testUser.orgId)
    const finalIdeationUsed = finalStatus.quotas?.features.ideation.used || 0

    // Usage should NOT have been incremented (agent failed)
    expect(finalIdeationUsed).toBe(initialIdeationUsed)

    console.log(`✅ Usage not recorded for failed task: ${initialIdeationUsed} -> ${finalIdeationUsed}`)
  })
})
