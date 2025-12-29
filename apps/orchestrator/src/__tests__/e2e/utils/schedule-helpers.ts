/**
 * Schedule Helpers for E2E Tests
 *
 * Provides utilities for testing the scheduling feature including:
 * - Extracting schedule_proposal events from SSE streams
 * - Confirming/approving schedules via API
 * - Triggering manual executions
 * - Waiting for execution completion
 */

import type { SSEEvent } from './sse-helpers'

export interface ExecutionPlan {
  taskType: 'research' | 'ideation' | 'monitoring' | 'custom'
  version: number
  parameters: {
    subreddits?: string[]
    keywords?: string[]
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
    minUpvotes?: number
    query?: string
    filters?: Record<string, unknown>
    outputFormat?: string
    agentConfig?: Record<string, unknown>
  }
  expectedOutputs?: Array<{
    type: string
    name: string
    description?: string
  }>
  createdFromPlanMode: boolean
  planModeAnswers?: Record<string, unknown>
}

export interface ScheduleProposalEvent {
  type: 'schedule_proposal'
  proposalId: string
  name: string
  prompt: string
  scheduleType: 'cron' | 'interval' | 'one_time'
  cron?: string
  interval?: { value: number; unit: string }
  scheduleDisplay: string
  agentId: string
  agentUrl?: string
  sessionId?: string
  timezone?: string
  nextRunsPreview?: string[]
  // New fields for plan mode integration
  agentName?: string
  agentDescription?: string
  taskExplanation?: string
  expectedOutputs?: Array<{
    type: string
    name: string
    description?: string
  }>
  executionPlan?: ExecutionPlan
}

export interface Schedule {
  id: string
  orgId: string
  userId: string
  agentId: string
  agentName?: string
  name: string
  description?: string
  prompt: string
  scheduleType: 'cron' | 'interval' | 'one_time'
  cronExpression?: string
  intervalValue?: number
  intervalUnit?: string
  oneTimeAt?: string
  timezone: string
  status: string
  nextRunAt?: string
  lastRunAt?: string
  runCount: number
  successCount: number
  failureCount: number
  consecutiveFailures: number
  threadId?: string
  proposalId?: string
  fromProposal: boolean
  createdAt: string
  updatedAt: string
}

export interface ScheduleExecution {
  id: string
  scheduleId: string
  orgId: string
  executionNumber: number
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped' | 'retrying'
  activityId?: string
  threadId?: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  retryAttempt: number
  maxRetries: number
  nextRetryAt?: string
  resultSummary?: string
  resultOutputs?: Array<{
    name: string
    type: string
    path: string
    size?: number
  }>
  errorCode?: string
  errorMessage?: string
  errorRetryable?: boolean
}

/**
 * Find schedule_proposal event in SSE events
 */
export function findScheduleProposalEvent(events: SSEEvent[]): ScheduleProposalEvent | null {
  for (const event of events) {
    if (event.data?.type === 'schedule_proposal' && event.data?.proposalId) {
      return {
        type: 'schedule_proposal',
        proposalId: event.data.proposalId,
        name: event.data.name,
        prompt: event.data.prompt,
        scheduleType: event.data.scheduleType,
        cron: event.data.cron,
        interval: event.data.interval,
        scheduleDisplay: event.data.scheduleDisplay,
        agentId: event.data.agentId,
        agentUrl: event.data.agentUrl,
        sessionId: event.data.sessionId,
        timezone: event.data.timezone,
        nextRunsPreview: event.data.nextRunsPreview,
        // New fields for plan mode integration
        agentName: event.data.agentName,
        agentDescription: event.data.agentDescription,
        taskExplanation: event.data.taskExplanation,
        expectedOutputs: event.data.expectedOutputs,
        executionPlan: event.data.executionPlan,
      }
    }
  }
  return null
}

/**
 * Validate that an execution plan has the required structure
 */
export function validateExecutionPlan(plan: ExecutionPlan | undefined): boolean {
  if (!plan) return false

  // Check required fields
  if (!plan.taskType) return false
  if (typeof plan.version !== 'number') return false
  if (typeof plan.createdFromPlanMode !== 'boolean') return false

  // Check parameters
  if (!plan.parameters) return false

  return true
}

/**
 * Check if a schedule proposal has a valid execution plan from plan mode
 */
export function hasValidExecutionPlan(proposal: ScheduleProposalEvent): boolean {
  return validateExecutionPlan(proposal.executionPlan)
}

/**
 * Confirm a schedule proposal via API
 * Creates a schedule with status='pending_approval'
 */
export async function confirmScheduleProposal(
  userId: string,
  orgId: string,
  proposal: ScheduleProposalEvent,
  orchestratorUrl: string
): Promise<{ ok: boolean; schedule?: Schedule; error?: string }> {
  const response = await fetch(`${orchestratorUrl}/api/schedules/from-proposal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      proposalId: proposal.proposalId,
      // Use agentId from proposal, fall back to 'vivid-commenter' for agents that don't set it
      agentId: proposal.agentId || 'vivid-commenter',
      agentName: proposal.agentName || 'Vivid Commenter',
      name: proposal.name,
      prompt: proposal.prompt,
      scheduleType: proposal.scheduleType,
      cronExpression: proposal.cron,
      intervalValue: proposal.interval?.value,
      intervalUnit: proposal.interval?.unit,
      timezone: proposal.timezone || 'America/Los_Angeles',
      // Include execution plan if present (from plan mode)
      executionPlan: proposal.executionPlan,
    }),
  })

  const data = await response.json()
  return {
    ok: response.ok && data.ok !== false,
    schedule: data.schedule,
    error: data.error,
  }
}

/**
 * Approve a pending schedule to make it active
 */
export async function approveSchedule(
  userId: string,
  orgId: string,
  scheduleId: string,
  orchestratorUrl: string
): Promise<{ ok: boolean; schedule?: Schedule; error?: string }> {
  const response = await fetch(`${orchestratorUrl}/api/schedules/${scheduleId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
  })

  const data = await response.json()
  return {
    ok: response.ok && data.ok !== false,
    schedule: data.schedule,
    error: data.error,
  }
}

/**
 * Trigger manual schedule execution
 * @param options.async If true, returns immediately without waiting for execution to complete
 */
export async function triggerManualRun(
  userId: string,
  orgId: string,
  scheduleId: string,
  orchestratorUrl: string,
  options: { async?: boolean } = {}
): Promise<{ ok: boolean; execution?: ScheduleExecution; error?: string }> {
  const queryParams = options.async ? '?async=true' : ''
  const response = await fetch(`${orchestratorUrl}/api/schedules/${scheduleId}/run${queryParams}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
  })

  const data = await response.json()
  return {
    ok: response.ok && data.ok !== false,
    execution: data.execution,
    error: data.error,
  }
}

/**
 * Get schedule by ID
 */
export async function getSchedule(
  userId: string,
  orgId: string,
  scheduleId: string,
  orchestratorUrl: string
): Promise<Schedule | null> {
  const response = await fetch(`${orchestratorUrl}/api/schedules/${scheduleId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.schedule || data
}

/**
 * Get execution by ID
 */
export async function getExecution(
  userId: string,
  orgId: string,
  scheduleId: string,
  executionId: string,
  orchestratorUrl: string
): Promise<ScheduleExecution | null> {
  const response = await fetch(
    `${orchestratorUrl}/api/schedules/${scheduleId}/executions/${executionId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-org-id': orgId,
      },
    }
  )

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.execution || data
}

/**
 * Wait for execution to complete (succeeded or failed)
 */
export async function waitForExecutionComplete(
  userId: string,
  orgId: string,
  scheduleId: string,
  executionId: string,
  orchestratorUrl: string,
  timeoutMs: number = 120000
): Promise<ScheduleExecution | null> {
  const startTime = Date.now()
  const pollIntervalMs = 2000

  while (Date.now() - startTime < timeoutMs) {
    const execution = await getExecution(userId, orgId, scheduleId, executionId, orchestratorUrl)

    if (execution && ['succeeded', 'failed', 'cancelled'].includes(execution.status)) {
      return execution
    }

    console.log(
      `  Waiting for execution ${executionId}... status: ${execution?.status || 'unknown'}`
    )
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  console.warn(`Execution ${executionId} did not complete within ${timeoutMs}ms`)
  return null
}

/**
 * List schedules for a user
 */
export async function listSchedules(
  userId: string,
  orgId: string,
  orchestratorUrl: string
): Promise<Schedule[]> {
  const response = await fetch(`${orchestratorUrl}/api/schedules`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
  })

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data.schedules || []
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(
  userId: string,
  orgId: string,
  scheduleId: string,
  orchestratorUrl: string,
  hardDelete: boolean = false
): Promise<boolean> {
  const url = `${orchestratorUrl}/api/schedules/${scheduleId}${hardDelete ? '?hard=true' : ''}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'x-user-id': userId,
      'x-org-id': orgId,
    },
  })

  return response.ok
}

/**
 * Clean up test schedules (schedules with test-related names)
 */
export async function cleanupTestSchedules(
  userId: string,
  orgId: string,
  orchestratorUrl: string
): Promise<number> {
  const schedules = await listSchedules(userId, orgId, orchestratorUrl)
  let deletedCount = 0

  const testPatterns = [
    'E2E Test',
    'e2e test',
    'acne research',
    'Scheduled: acne',
    'test schedule',
  ]

  for (const schedule of schedules) {
    const isTestSchedule = testPatterns.some(
      (pattern) =>
        schedule.name.toLowerCase().includes(pattern.toLowerCase()) ||
        schedule.prompt.toLowerCase().includes(pattern.toLowerCase())
    )

    if (isTestSchedule) {
      console.log(`  Deleting test schedule: ${schedule.name} (${schedule.id})`)
      const deleted = await deleteSchedule(userId, orgId, schedule.id, orchestratorUrl, true)
      if (deleted) {
        deletedCount++
      }
    }
  }

  return deletedCount
}
