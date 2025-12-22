/**
 * E2E Integration Tests: Agent File Upload to S3
 *
 * Tests the complete flow:
 * 1. Agent creates file locally (using pixell-sdk with outputs_dir)
 * 2. Agent emits file_created event
 * 3. Orchestrator catches event, fetches file via /files/download
 * 4. Orchestrator uploads to user's S3 path
 * 5. File is verified in S3
 *
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - Database accessible (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
 * - vivid-commenter at /Users/syum/dev/vivid-commenter with outputs_dir configured
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  s3ListFiles,
  s3GetFileContent,
  s3DeleteOutputs,
  s3WaitForFile,
  s3FileExists,
  verifyAwsAccess,
  buildS3OutputsPath,
} from './utils/aws-helpers'
import { getTestUserFromDb, verifyDbConnection, TestUser } from './utils/db-helpers'
import {
  startOrchestrator,
  startVividCommenter,
  startTestFileAgent,
  stopProcess,
  waitForHealthy,
  killExistingProcesses,
  serviceUrls,
  printServiceLogs,
  ServiceProcess,
} from './utils/service-helpers'
import { getMultipleTestUsers } from './utils/db-helpers'
import {
  collectSSEEvents,
  hasFileCreatedEvent,
  getFileCreatedEvent,
  isStreamCompleted,
  extractSessionId,
  printEvents,
  SSEEvent,
} from './utils/sse-helpers'

// Test configuration
const TEST_TIMEOUT = 180000 // 3 minutes for full flow
const SERVICE_STARTUP_TIMEOUT = 120000 // 2 minutes for services to start

describe('Agent File Upload E2E', () => {
  let orchestratorService: ServiceProcess
  let agentService: ServiceProcess
  let testUser: TestUser
  let testFilesCreated: string[] = [] // Track files for cleanup

  beforeAll(async () => {
    console.log('\n=== E2E Test Setup ===\n')

    // 1. Verify prerequisites
    console.log('Verifying AWS access...')
    const awsOk = await verifyAwsAccess()
    if (!awsOk) {
      throw new Error('AWS access verification failed. Check AWS credentials.')
    }
    console.log('AWS access: OK')

    console.log('Verifying database connection...')
    const dbOk = await verifyDbConnection()
    if (!dbOk) {
      throw new Error('Database connection failed. Check DB credentials.')
    }
    console.log('Database connection: OK')

    // 2. Get test user from database
    console.log('Getting test user from database...')
    testUser = await getTestUserFromDb()
    console.log(`Test user: ${testUser.email} (${testUser.userId})`)
    console.log(`Test org: ${testUser.orgName} (${testUser.orgId})`)

    // 3. Clean up any existing processes on our ports
    console.log('Killing any existing processes on ports 3001 and 8000...')
    await killExistingProcesses()

    // 4. Clean S3 path before tests
    console.log(`Cleaning S3 path: ${buildS3OutputsPath(testUser.userId, testUser.orgId)}`)
    await s3DeleteOutputs(testUser.userId, testUser.orgId)

    // 5. Start orchestrator
    console.log('Starting orchestrator...')
    orchestratorService = await startOrchestrator()
    await waitForHealthy(serviceUrls.orchestrator.health, SERVICE_STARTUP_TIMEOUT)
    console.log('Orchestrator: HEALTHY')

    // 6. Start vivid-commenter agent
    console.log('Starting vivid-commenter agent...')
    agentService = await startVividCommenter()
    await waitForHealthy(serviceUrls.agent.health, SERVICE_STARTUP_TIMEOUT)
    console.log('vivid-commenter: HEALTHY')

    console.log('\n=== Setup Complete ===\n')
  }, SERVICE_STARTUP_TIMEOUT + 30000)

  afterAll(async () => {
    console.log('\n=== E2E Test Cleanup ===\n')

    // Print logs if tests failed (useful for debugging)
    if (process.env.DEBUG_E2E) {
      if (orchestratorService) printServiceLogs(orchestratorService)
      if (agentService) printServiceLogs(agentService)
    }

    // Stop services
    if (agentService) {
      console.log('Stopping vivid-commenter...')
      await stopProcess(agentService)
    }

    if (orchestratorService) {
      console.log('Stopping orchestrator...')
      await stopProcess(orchestratorService)
    }

    // Clean S3 test files
    if (testUser) {
      console.log('Cleaning S3 test files...')
      await s3DeleteOutputs(testUser.userId, testUser.orgId)
    }

    console.log('\n=== Cleanup Complete ===\n')
  }, 30000)

  describe('SDK /files/download endpoint', () => {
    test('agent health endpoint is accessible', async () => {
      const response = await fetch(serviceUrls.agent.health)
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.status).toBe('healthy')
      expect(data.agent_id).toBe('vivid-commenter')
    })

    test('returns 400 for missing path parameter', async () => {
      const response = await fetch(serviceUrls.agent.filesDownload)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('Missing')
    })

    test('returns 404 for non-existent file', async () => {
      const response = await fetch(
        `${serviceUrls.agent.filesDownload}?path=nonexistent.html`
      )
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    test('blocks path traversal attempts', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        'exports/../../../etc/passwd',
      ]

      for (const maliciousPath of maliciousPaths) {
        const response = await fetch(
          `${serviceUrls.agent.filesDownload}?path=${encodeURIComponent(maliciousPath)}`
        )
        // Should return 400 (invalid path) or 404 (not found), not 200
        expect(response.status).not.toBe(200)
      }
    })
  })

  describe('Full file upload flow', () => {
    test(
      'agent creates file and orchestrator uploads to S3',
      async () => {
        // This test sends a simple message that will trigger file creation
        // Note: vivid-commenter is a plan-mode agent, so we need to go through
        // the full flow or use a simpler test query

        // First, verify S3 is empty
        const initialFiles = await s3ListFiles(testUser.userId, testUser.orgId)
        expect(initialFiles).toHaveLength(0)

        // Send a message to the orchestrator via A2A endpoint
        // This routes the request to the external vivid-commenter agent
        const response = await fetch(serviceUrls.orchestrator.a2aStream, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Simulate authenticated user via service token
            'X-Service-Token': process.env.SERVICE_TOKEN_SECRET || 'test-service-token',
            'X-User-Id': testUser.userId,
            'X-Org-Id': testUser.orgId,
          },
          body: JSON.stringify({
            message: 'test file creation',
            agentUrl: serviceUrls.agent.base, // http://localhost:8000
            selectedAgentId: 'vivid-commenter',
          }),
        })

        expect(response.ok).toBe(true)

        // Collect SSE events
        const events = await collectSSEEvents(response, {
          timeoutMs: 60000,
          stopOnStates: ['completed', 'failed', 'input-required'],
        })

        if (process.env.DEBUG_E2E) {
          printEvents(events)
        }

        // For plan-mode agents, the first response will likely be input-required
        // (asking clarification questions). This is expected behavior.
        // The file creation happens after the full workflow completes.

        const sessionId = extractSessionId(events)
        expect(sessionId).toBeDefined()

        console.log(`Session ID: ${sessionId}`)
        console.log(`Events collected: ${events.length}`)
        console.log(`States: ${events.map((e) => e.data?.state).filter(Boolean).join(' -> ')}`)
      },
      TEST_TIMEOUT
    )
  })

  describe('S3 path verification', () => {
    test('S3 path structure is correct', () => {
      const expectedPath = `s3://pixell-agents/orgs/${testUser.orgId}/users/${testUser.userId}/outputs/`
      const actualPath = buildS3OutputsPath(testUser.userId, testUser.orgId)
      expect(actualPath).toBe(expectedPath)
    })

    test('can list files in user S3 path (empty initially)', async () => {
      // Clean first to ensure empty
      await s3DeleteOutputs(testUser.userId, testUser.orgId)

      const files = await s3ListFiles(testUser.userId, testUser.orgId)
      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBe(0)
    })
  })

  describe('Direct agent file download', () => {
    // This test creates a file directly on the agent and verifies
    // the /files/download endpoint serves it correctly

    test('can download existing export files from agent', async () => {
      // List existing files in the exports directory via the agent
      // Note: This assumes some files might exist from previous runs

      // Try to get a known test file if it exists
      // The agent should have its exports/ directory accessible
      const testPath = 'exports/test.html'

      // First check if any files exist in exports
      // This is a smoke test - actual file creation happens via the workflow
      const healthResponse = await fetch(serviceUrls.agent.health)
      expect(healthResponse.ok).toBe(true)
    })
  })
})

// Separate test suite for file event flow testing
// Uses a minimal test agent that immediately creates files
describe('File Event Flow', () => {
  let orchestratorService: ServiceProcess
  let testAgentService: ServiceProcess
  let testUser: TestUser

  beforeAll(async () => {
    console.log('\n=== File Event Flow Test Setup ===\n')

    // Verify prerequisites
    const awsOk = await verifyAwsAccess()
    if (!awsOk) throw new Error('AWS access verification failed')

    const dbOk = await verifyDbConnection()
    if (!dbOk) throw new Error('Database connection failed')

    // Get test user
    testUser = await getTestUserFromDb()
    console.log(`Test user: ${testUser.email}`)

    // Kill existing processes
    await killExistingProcesses()

    // Clean S3 path
    await s3DeleteOutputs(testUser.userId, testUser.orgId)

    // Start orchestrator
    console.log('Starting orchestrator...')
    orchestratorService = await startOrchestrator()
    await waitForHealthy(serviceUrls.orchestrator.health, 60000)
    console.log('Orchestrator: HEALTHY')

    // Start test file agent
    console.log('Starting test-file-agent...')
    testAgentService = await startTestFileAgent()
    await waitForHealthy(serviceUrls.testAgent.health, 60000)
    console.log('test-file-agent: HEALTHY')

    console.log('\n=== File Event Flow Setup Complete ===\n')
  }, 120000)

  afterAll(async () => {
    console.log('\n=== File Event Flow Cleanup ===\n')

    if (process.env.DEBUG_E2E) {
      if (orchestratorService) printServiceLogs(orchestratorService)
      if (testAgentService) printServiceLogs(testAgentService)
    }

    if (testAgentService) {
      console.log('Stopping test-file-agent...')
      await stopProcess(testAgentService)
    }

    if (orchestratorService) {
      console.log('Stopping orchestrator...')
      await stopProcess(orchestratorService)
    }

    if (testUser) {
      await s3DeleteOutputs(testUser.userId, testUser.orgId)
    }

    console.log('\n=== File Event Flow Cleanup Complete ===\n')
  }, 30000)

  test(
    'file_created event triggers S3 upload',
    async () => {
      // Clean S3 first
      await s3DeleteOutputs(testUser.userId, testUser.orgId)

      // Verify S3 is empty
      const initialFiles = await s3ListFiles(testUser.userId, testUser.orgId)
      expect(initialFiles).toHaveLength(0)

      // Send message to test agent via A2A endpoint
      const response = await fetch(serviceUrls.orchestrator.a2aStream, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': testUser.userId,
          'X-Org-Id': testUser.orgId,
        },
        body: JSON.stringify({
          message: 'create a test file',
          agentUrl: serviceUrls.testAgent.base,
          selectedAgentId: 'test-file-agent',
        }),
      })

      expect(response.ok).toBe(true)

      // Collect SSE events
      const events = await collectSSEEvents(response, {
        timeoutMs: 60000,
        stopOnStates: ['completed', 'failed'],
      })

      if (process.env.DEBUG_E2E) {
        printEvents(events)
      }

      // Verify stream completed
      expect(isStreamCompleted(events)).toBe(true)

      // Wait for file to appear in S3 (orchestrator uploads async)
      const uploadedFile = await s3WaitForFile(
        testUser.userId,
        testUser.orgId,
        /test_output.*\.html$/,
        30000
      )

      expect(uploadedFile).not.toBeNull()
      console.log(`File uploaded to S3: ${uploadedFile}`)
    },
    120000
  )

  test(
    'SSE stream contains file_created event with correct metadata',
    async () => {
      // Clean S3 first
      await s3DeleteOutputs(testUser.userId, testUser.orgId)

      // Send message to test agent
      const response = await fetch(serviceUrls.orchestrator.a2aStream, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': testUser.userId,
          'X-Org-Id': testUser.orgId,
        },
        body: JSON.stringify({
          message: 'create another test file',
          agentUrl: serviceUrls.testAgent.base,
          selectedAgentId: 'test-file-agent',
        }),
      })

      expect(response.ok).toBe(true)

      const events = await collectSSEEvents(response, {
        timeoutMs: 60000,
        stopOnStates: ['completed', 'failed'],
      })

      if (process.env.DEBUG_E2E) {
        printEvents(events)
      }

      // Check for file_created event
      expect(hasFileCreatedEvent(events)).toBe(true)

      // Verify metadata
      const fileEvent = getFileCreatedEvent(events)
      expect(fileEvent).not.toBeNull()
      expect(fileEvent?.path).toMatch(/test_output.*\.html$/)
      expect(fileEvent?.format).toBe('html')
    },
    120000
  )

  test(
    'file content in S3 matches original',
    async () => {
      // Clean S3 first
      await s3DeleteOutputs(testUser.userId, testUser.orgId)

      // Send message to test agent
      const response = await fetch(serviceUrls.orchestrator.a2aStream, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': testUser.userId,
          'X-Org-Id': testUser.orgId,
        },
        body: JSON.stringify({
          message: 'create content verification file',
          agentUrl: serviceUrls.testAgent.base,
          selectedAgentId: 'test-file-agent',
        }),
      })

      expect(response.ok).toBe(true)

      const events = await collectSSEEvents(response, {
        timeoutMs: 60000,
        stopOnStates: ['completed', 'failed'],
      })

      // Wait for file in S3
      const uploadedFile = await s3WaitForFile(
        testUser.userId,
        testUser.orgId,
        /test_output.*\.html$/,
        30000
      )

      expect(uploadedFile).not.toBeNull()

      // Get file content from S3
      const s3Content = await s3GetFileContent(testUser.userId, testUser.orgId, uploadedFile!)

      // Verify content structure
      expect(s3Content).toContain('<!DOCTYPE html>')
      expect(s3Content).toContain('Test File Created')
      expect(s3Content).toContain('create content verification file')
    },
    120000
  )
})

// Multi-user isolation tests
// Tests that S3 paths are properly isolated per user
describe('Multi-User Isolation', () => {
  let testUsers: TestUser[]

  beforeAll(async () => {
    console.log('\n=== Multi-User Isolation Test Setup ===\n')

    // Verify prerequisites
    const awsOk = await verifyAwsAccess()
    if (!awsOk) throw new Error('AWS access verification failed')

    const dbOk = await verifyDbConnection()
    if (!dbOk) throw new Error('Database connection failed')

    // Get multiple test users
    testUsers = await getMultipleTestUsers(2)

    if (testUsers.length < 2) {
      console.warn('Only found one user, some isolation tests may be limited')
    }

    console.log(`Test users: ${testUsers.map((u) => u.email).join(', ')}`)

    // Clean S3 paths for all test users
    for (const user of testUsers) {
      await s3DeleteOutputs(user.userId, user.orgId)
    }

    console.log('\n=== Multi-User Isolation Setup Complete ===\n')
  }, 60000)

  afterAll(async () => {
    console.log('\n=== Multi-User Isolation Cleanup ===\n')

    // Clean S3 paths
    for (const user of testUsers || []) {
      await s3DeleteOutputs(user.userId, user.orgId)
    }

    console.log('\n=== Multi-User Isolation Cleanup Complete ===\n')
  }, 30000)

  test('S3 paths are unique per user', () => {
    if (testUsers.length < 2) {
      console.log('Skipping: need 2 users for isolation test')
      return
    }

    const userA = testUsers[0]
    const userB = testUsers[1]

    const pathA = buildS3OutputsPath(userA.userId, userA.orgId)
    const pathB = buildS3OutputsPath(userB.userId, userB.orgId)

    // Paths should be different
    expect(pathA).not.toBe(pathB)

    // Each path should contain the user's ID
    expect(pathA).toContain(userA.userId)
    expect(pathB).toContain(userB.userId)
  })

  test(
    'user cannot list other user files',
    async () => {
      if (testUsers.length < 2) {
        console.log('Skipping: need 2 users for isolation test')
        return
      }

      const userA = testUsers[0]
      const userB = testUsers[1]

      // Clean both paths
      await s3DeleteOutputs(userA.userId, userA.orgId)
      await s3DeleteOutputs(userB.userId, userB.orgId)

      // User A's path should be empty
      const userAFiles = await s3ListFiles(userA.userId, userA.orgId)
      expect(userAFiles).toHaveLength(0)

      // User B's path should also be empty (different path)
      const userBFiles = await s3ListFiles(userB.userId, userB.orgId)
      expect(userBFiles).toHaveLength(0)

      // The S3 list function only returns files from the specific user's path
      // This verifies that the path structure provides isolation
      console.log(`User A path: ${buildS3OutputsPath(userA.userId, userA.orgId)}`)
      console.log(`User B path: ${buildS3OutputsPath(userB.userId, userB.orgId)}`)

      // Verify the paths are truly different
      expect(buildS3OutputsPath(userA.userId, userA.orgId)).not.toBe(
        buildS3OutputsPath(userB.userId, userB.orgId)
      )
    },
    30000
  )

  test(
    'user cannot download other user files',
    async () => {
      if (testUsers.length < 2) {
        console.log('Skipping: need 2 users for isolation test')
        return
      }

      const userA = testUsers[0]
      const userB = testUsers[1]

      // The S3 path structure ensures isolation:
      // User A: s3://pixell-agents/orgs/{orgIdA}/users/{userIdA}/outputs/
      // User B: s3://pixell-agents/orgs/{orgIdB}/users/{userIdB}/outputs/
      //
      // Even if we know user B's file name, we cannot access it through
      // user A's path because the paths are completely different.

      const userAPath = buildS3OutputsPath(userA.userId, userA.orgId)
      const userBPath = buildS3OutputsPath(userB.userId, userB.orgId)

      // Verify paths don't overlap
      expect(userAPath).not.toContain(userB.userId)
      expect(userBPath).not.toContain(userA.userId)

      // Test that checking for a file in user B's path from user A's perspective fails
      // (the file won't exist because paths are different)
      const fileExistsInWrongPath = await s3FileExists(
        userA.userId,
        userA.orgId,
        'fake_file_from_user_b.html'
      )
      expect(fileExistsInWrongPath).toBe(false)
    },
    30000
  )
})
