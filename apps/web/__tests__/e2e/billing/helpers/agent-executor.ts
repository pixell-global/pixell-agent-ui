/**
 * Agent Executor for Billing Integration Tests
 *
 * Provides utilities for executing Python agents and verifying quota consumption.
 * This module bridges the orchestrator's test agent infrastructure with billing tests.
 *
 * Environment Variables:
 * - ORCHESTRATOR_URL: Orchestrator base URL (default: http://localhost:3001)
 * - SERVICE_TOKEN_SECRET: Service token for internal API calls
 */

import type { APIRequestContext } from '@playwright/test'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'
const WEB_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'
const SERVICE_TOKEN = process.env.SERVICE_TOKEN_SECRET || ''

// =============================================================================
// Types
// =============================================================================

export interface SSEEvent {
  id?: string
  event?: string
  data: unknown
  raw: string
}

export interface AgentExecutionContext {
  userId: string
  orgId: string
  agentId?: string
  sessionId?: string
}

export interface AgentExecutionResult {
  success: boolean
  workflowId?: string
  events: SSEEvent[]
  error?: string
  quotaUsed?: boolean
  finalPhase?: string
}

export interface QuotaCheckResult {
  success: boolean
  allowed: boolean
  featureAvailable: boolean
  limit: number | null
  used: number
  remaining: number
  reason?: string
}

export interface QuotaRecordResult {
  success: boolean
  usageEventId?: number
  newUsage?: number
  error?: string
  allowed?: boolean
}

export interface QuotaStatus {
  success: boolean
  quotas?: {
    tier: string
    billingPeriodStart: string
    billingPeriodEnd: string
    features: {
      research: FeatureQuota
      ideation: FeatureQuota
      autoPosting: FeatureQuota
      monitors: MonitorQuota
    }
  }
  error?: string
}

interface FeatureQuota {
  available: boolean
  limit: number
  used: number
  remaining: number
}

interface MonitorQuota {
  available: boolean
  limit: number
  active: number
  remaining: number
}

type FeatureType = 'research' | 'ideation' | 'auto_posting' | 'monitors'

// =============================================================================
// Quota API Functions
// =============================================================================

/**
 * Check if an action is allowed for the given organization and feature
 */
export async function checkQuota(
  request: APIRequestContext,
  orgId: string,
  feature: FeatureType
): Promise<QuotaCheckResult> {
  const response = await request.post(`${WEB_BASE_URL}/api/billing/quotas/check`, {
    data: { orgId, feature },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_TOKEN}`,
    },
  })

  const data = await response.json()
  return data as QuotaCheckResult
}

/**
 * Record quota usage for an action
 */
export async function recordQuotaUsage(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  feature: FeatureType,
  metadata?: Record<string, unknown>
): Promise<QuotaRecordResult> {
  const response = await request.post(`${WEB_BASE_URL}/api/billing/quotas/record`, {
    data: {
      orgId,
      userId,
      feature,
      action: 'increment',
      metadata,
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_TOKEN}`,
    },
  })

  const data = await response.json()
  return data as QuotaRecordResult
}

/**
 * Decrement quota usage (monitors only)
 */
export async function decrementQuotaUsage(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  feature: 'monitors',
  metadata?: Record<string, unknown>
): Promise<QuotaRecordResult> {
  const response = await request.post(`${WEB_BASE_URL}/api/billing/quotas/record`, {
    data: {
      orgId,
      userId,
      feature,
      action: 'decrement',
      metadata,
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_TOKEN}`,
    },
  })

  const data = await response.json()
  return data as QuotaRecordResult
}

/**
 * Get the current quota status for an organization
 */
export async function getQuotaStatus(
  request: APIRequestContext,
  orgId: string
): Promise<QuotaStatus> {
  const response = await request.get(`${WEB_BASE_URL}/api/billing/quotas?orgId=${orgId}`, {
    headers: {
      Authorization: `Bearer ${SERVICE_TOKEN}`,
    },
  })

  const data = await response.json()
  return data as QuotaStatus
}

// =============================================================================
// SSE Event Collection
// =============================================================================

/**
 * Parse SSE events from a text stream
 */
function parseSSEEvents(text: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const lines = text.split('\n')

  let currentEvent: Partial<SSEEvent> = {}
  let dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('id:')) {
      currentEvent.id = line.slice(3).trim()
    } else if (line.startsWith('event:')) {
      currentEvent.event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    } else if (line === '') {
      // Empty line signals end of event
      if (dataLines.length > 0) {
        const dataStr = dataLines.join('\n')
        try {
          currentEvent.data = JSON.parse(dataStr)
        } catch {
          currentEvent.data = dataStr
        }
        currentEvent.raw = dataStr
        events.push(currentEvent as SSEEvent)
      }
      currentEvent = {}
      dataLines = []
    }
  }

  return events
}

/**
 * Collect SSE events from a streaming response
 */
export async function collectSSEEvents(
  response: Response,
  maxEvents = 100,
  timeoutMs = 60000
): Promise<SSEEvent[]> {
  const events: SSEEvent[] = []
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No response body reader available')
  }

  const timeoutPromise = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), timeoutMs)
  )

  let buffer = ''

  try {
    while (events.length < maxEvents) {
      const readResult = await Promise.race([reader.read(), timeoutPromise])

      if (readResult === 'timeout') {
        console.warn('[agent-executor] SSE collection timed out')
        break
      }

      const { done, value } = readResult

      if (done) {
        // Process any remaining buffer
        if (buffer.trim()) {
          const parsed = parseSSEEvents(buffer + '\n\n')
          events.push(...parsed)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Process complete events (separated by double newlines)
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || '' // Keep incomplete event in buffer

      for (const part of parts) {
        if (part.trim()) {
          const parsed = parseSSEEvents(part + '\n\n')
          events.push(...parsed)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return events
}

// =============================================================================
// Agent Execution via Orchestrator
// =============================================================================

/**
 * Execute an agent task via the orchestrator's A2A stream endpoint
 *
 * This calls the orchestrator which will:
 * 1. Check quota before executing
 * 2. Execute the agent
 * 3. Record quota usage on completion
 */
export async function executeAgentWithQuotaCheck(
  message: string,
  context: AgentExecutionContext,
  options: {
    timeoutMs?: number
    agentUrl?: string
  } = {}
): Promise<AgentExecutionResult> {
  const { timeoutMs = 60000, agentUrl } = options

  try {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/a2a/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        message,
        context: {
          userId: context.userId,
          orgId: context.orgId,
          agentId: context.agentId || 'reddit-agent',
          sessionId: context.sessionId || `test-session-${Date.now()}`,
        },
        agentUrl,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        events: [],
        error: `Agent execution failed: ${response.status} - ${errorText}`,
      }
    }

    // Collect SSE events
    const events = await collectSSEEvents(response, 200, timeoutMs)

    // Check for completion or error
    const completionEvent = events.find(
      (e) => e.event === 'complete' || e.event === 'workflow_complete'
    )
    const errorEvent = events.find((e) => e.event === 'error')
    const quotaBlockedEvent = events.find(
      (e) => e.event === 'quota_exceeded' || (e.data as any)?.type === 'quota_blocked'
    )

    if (quotaBlockedEvent) {
      return {
        success: false,
        events,
        error: 'Quota exceeded',
        quotaUsed: false,
      }
    }

    if (errorEvent) {
      return {
        success: false,
        events,
        error: (errorEvent.data as any)?.message || 'Agent execution error',
      }
    }

    // Extract workflow ID if available
    const workflowEvent = events.find((e) => (e.data as any)?.workflowId)
    const workflowId = (workflowEvent?.data as any)?.workflowId

    return {
      success: !!completionEvent,
      workflowId,
      events,
      quotaUsed: !!completionEvent,
      finalPhase: (completionEvent?.data as any)?.phase,
    }
  } catch (error) {
    return {
      success: false,
      events: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Simulate an agent action by directly calling quota APIs
 *
 * This is useful for testing quota behavior without running a real agent.
 */
export async function simulateAgentAction(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  feature: FeatureType,
  options: {
    agentId?: string
    skipCheck?: boolean
  } = {}
): Promise<{
  allowed: boolean
  quotaUsed: boolean
  newUsage?: number
  error?: string
}> {
  const { agentId = 'test-agent', skipCheck = false } = options

  // Step 1: Check if action is allowed (unless skipped)
  if (!skipCheck) {
    const checkResult = await checkQuota(request, orgId, feature)
    if (!checkResult.allowed) {
      return {
        allowed: false,
        quotaUsed: false,
        error: checkResult.reason || 'Quota exceeded',
      }
    }
  }

  // Step 2: Record the usage
  const recordResult = await recordQuotaUsage(request, orgId, userId, feature, {
    agentId,
    simulatedAction: true,
  })

  if (!recordResult.success) {
    return {
      allowed: true,
      quotaUsed: false,
      error: recordResult.error,
    }
  }

  return {
    allowed: true,
    quotaUsed: true,
    newUsage: recordResult.newUsage,
  }
}

/**
 * Use quota repeatedly until limit is reached
 *
 * Returns the number of successful uses.
 */
export async function useQuotaUntilLimit(
  request: APIRequestContext,
  orgId: string,
  userId: string,
  feature: FeatureType,
  maxAttempts: number = 100
): Promise<{
  successfulUses: number
  finalUsage: number
  blockedAt?: number
}> {
  let successfulUses = 0
  let finalUsage = 0
  let blockedAt: number | undefined

  for (let i = 0; i < maxAttempts; i++) {
    const result = await simulateAgentAction(request, orgId, userId, feature)

    if (!result.allowed || !result.quotaUsed) {
      blockedAt = i + 1
      break
    }

    successfulUses++
    finalUsage = result.newUsage || 0
  }

  return {
    successfulUses,
    finalUsage,
    blockedAt,
  }
}

// =============================================================================
// Port Management for Test Agents
// =============================================================================

let nextPort = 8100

/**
 * Get a unique port for a test agent
 */
export function getUniquePort(): number {
  return nextPort++
}

/**
 * Reset port counter (call in test setup)
 */
export function resetPortCounter(startPort: number = 8100): void {
  nextPort = startPort
}
