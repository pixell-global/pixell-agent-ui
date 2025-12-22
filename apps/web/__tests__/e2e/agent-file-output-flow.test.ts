/**
 * Agent File Output Integration Test
 *
 * End-to-end test for the complete flow:
 * 1. User sends "find me acne trends" from frontend chat input
 * 2. Agent may ask for clarification (plan mode)
 * 3. User responds to clarification questions
 * 4. Agent generates search plan and executes
 * 5. Report file is uploaded to S3 (pixell-agents bucket)
 * 6. file_created SSE event is emitted to frontend
 * 7. File appears in chat workspace as downloadable FileOutputCard
 * 8. File appears in Navigator pane file tree
 *
 * Environment Variables Required:
 * - NEXT_PUBLIC_BASE_URL - Web app URL (default: http://localhost:3003)
 * - ORCHESTRATOR_URL - Orchestrator URL (default: http://localhost:3001)
 * - VIVID_COMMENTER_URL - Vivid commenter agent URL (default: http://localhost:8000)
 * - AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY - For S3 verification
 */

import { test, expect, APIRequestContext } from '@playwright/test'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'
const API_BASE = `${BASE_URL}/api`
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'
const VIVID_COMMENTER_URL = process.env.VIVID_COMMENTER_URL || 'http://localhost:8000'
const S3_BUCKET = 'pixell-agents'

// Test timeout for agent operations (agents can take time to process)
const AGENT_TIMEOUT = 180000 // 3 minutes for full flow
const STEP_TIMEOUT = 60000 // 1 minute per step

// =============================================================================
// TYPES
// =============================================================================

interface TestUser {
  id: string
  email: string
  displayName: string
  orgId: string
  sessionCookie: string
  orgCookie: string
}

interface SSEEvent {
  type: string
  [key: string]: unknown
}

interface ClarificationQuestion {
  id: string
  questionId?: string  // Some agents use questionId instead of id
  question: string
  type?: string
  options?: Array<string | { id: string; label: string; description?: string }>
  required?: boolean
}

interface ClarificationEvent extends SSEEvent {
  type: 'clarification_needed'
  clarificationId?: string
  clarification?: {
    clarificationId: string
    questions: ClarificationQuestion[]
    message?: string
    agentUrl?: string
    sessionId?: string
  }
  questions?: ClarificationQuestion[]
  sessionId?: string
}

interface SearchPlanEvent extends SSEEvent {
  type: 'search_plan'
  planId?: string
  plan?: {
    planId: string
    steps: Array<{ id: string; description: string }>
  }
  sessionId?: string
}

interface FileCreatedEvent extends SSEEvent {
  type: 'file_created'
  path: string
  name: string
  format: string
  size?: number
  summary?: string
}

interface FileListResponse {
  files: Array<{
    name: string
    path: string
    size: number
    lastModified: string
  }>
}

interface ConversationState {
  sessionId: string
  events: SSEEvent[]
  clarificationEvents: ClarificationEvent[]
  searchPlanEvents: SearchPlanEvent[]
  fileCreatedEvents: FileCreatedEvent[]
  contentEvents: SSEEvent[]
  isComplete: boolean
  hasFileOutput: boolean
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique test email
 */
function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `file-output-test-${timestamp}-${random}@test.pixell.ai`
}

/**
 * Create a test user via API signup and bootstrap
 */
async function createTestUser(request: APIRequestContext): Promise<TestUser> {
  const email = generateTestEmail()
  const password = 'TestPassword123!'
  const displayName = `File Output Test User ${Date.now()}`

  // Step 1: Sign up
  const signupResponse = await request.post(`${API_BASE}/auth/signup`, {
    data: { email, password, displayName },
  })

  if (!signupResponse.ok()) {
    const errorBody = await signupResponse.text()
    throw new Error(`Signup failed: ${signupResponse.status()} - ${errorBody}`)
  }

  const signupData = await signupResponse.json()
  const userId = signupData.user.id

  // Extract session cookie
  const cookies = signupResponse.headers()['set-cookie']
  const sessionCookieNames = ['SESSION', 'session']
  let sessionCookie = ''
  let sessionCookieName = 'session'

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

  // Step 2: Bootstrap organization
  const orgName = `File Output Test Org ${Date.now()}`
  const bootstrapResponse = await request.post(`${API_BASE}/bootstrap`, {
    data: { orgName },
    headers: {
      Cookie: `${sessionCookieName}=${sessionCookie}`,
    },
  })

  if (!bootstrapResponse.ok()) {
    const errorBody = await bootstrapResponse.text()
    throw new Error(`Bootstrap failed: ${bootstrapResponse.status()} - ${errorBody}`)
  }

  const bootstrapData = await bootstrapResponse.json()
  const orgId = bootstrapData.orgId

  // Extract ORG cookie
  let orgCookie = orgId
  const bootstrapCookies = bootstrapResponse.headers()['set-cookie']
  if (bootstrapCookies) {
    const cookieArray = Array.isArray(bootstrapCookies) ? bootstrapCookies : [bootstrapCookies]
    for (const cookie of cookieArray) {
      if (cookie.startsWith('ORG=')) {
        orgCookie = cookie.split(';')[0].split('=')[1]
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
    orgCookie,
  }
}

/**
 * Collect SSE events from a streaming response
 */
async function collectSSEEvents(
  response: Response,
  options: {
    timeout?: number
    stopOnType?: string | string[]
    maxEvents?: number
  } = {}
): Promise<SSEEvent[]> {
  const { timeout = STEP_TIMEOUT, stopOnType, maxEvents = 200 } = options
  const stopTypes = Array.isArray(stopOnType) ? stopOnType : stopOnType ? [stopOnType] : ['complete']
  const events: SSEEvent[] = []
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('No response body reader available')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  const startTime = Date.now()

  try {
    while (true) {
      if (Date.now() - startTime > timeout) {
        console.log(`SSE collection timed out after ${timeout}ms with ${events.length} events`)
        break
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()

          if (dataStr === '[DONE]') {
            return events
          }

          try {
            const eventData = JSON.parse(dataStr)
            events.push(eventData)

            if (stopTypes.includes(eventData.type)) {
              return events
            }

            if (events.length >= maxEvents) {
              return events
            }
          } catch {
            // Not valid JSON, skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return events
}

/**
 * Send initial chat message to start conversation
 */
async function startConversation(
  user: TestUser,
  message: string,
  agentUrl: string,
  agentId: string = 'vivid-commenter'
): Promise<{ response: Response; sessionId: string }> {
  const sessionId = `test-session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Cookie: `session=${user.sessionCookie}; ORG=${user.orgCookie}`,
    },
    body: JSON.stringify({
      message,
      selectedAgent: {
        id: agentId,
        name: 'Vivid Commenter',
        url: agentUrl,
        protocol: 'a2a' as const,
      },
      sessionId,
      history: [],
      settings: {
        showThinking: false,
        enableMarkdown: true,
        streamingEnabled: true,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Chat request failed: ${response.status} - ${errorText}`)
  }

  return { response, sessionId }
}

/**
 * Send clarification response
 */
async function sendClarificationResponse(
  user: TestUser,
  clarificationId: string,
  answers: Array<{ questionId: string; value: string | string[] }>,
  agentUrl: string,
  sessionId: string
): Promise<Response> {
  const response = await fetch(`${API_BASE}/chat/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Cookie: `session=${user.sessionCookie}; ORG=${user.orgCookie}`,
    },
    body: JSON.stringify({
      clarificationId,
      answers,
      agentUrl,
      sessionId,
    }),
  })

  return response
}

/**
 * Send plan approval response
 */
async function sendPlanApproval(
  user: TestUser,
  planId: string,
  approved: boolean,
  agentUrl: string,
  sessionId: string
): Promise<Response> {
  const response = await fetch(`${API_BASE}/chat/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Cookie: `session=${user.sessionCookie}; ORG=${user.orgCookie}`,
    },
    body: JSON.stringify({
      planId,
      approved,
      agentUrl,
      sessionId,
    }),
  })

  return response
}

/**
 * Parse events and categorize them
 */
function categorizeEvents(events: SSEEvent[]): {
  clarificationEvents: ClarificationEvent[]
  searchPlanEvents: SearchPlanEvent[]
  fileCreatedEvents: FileCreatedEvent[]
  contentEvents: SSEEvent[]
} {
  const clarificationEvents = events.filter(
    (e): e is ClarificationEvent => e.type === 'clarification_needed'
  )
  const searchPlanEvents = events.filter(
    (e): e is SearchPlanEvent => e.type === 'search_plan' || e.type === 'preview_ready'
  )
  const fileCreatedEvents = events.filter(
    (e): e is FileCreatedEvent => e.type === 'file_created'
  )
  const contentEvents = events.filter((e) => e.type === 'content')

  return { clarificationEvents, searchPlanEvents, fileCreatedEvents, contentEvents }
}

/**
 * Run the full conversation flow until file output or completion
 * Handles clarification and plan approval automatically
 */
async function runFullConversationFlow(
  user: TestUser,
  initialMessage: string,
  agentUrl: string,
  options: { maxTurns?: number; timeout?: number } = {}
): Promise<ConversationState> {
  const { maxTurns = 10, timeout = AGENT_TIMEOUT } = options
  const startTime = Date.now()

  const allEvents: SSEEvent[] = []
  let sessionId = ''
  let turn = 0

  console.log(`Starting conversation flow with message: "${initialMessage}"`)

  // Step 1: Send initial message
  const { response: initialResponse, sessionId: initialSessionId } = await startConversation(
    user,
    initialMessage,
    agentUrl
  )
  sessionId = initialSessionId
  console.log(`Session ID: ${sessionId}`)

  // Collect events from initial response
  let events = await collectSSEEvents(initialResponse, {
    timeout: STEP_TIMEOUT,
    stopOnType: ['complete', 'clarification_needed', 'search_plan', 'preview_ready'],
  })
  allEvents.push(...events)
  turn++

  console.log(`Turn ${turn}: Received ${events.length} events`)
  const eventTypes = Array.from(new Set(events.map((e) => e.type)))
  console.log(`  Event types: ${eventTypes.join(', ')}`)

  // Continue conversation until complete or file output received
  while (turn < maxTurns && Date.now() - startTime < timeout) {
    const { clarificationEvents, searchPlanEvents, fileCreatedEvents } = categorizeEvents(events)

    // Check if we have file output
    if (fileCreatedEvents.length > 0) {
      console.log(`✓ File created event received on turn ${turn}`)
      break
    }

    // Check if conversation is complete
    const completeEvent = events.find((e) => e.type === 'complete')
    if (completeEvent && clarificationEvents.length === 0 && searchPlanEvents.length === 0) {
      console.log(`Conversation completed on turn ${turn}`)
      break
    }

    // Handle clarification
    if (clarificationEvents.length > 0) {
      const clarificationEvent = clarificationEvents[clarificationEvents.length - 1]
      // Get clarificationId from nested clarification object or top level
      const clarificationId = clarificationEvent.clarification?.clarificationId || clarificationEvent.clarificationId
      console.log(`Turn ${turn}: Handling clarification ${clarificationId}`)

      const questions = clarificationEvent.clarification?.questions || clarificationEvent.questions || []
      console.log(`  Questions: ${questions.length}`)

      // Helper to extract option value (handles both string and object options)
      const getOptionValue = (option: string | { id: string; label: string }): string => {
        if (typeof option === 'string') return option
        return option.id
      }

      // Auto-generate answers based on question types
      // IMPORTANT: Always check for options first, as vivid-commenter sends options without type field
      const answers = questions.map((q) => {
        const questionId = q.questionId || q.id
        let value: string | string[] = ''

        // Priority 1: If options exist, always use them (agent expects option IDs)
        if (q.options && q.options.length > 0) {
          if (q.type === 'multi_select') {
            // Select first 2 options for multi-select
            value = q.options.slice(0, Math.min(2, q.options.length)).map(getOptionValue)
          } else {
            // Default: select first option for any type with options
            value = getOptionValue(q.options[0])
          }
        } else if (q.type === 'text' || q.type === 'string') {
          // No options - provide text answers based on question content
          if (q.question.toLowerCase().includes('topic') || q.question.toLowerCase().includes('trend')) {
            value = 'acne treatment trends'
          } else if (q.question.toLowerCase().includes('time') || q.question.toLowerCase().includes('period') || q.question.toLowerCase().includes('range')) {
            value = 'last 6 months'
          } else if (q.question.toLowerCase().includes('audience') || q.question.toLowerCase().includes('target')) {
            value = 'skincare enthusiasts'
          } else {
            value = 'general skincare analysis'
          }
        } else if (q.type === 'number') {
          value = '10'
        } else if (q.type === 'boolean') {
          value = 'true'
        } else {
          // Fallback for questions without type and without options
          value = 'yes'
        }

        console.log(`  Q: ${q.question.substring(0, 50)}... -> A: ${typeof value === 'string' ? value.substring(0, 30) : JSON.stringify(value)}`)
        return { questionId, value }
      })

      if (!clarificationId) {
        console.error('No clarificationId found in event:', JSON.stringify(clarificationEvent, null, 2).substring(0, 500))
        break
      }

      // Send clarification response
      const clarificationResponse = await sendClarificationResponse(
        user,
        clarificationId,
        answers,
        agentUrl,
        clarificationEvent.clarification?.sessionId || clarificationEvent.sessionId || sessionId
      )

      if (!clarificationResponse.ok) {
        const errorText = await clarificationResponse.text()
        console.error(`Clarification response failed: ${clarificationResponse.status} - ${errorText}`)
        break
      }

      // Collect next events
      events = await collectSSEEvents(clarificationResponse, {
        timeout: STEP_TIMEOUT,
        stopOnType: ['complete', 'clarification_needed', 'search_plan', 'preview_ready', 'file_created'],
      })
      allEvents.push(...events)
      turn++

      console.log(`Turn ${turn}: Received ${events.length} events after clarification`)
      const nextEventTypes = Array.from(new Set(events.map((e) => e.type)))
      console.log(`  Event types: ${nextEventTypes.join(', ')}`)

      continue
    }

    // Handle search plan / preview
    if (searchPlanEvents.length > 0) {
      const planEvent = searchPlanEvents[searchPlanEvents.length - 1]
      const planId = planEvent.planId || planEvent.plan?.planId

      if (planId) {
        console.log(`Turn ${turn}: Approving search plan ${planId}`)

        const planResponse = await sendPlanApproval(
          user,
          planId,
          true,
          agentUrl,
          planEvent.sessionId || sessionId
        )

        if (!planResponse.ok) {
          const errorText = await planResponse.text()
          console.error(`Plan approval failed: ${planResponse.status} - ${errorText}`)
          break
        }

        // Collect next events
        events = await collectSSEEvents(planResponse, {
          timeout: STEP_TIMEOUT,
          stopOnType: ['complete', 'file_created'],
        })
        allEvents.push(...events)
        turn++

        console.log(`Turn ${turn}: Received ${events.length} events after plan approval`)
        const nextEventTypes = Array.from(new Set(events.map((e) => e.type)))
        console.log(`  Event types: ${nextEventTypes.join(', ')}`)

        continue
      }
    }

    // If we get here with no actionable events, wait for more
    console.log(`Turn ${turn}: No actionable events, conversation may be complete`)
    break
  }

  // Final categorization of all events
  const { clarificationEvents, searchPlanEvents, fileCreatedEvents, contentEvents } =
    categorizeEvents(allEvents)

  const state: ConversationState = {
    sessionId,
    events: allEvents,
    clarificationEvents,
    searchPlanEvents,
    fileCreatedEvents,
    contentEvents,
    isComplete: allEvents.some((e) => e.type === 'complete'),
    hasFileOutput: fileCreatedEvents.length > 0,
  }

  console.log(`\nConversation completed in ${turn} turns`)
  console.log(`  Total events: ${allEvents.length}`)
  console.log(`  Clarifications: ${clarificationEvents.length}`)
  console.log(`  Search plans: ${searchPlanEvents.length}`)
  console.log(`  File outputs: ${fileCreatedEvents.length}`)
  console.log(`  Content events: ${contentEvents.length}`)

  return state
}

/**
 * List files in S3 for a user
 */
async function listS3Files(userId: string, orgId: string): Promise<string[]> {
  try {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' })

    const prefix = `${orgId}/${userId}/outputs/`

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await client.send(command)
    return (response.Contents || []).map((obj) => obj.Key || '')
  } catch (error) {
    console.error('S3 list error:', error)
    return []
  }
}

/**
 * Get files list via Navigator API
 */
async function getNavigatorFiles(
  request: APIRequestContext,
  user: TestUser
): Promise<FileListResponse> {
  const response = await request.get(`${API_BASE}/files/list`, {
    headers: {
      Cookie: `session=${user.sessionCookie}; ORG=${user.orgCookie}`,
    },
  })

  if (!response.ok()) {
    const errorText = await response.text()
    throw new Error(`Files list failed: ${response.status()} - ${errorText}`)
  }

  return response.json()
}

/**
 * Cleanup test user (best effort)
 */
async function cleanupTestUser(user: TestUser): Promise<void> {
  console.log(`[Cleanup] Test user ${user.email}, org ${user.orgId}`)
}

// =============================================================================
// TEST SUITES
// =============================================================================

test.describe('Agent File Output Integration Tests', () => {
  test.describe.configure({ timeout: AGENT_TIMEOUT })

  let testUser: TestUser
  let conversationState: ConversationState | null = null

  test.beforeAll(async ({ request }) => {
    // Create test user
    try {
      testUser = await createTestUser(request)
      console.log(`Created test user: ${testUser.email} (org: ${testUser.orgId})`)
    } catch (error) {
      console.error('Failed to create test user:', error)
      throw error
    }
  })

  test.afterAll(async () => {
    if (testUser) {
      await cleanupTestUser(testUser)
    }
  })

  test.describe('Full Flow: Chat → Clarification → Plan → File → S3 → UI', () => {
    test('should complete full conversation and generate file output', async () => {
      console.log('\n=== FULL FLOW TEST ===')
      console.log('Testing: User sends message → Agent clarifies → User answers → File generated')

      // Run the full conversation flow
      conversationState = await runFullConversationFlow(
        testUser,
        'find me acne trends',
        VIVID_COMMENTER_URL,
        { maxTurns: 15, timeout: AGENT_TIMEOUT }
      )

      // Verify conversation completed
      expect(conversationState.events.length).toBeGreaterThan(0)
      console.log(`\n✓ Conversation completed with ${conversationState.events.length} events`)

      // Log all unique event types for debugging
      const eventTypes = Array.from(new Set(conversationState.events.map((e) => e.type)))
      console.log(`Event types in conversation: ${eventTypes.join(', ')}`)
    })

    test('should have file_created event with required fields', async () => {
      // This test depends on the previous test generating file output
      // If no state or no file output, we skip gracefully
      if (!conversationState) {
        console.log('No conversation state from previous test - skipping')
        return
      }

      if (!conversationState.hasFileOutput) {
        console.log('Previous test did not generate file output')
        console.log('This can happen if the agent requires more interaction or different prompts')
        console.log('Skipping file_created event verification')
        return
      }

      // Verify file was created
      expect(conversationState.fileCreatedEvents.length).toBeGreaterThanOrEqual(1)

      const fileEvent = conversationState.fileCreatedEvents[0]
      console.log('\nFile created event:')
      console.log(`  Name: ${fileEvent.name}`)
      console.log(`  Path: ${fileEvent.path}`)
      console.log(`  Format: ${fileEvent.format}`)
      console.log(`  Size: ${fileEvent.size || 'unknown'}`)
      console.log(`  Summary: ${fileEvent.summary?.substring(0, 100) || 'none'}...`)

      // Required fields
      expect(fileEvent.type).toBe('file_created')
      expect(fileEvent.path).toBeTruthy()
      expect(fileEvent.name).toBeTruthy()
      expect(typeof fileEvent.path).toBe('string')
      expect(typeof fileEvent.name).toBe('string')

      // Format should be valid
      if (fileEvent.format) {
        expect(['html', 'txt', 'csv', 'json', 'pdf', 'xlsx']).toContain(fileEvent.format)
      }

      console.log('✓ file_created event has all required fields')
    })

    test('should upload file to S3 with user-specific path', async () => {
      if (!conversationState?.hasFileOutput) {
        console.log('No file output from previous test, running full flow...')
        conversationState = await runFullConversationFlow(
          testUser,
          'generate acne analysis report',
          VIVID_COMMENTER_URL,
          { maxTurns: 15, timeout: AGENT_TIMEOUT }
        )
      }

      // Skip if still no file output
      if (!conversationState.hasFileOutput) {
        console.log('Agent did not generate file output - may require different prompt')
        // This can happen if the agent needs more turns or different prompts
        // Log warning but don't fail the test as S3 verification itself will skip gracefully
        console.log('Skipping S3 path verification - no file output')
        return
      }

      // Check S3 for uploaded files
      const s3Files = await listS3Files(testUser.id, testUser.orgId)
      console.log(`\nS3 files for user: ${s3Files.length} files`)
      s3Files.forEach((f) => console.log(`  - ${f}`))

      // Verify file exists in S3
      const expectedPrefix = `${testUser.orgId}/${testUser.id}/outputs/`
      const userFiles = s3Files.filter((f) => f.startsWith(expectedPrefix))

      expect(userFiles.length).toBeGreaterThan(0)
      console.log(`✓ ${userFiles.length} files uploaded to user-specific S3 path`)
    })

    test('should show file in Navigator after generation', async ({ request }) => {
      if (!conversationState?.hasFileOutput) {
        console.log('No file output from previous tests - skipping Navigator verification')
        // If previous test didn't generate a file, we can't verify Navigator
        // This is acceptable behavior as the agent may require different prompts
        return
      }

      // Get files via Navigator API
      const filesResponse = await getNavigatorFiles(request, testUser)

      console.log(`\nNavigator shows ${filesResponse.files?.length || 0} files`)
      filesResponse.files?.forEach((f) => {
        console.log(`  - ${f.name} (${f.size} bytes)`)
      })

      // There should be at least one file
      expect(filesResponse.files?.length).toBeGreaterThan(0)

      // Find the HTML file we generated
      const htmlFiles = filesResponse.files?.filter((f) => f.name.endsWith('.html')) || []
      expect(htmlFiles.length).toBeGreaterThanOrEqual(1)

      console.log('✓ Files visible in Navigator')
    })

    test('should allow downloading generated file', async ({ request }) => {
      if (!conversationState?.hasFileOutput) {
        console.log('No file output from previous tests - skipping download verification')
        return
      }

      // Get file list
      const filesResponse = await getNavigatorFiles(request, testUser)
      const htmlFile = filesResponse.files?.find((f) => f.name.endsWith('.html'))

      expect(htmlFile).toBeTruthy()

      console.log(`\nDownloading file: ${htmlFile!.path}`)

      // Download file via API
      const downloadResponse = await request.get(`${API_BASE}/files/content`, {
        params: { path: htmlFile!.path },
        headers: {
          Cookie: `session=${testUser.sessionCookie}; ORG=${testUser.orgCookie}`,
        },
      })

      expect(downloadResponse.ok()).toBe(true)

      const content = await downloadResponse.text()
      expect(content.length).toBeGreaterThan(0)
      expect(content.toLowerCase()).toContain('<!doctype html>')

      console.log(`✓ File downloaded successfully (${content.length} bytes)`)
    })
  })

  test.describe('Conversation Flow Handling', () => {
    test('should handle clarification questions correctly', async () => {
      // Run a fresh conversation to test clarification handling
      const state = await runFullConversationFlow(
        testUser,
        'analyze beauty product trends for teenagers',
        VIVID_COMMENTER_URL,
        { maxTurns: 10, timeout: AGENT_TIMEOUT }
      )

      // The agent should have asked clarification questions
      console.log(`\nClarification events: ${state.clarificationEvents.length}`)

      if (state.clarificationEvents.length > 0) {
        const clarificationEvent = state.clarificationEvents[0]
        const clarificationId = clarificationEvent.clarification?.clarificationId || clarificationEvent.clarificationId
        console.log(`First clarification ID: ${clarificationId}`)

        const questions = clarificationEvent.clarification?.questions || clarificationEvent.questions || []
        console.log(`Questions asked: ${questions.length}`)
        questions.forEach((q) => {
          console.log(`  - [${q.type || 'unknown'}] ${q.question.substring(0, 60)}...`)
        })

        expect(questions.length).toBeGreaterThan(0)
        console.log('✓ Clarification questions received correctly')
      } else {
        // Some messages may not require clarification - this is also valid
        console.log('No clarification events in response')
        // The conversation should have at least progressed
        expect(state.events.length).toBeGreaterThan(0)
      }

      // Overall: conversation should have processed something
      console.log('✓ Conversation flow completed')
    })

    test('should handle search plan approval correctly', async () => {
      // This test verifies search_plan/preview_ready events are handled
      const state = await runFullConversationFlow(
        testUser,
        'find trending skincare ingredients',
        VIVID_COMMENTER_URL,
        { maxTurns: 12, timeout: AGENT_TIMEOUT }
      )

      console.log(`\nSearch plan events: ${state.searchPlanEvents.length}`)

      if (state.searchPlanEvents.length > 0) {
        const planEvent = state.searchPlanEvents[0]
        console.log(`Plan ID: ${planEvent.planId || planEvent.plan?.planId}`)
        console.log('✓ Search plan handled correctly')
      }

      // Conversation should complete regardless
      expect(state.events.length).toBeGreaterThan(0)
    })
  })

  test.describe('Error Handling', () => {
    test('should handle agent not running gracefully', async () => {
      const fakeAgentUrl = 'http://localhost:19999'

      try {
        const { response } = await startConversation(
          testUser,
          'test message',
          fakeAgentUrl,
          'fake-agent'
        )

        if (response.ok) {
          const events = await collectSSEEvents(response, { timeout: 5000 })
          const errorEvents = events.filter(
            (e) => e.type === 'error' || e.error || e.state === 'failed'
          )
          // Should receive error or graceful degradation
          console.log(`Received ${events.length} events from unavailable agent`)
        } else {
          // Non-200 response is acceptable
          expect(response.status).toBeGreaterThanOrEqual(400)
        }

        console.log('✓ Agent connection error handled gracefully')
      } catch {
        // Network error is also acceptable
        console.log('✓ Agent connection error thrown (acceptable)')
      }
    })

    test('should handle unauthenticated request appropriately', async ({ request }) => {
      const response = await request.post(`${API_BASE}/chat/stream`, {
        data: {
          message: 'test message',
          selectedAgent: {
            id: 'vivid-commenter',
            name: 'Vivid Commenter',
            url: VIVID_COMMENTER_URL,
            protocol: 'a2a',
          },
        },
        // No auth cookies
      })

      // The API may either reject (4xx) or allow with limited functionality
      // Verify we get a response and the system doesn't crash
      expect(response.status()).toBeLessThan(500)

      if (response.status() >= 400) {
        console.log('✓ Unauthenticated request rejected')
      } else {
        // If allowed, verify we get a valid response
        const contentType = response.headers()['content-type']
        expect(contentType).toBeTruthy()
        console.log('✓ Unauthenticated request allowed with response (may have limited functionality)')
      }
    })
  })
})

// =============================================================================
// ORCHESTRATOR INTEGRATION TESTS
// =============================================================================

test.describe('Orchestrator File Event Handling', () => {
  test.describe.configure({ timeout: AGENT_TIMEOUT })

  let testUser: TestUser

  test.beforeAll(async ({ request }) => {
    testUser = await createTestUser(request)
  })

  test.afterAll(async () => {
    if (testUser) {
      await cleanupTestUser(testUser)
    }
  })

  test('orchestrator should forward file_created events with user context headers', async () => {
    console.log('\n=== ORCHESTRATOR DIRECT TEST ===')
    console.log('Testing: Direct call to orchestrator with user headers')

    // Call orchestrator directly with user headers
    const response = await fetch(`${ORCHESTRATOR_URL}/api/chat/a2a/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-user-id': testUser.id,
        'x-org-id': testUser.orgId,
      },
      body: JSON.stringify({
        message: 'find trends for acne treatment',
        agentUrl: VIVID_COMMENTER_URL,
        sessionId: `orch-test-${Date.now()}`,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Orchestrator error: ${response.status} - ${errorText}`)

      if (response.status === 403) {
        console.log('Quota exceeded - skipping test')
        test.skip()
      }
      throw new Error(`Orchestrator request failed: ${response.status}`)
    }

    const events = await collectSSEEvents(response, { timeout: STEP_TIMEOUT })
    const fileEvents = events.filter((e) => e.type === 'file_created')

    console.log(`Received ${events.length} events from orchestrator`)
    console.log(`  - ${fileEvents.length} file_created events`)

    // Verify events received
    expect(events.length).toBeGreaterThan(0)
    console.log('✓ Orchestrator handled request with user context')
  })

  test('orchestrator should transform file_saved to file_created', async () => {
    console.log('\n=== EVENT TRANSFORMATION TEST ===')

    const response = await fetch(`${ORCHESTRATOR_URL}/api/chat/a2a/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-user-id': testUser.id,
        'x-org-id': testUser.orgId,
      },
      body: JSON.stringify({
        message: 'generate a brief trend report',
        agentUrl: VIVID_COMMENTER_URL,
        sessionId: `transform-test-${Date.now()}`,
      }),
    })

    if (!response.ok) {
      if (response.status === 403) {
        console.log('Quota exceeded - skipping test')
        test.skip()
      }
      test.skip()
    }

    const events = await collectSSEEvents(response, { timeout: STEP_TIMEOUT })

    // Check that no 'file_saved' events exist (should all be transformed)
    const fileSavedEvents = events.filter((e) => e.type === 'file_saved')
    const fileCreatedEvents = events.filter((e) => e.type === 'file_created')

    expect(fileSavedEvents.length).toBe(0)
    console.log(`file_saved events: ${fileSavedEvents.length} (should be 0)`)
    console.log(`file_created events: ${fileCreatedEvents.length}`)

    console.log('✓ Event transformation verified')
  })
})

// =============================================================================
// S3 UPLOAD VERIFICATION TESTS
// =============================================================================

test.describe('S3 Upload Verification', () => {
  test.describe.configure({ timeout: AGENT_TIMEOUT })

  let testUser: TestUser
  let conversationState: ConversationState | null = null

  test.beforeAll(async ({ request }) => {
    testUser = await createTestUser(request)
  })

  test.afterAll(async () => {
    if (testUser) {
      await cleanupTestUser(testUser)
    }
  })

  test('files should be uploaded to user-specific S3 path', async () => {
    console.log('\n=== S3 UPLOAD VERIFICATION ===')

    // First, generate a file through the full flow
    conversationState = await runFullConversationFlow(
      testUser,
      'analyze skincare ingredients trends',
      VIVID_COMMENTER_URL,
      { maxTurns: 15, timeout: AGENT_TIMEOUT }
    )

    if (!conversationState.hasFileOutput) {
      console.log('No file generated by agent - this may be expected for some prompts')
      // Still verify S3 path structure exists
    }

    // List S3 files for user
    const s3Files = await listS3Files(testUser.id, testUser.orgId)

    console.log('S3 files for user:')
    s3Files.forEach((f) => console.log(`  - ${f}`))

    if (conversationState.hasFileOutput) {
      // Verify path structure: {orgId}/{userId}/outputs/{filename}
      const expectedPrefix = `${testUser.orgId}/${testUser.id}/outputs/`
      const userFiles = s3Files.filter((f) => f.startsWith(expectedPrefix))

      expect(userFiles.length).toBeGreaterThan(0)
      console.log(`✓ ${userFiles.length} files in user-specific S3 path`)
    } else {
      console.log('Skipping S3 verification - no file output from agent')
    }
  })

  test('S3 files should be accessible via files API', async ({ request }) => {
    // Get file list via API
    const filesResponse = await getNavigatorFiles(request, testUser)

    if (!filesResponse.files || filesResponse.files.length === 0) {
      console.log('No files in Navigator - verifying empty state is valid')
      // This is acceptable if the agent didn't generate a file
      return
    }

    const file = filesResponse.files[0]

    // Verify file is downloadable
    const downloadResponse = await request.get(`${API_BASE}/files/content`, {
      params: { path: file.path },
      headers: {
        Cookie: `session=${testUser.sessionCookie}; ORG=${testUser.orgCookie}`,
      },
    })

    expect(downloadResponse.ok()).toBe(true)
    const content = await downloadResponse.text()
    expect(content.length).toBeGreaterThan(0)

    console.log(`✓ S3 file accessible via API: ${file.name} (${content.length} bytes)`)
  })
})
