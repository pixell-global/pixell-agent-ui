/**
 * Test Utilities for Workflow E2E Tests
 *
 * Provides helpers for:
 * - Spawning and managing the Python test agent
 * - Collecting SSE events from streaming responses
 * - Waiting for specific workflow phases
 * - Creating test contexts
 */

import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import { WorkflowSessionStore } from '../../services/workflow-session'
import type { WorkflowExecution, WorkflowPhase } from '@pixell/protocols'

// =============================================================================
// Test Agent Management
// =============================================================================

export type TestScenario =
  | 'full_plan_mode'
  | 'direct_execution'
  | 'error_mid_execution'
  | 'multi_clarification'
  | 'timeout_scenario'

export interface TestAgentConfig {
  port: number
  scenario: TestScenario
  delayMs?: number
}

/**
 * Manages a Python test agent process for E2E testing.
 */
export class TestAgent {
  private process: ChildProcess | null = null
  private config: TestAgentConfig

  constructor(config: TestAgentConfig) {
    this.config = {
      ...config,
      delayMs: config.delayMs ?? 50,
    }
  }

  /**
   * Start the test agent process.
   * Waits for the agent to be healthy before returning.
   */
  async start(): Promise<void> {
    const testAgentDir = path.join(__dirname, '../../test-agent')

    // Set up environment
    const env = {
      ...process.env,
      TEST_AGENT_PORT: String(this.config.port),
      TEST_SCENARIO: this.config.scenario,
      TEST_AGENT_DELAY_MS: String(this.config.delayMs),
    }

    // Start the Python process
    this.process = spawn('python', ['main.py'], {
      cwd: testAgentDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Log output for debugging
    this.process.stdout?.on('data', (data) => {
      console.log(`[test-agent] ${data}`)
    })

    this.process.stderr?.on('data', (data) => {
      console.error(`[test-agent stderr] ${data}`)
    })

    this.process.on('error', (error) => {
      console.error('[test-agent] Process error:', error)
    })

    this.process.on('exit', (code) => {
      console.log(`[test-agent] Process exited with code ${code}`)
    })

    // Wait for agent to be ready
    await this.waitForHealthy()
  }

  /**
   * Stop the test agent process.
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM')

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (this.process) {
          this.process.on('exit', () => resolve())
          setTimeout(() => {
            this.process?.kill('SIGKILL')
            resolve()
          }, 5000)
        } else {
          resolve()
        }
      })

      this.process = null
    }
  }

  /**
   * Reset the test agent's session state.
   */
  async reset(): Promise<void> {
    const response = await fetch(`http://localhost:${this.config.port}/reset`, {
      method: 'POST',
    })
    if (!response.ok) {
      console.warn('Failed to reset test agent state')
    }
  }

  /**
   * Wait for the test agent to respond to health checks.
   */
  private async waitForHealthy(maxAttempts = 30, delayMs = 200): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.config.port}/health`, {
          signal: AbortSignal.timeout(1000),
        })
        if (response.ok) {
          console.log(`[test-agent] Healthy after ${i + 1} attempts`)
          return
        }
      } catch {
        // Agent not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    throw new Error(`Test agent failed to become healthy after ${maxAttempts} attempts`)
  }

  /**
   * Get the agent URL for this test agent.
   */
  get url(): string {
    return `http://localhost:${this.config.port}`
  }
}

// =============================================================================
// SSE Event Collection
// =============================================================================

export interface SSEEvent {
  id?: string
  event?: string
  data: any
  raw: string
}

/**
 * Collect SSE events from a streaming response.
 *
 * @param response - Fetch response with SSE stream
 * @param maxEvents - Maximum number of events to collect (default: 100)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Array of parsed SSE events
 */
export async function collectSSEEvents(
  response: Response,
  maxEvents = 100,
  timeoutMs = 30000
): Promise<SSEEvent[]> {
  const events: SSEEvent[] = []
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No response body reader available')
  }

  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), timeoutMs)
  )

  let buffer = ''

  try {
    while (events.length < maxEvents) {
      const readResult = await Promise.race([reader.read(), timeout])

      if (readResult === 'timeout') {
        console.warn('SSE collection timed out')
        break
      }

      const { done, value } = readResult as ReadableStreamReadResult<Uint8Array>
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim() === '' || line.startsWith(':')) continue

        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()

          if (dataStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(dataStr)
            events.push({
              data,
              raw: line,
            })
          } catch {
            // Non-JSON data line
            events.push({
              data: dataStr,
              raw: line,
            })
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
 * Filter SSE events by type.
 */
export function filterEventsByType(events: SSEEvent[], type: string): SSEEvent[] {
  return events.filter((e) => e.data?.type === type)
}

/**
 * Find the first event of a specific type.
 */
export function findEventByType(events: SSEEvent[], type: string): SSEEvent | undefined {
  return events.find((e) => e.data?.type === type)
}

/**
 * Extract workflowId from events.
 */
export function extractWorkflowId(events: SSEEvent[]): string | undefined {
  // Check session_created event first
  const sessionEvent = findEventByType(events, 'session_created')
  if (sessionEvent?.data?.workflowId) {
    return sessionEvent.data.workflowId
  }

  // Check any event with workflowId
  for (const event of events) {
    if (event.data?.workflowId) {
      return event.data.workflowId
    }
  }

  return undefined
}

/**
 * Extract sessionId from events.
 */
export function extractSessionId(events: SSEEvent[]): string | undefined {
  const sessionEvent = findEventByType(events, 'session_created')
  return sessionEvent?.data?.sessionId
}

// =============================================================================
// Workflow Phase Helpers
// =============================================================================

/**
 * Wait for a workflow to reach a specific phase.
 *
 * @param store - WorkflowSessionStore instance
 * @param workflowId - Workflow ID to monitor
 * @param targetPhase - Phase to wait for
 * @param timeoutMs - Timeout in milliseconds
 */
export async function waitForPhase(
  store: WorkflowSessionStore,
  workflowId: string,
  targetPhase: WorkflowPhase,
  timeoutMs = 10000
): Promise<WorkflowExecution> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const workflow = await store.get(workflowId)

    if (workflow?.phase === targetPhase) {
      return workflow
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const workflow = await store.get(workflowId)
  throw new Error(
    `Timeout waiting for phase ${targetPhase}. Current phase: ${workflow?.phase ?? 'workflow not found'}`
  )
}

/**
 * Wait for a workflow to complete or error.
 */
export async function waitForCompletion(
  store: WorkflowSessionStore,
  workflowId: string,
  timeoutMs = 30000
): Promise<WorkflowExecution> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const workflow = await store.get(workflowId)

    if (workflow?.phase === 'completed' || workflow?.phase === 'error') {
      return workflow
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const workflow = await store.get(workflowId)
  throw new Error(
    `Timeout waiting for completion. Current phase: ${workflow?.phase ?? 'workflow not found'}`
  )
}

// =============================================================================
// Test Context Factory
// =============================================================================

export interface TestContext {
  agent: TestAgent
  store: WorkflowSessionStore
  cleanup: () => Promise<void>
}

/**
 * Create a complete test context with agent and store.
 */
export async function createTestContext(config: TestAgentConfig): Promise<TestContext> {
  const agent = new TestAgent(config)
  const store = new WorkflowSessionStore({ ttlSeconds: 300 })

  await agent.start()

  return {
    agent,
    store,
    cleanup: async () => {
      await agent.stop()
    },
  }
}

// =============================================================================
// Request Helpers
// =============================================================================

/**
 * Send a message to an agent via A2A protocol.
 */
export async function sendA2AMessage(
  agentUrl: string,
  message: string,
  options: {
    sessionId?: string
    workflowId?: string
    planMode?: boolean
    history?: Array<{ role: string; content: string }>
  } = {}
): Promise<Response> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const sessionId = options.sessionId ?? `session_${Date.now()}`
  const workflowId = options.workflowId ?? undefined

  const payload = {
    jsonrpc: '2.0',
    method: 'message/stream',
    id: messageId,
    params: {
      sessionId,
      workflowId,
      message: {
        messageId,
        role: 'user',
        parts: [{ text: message }],
        metadata: {
          plan_mode_enabled: options.planMode ?? false,
        },
      },
      metadata: {
        planMode: options.planMode ?? false,
        history: options.history ?? [],
      },
    },
  }

  return fetch(agentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
  })
}

/**
 * Send a clarification response to an agent.
 */
export async function sendClarificationResponse(
  agentUrl: string,
  sessionId: string,
  clarificationId: string,
  answers: Record<string, any>
): Promise<Response> {
  return fetch(`${agentUrl}/a2a/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      sessionId,
      clarificationId,
      answers,
    }),
  })
}

/**
 * Send a selection response to an agent.
 */
export async function sendSelectionResponse(
  agentUrl: string,
  sessionId: string,
  selectionId: string,
  selectedIds: string[]
): Promise<Response> {
  return fetch(`${agentUrl}/a2a/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      sessionId,
      selectionId,
      selectedIds,
    }),
  })
}

/**
 * Send a plan approval response to an agent.
 */
export async function sendPlanApproval(
  agentUrl: string,
  sessionId: string,
  planId: string,
  approved: boolean
): Promise<Response> {
  return fetch(`${agentUrl}/a2a/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      sessionId,
      planId,
      approved,
    }),
  })
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that events contain a specific event type.
 */
export function assertHasEventType(events: SSEEvent[], type: string): void {
  const found = events.some((e) => e.data?.type === type)
  if (!found) {
    const types = events.map((e) => e.data?.type).filter(Boolean)
    throw new Error(`Expected event type '${type}' not found. Found types: ${types.join(', ')}`)
  }
}

/**
 * Assert that all events have workflowId.
 */
export function assertAllEventsHaveWorkflowId(events: SSEEvent[], workflowId: string): void {
  const eventsWithWorkflowId = events.filter(
    (e) => e.data?.workflowId || e.data?.clarification?.workflowId || e.data?.selection?.workflowId
  )

  for (const event of eventsWithWorkflowId) {
    const eventWorkflowId =
      event.data.workflowId ||
      event.data.clarification?.workflowId ||
      event.data.selection?.workflowId

    if (eventWorkflowId !== workflowId) {
      throw new Error(
        `Event has wrong workflowId. Expected: ${workflowId}, Got: ${eventWorkflowId}`
      )
    }
  }
}

/**
 * Assert workflow phase history contains expected phases in order.
 */
export function assertPhaseHistory(
  workflow: WorkflowExecution,
  expectedPhases: WorkflowPhase[]
): void {
  const actualPhases = workflow.phaseHistory.map((h) => h.phase)

  if (actualPhases.length !== expectedPhases.length) {
    throw new Error(
      `Phase history length mismatch. Expected: ${expectedPhases.length}, Got: ${actualPhases.length}\n` +
        `Expected: ${expectedPhases.join(' -> ')}\n` +
        `Got: ${actualPhases.join(' -> ')}`
    )
  }

  for (let i = 0; i < expectedPhases.length; i++) {
    if (actualPhases[i] !== expectedPhases[i]) {
      throw new Error(
        `Phase mismatch at index ${i}. Expected: ${expectedPhases[i]}, Got: ${actualPhases[i]}`
      )
    }
  }
}

// =============================================================================
// Port Management
// =============================================================================

let nextPort = 9900

/**
 * Get a unique port for a test agent.
 * Helps avoid port conflicts when running tests in parallel.
 */
export function getUniquePort(): number {
  return nextPort++
}

/**
 * Reset port counter (useful in beforeAll hooks).
 */
export function resetPortCounter(): void {
  nextPort = 9900
}
