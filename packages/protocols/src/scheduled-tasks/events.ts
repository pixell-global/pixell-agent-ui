import { z } from 'zod'
import {
  ScheduleSchema,
  ScheduleStatusSchema,
  ScheduleProposalSchema,
  ExecutionStatusSchema,
} from './types'

/**
 * Scheduled Tasks Event Protocol
 *
 * Defines SSE/WebSocket events for real-time updates on schedule
 * lifecycle and execution status.
 */

// =============================================================================
// SCHEDULE LIFECYCLE EVENTS
// =============================================================================

/**
 * Emitted when a schedule is created (after approval)
 */
export const ScheduleCreatedEventSchema = z.object({
  type: z.literal('schedule_created'),
  schedule: ScheduleSchema,
  fromProposal: z.boolean().default(false),
  proposalId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
})
export type ScheduleCreatedEvent = z.infer<typeof ScheduleCreatedEventSchema>

/**
 * Emitted when a schedule is updated
 */
export const ScheduleUpdatedEventSchema = z.object({
  type: z.literal('schedule_updated'),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  changes: z.record(z.any()), // Changed fields
  previousStatus: ScheduleStatusSchema.optional(),
  newStatus: ScheduleStatusSchema.optional(),
  timestamp: z.string().datetime(),
})
export type ScheduleUpdatedEvent = z.infer<typeof ScheduleUpdatedEventSchema>

/**
 * Emitted when a schedule is paused
 */
export const SchedulePausedEventSchema = z.object({
  type: z.literal('schedule_paused'),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  pausedBy: z.enum(['user', 'system']),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
})
export type SchedulePausedEvent = z.infer<typeof SchedulePausedEventSchema>

/**
 * Emitted when a schedule is resumed
 */
export const ScheduleResumedEventSchema = z.object({
  type: z.literal('schedule_resumed'),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  nextRunAt: z.string().datetime().optional(),
  timestamp: z.string().datetime(),
})
export type ScheduleResumedEvent = z.infer<typeof ScheduleResumedEventSchema>

/**
 * Emitted when a schedule is deleted
 */
export const ScheduleDeletedEventSchema = z.object({
  type: z.literal('schedule_deleted'),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  timestamp: z.string().datetime(),
})
export type ScheduleDeletedEvent = z.infer<typeof ScheduleDeletedEventSchema>

/**
 * Emitted when schedule status changes to failed (consecutive failures)
 */
export const ScheduleFailedEventSchema = z.object({
  type: z.literal('schedule_failed'),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  consecutiveFailures: z.number().int(),
  lastError: z.object({
    code: z.string(),
    message: z.string(),
  }),
  timestamp: z.string().datetime(),
})
export type ScheduleFailedEvent = z.infer<typeof ScheduleFailedEventSchema>

// =============================================================================
// EXECUTION EVENTS
// =============================================================================

/**
 * Emitted when an execution is scheduled (queued)
 */
export const ExecutionScheduledEventSchema = z.object({
  type: z.literal('execution_scheduled'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  scheduledAt: z.string().datetime(),
  executionNumber: z.number().int(),
  timestamp: z.string().datetime(),
})
export type ExecutionScheduledEvent = z.infer<typeof ExecutionScheduledEventSchema>

/**
 * Emitted when execution starts
 */
export const ExecutionStartedEventSchema = z.object({
  type: z.literal('execution_started'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  threadId: z.string().uuid(),
  activityId: z.string().uuid(),
  timestamp: z.string().datetime(),
})
export type ExecutionStartedEvent = z.infer<typeof ExecutionStartedEventSchema>

/**
 * Emitted during execution for progress updates
 */
export const ExecutionProgressEventSchema = z.object({
  type: z.literal('execution_progress'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  phase: z.string().optional(), // Current UPEE phase
  timestamp: z.string().datetime(),
})
export type ExecutionProgressEvent = z.infer<typeof ExecutionProgressEventSchema>

/**
 * Emitted when execution completes successfully
 */
export const ExecutionSucceededEventSchema = z.object({
  type: z.literal('execution_succeeded'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  result: z.object({
    summary: z.string().optional(),
    outputs: z.array(z.object({
      type: z.string(),
      path: z.string(),
      name: z.string(),
    })).optional(),
  }).optional(),
  durationMs: z.number().int(),
  nextRunAt: z.string().datetime().optional(),
  // Updated stats
  totalRuns: z.number().int().optional(),
  successfulRuns: z.number().int().optional(),
  timestamp: z.string().datetime(),
})
export type ExecutionSucceededEvent = z.infer<typeof ExecutionSucceededEventSchema>

/**
 * Emitted when execution fails
 */
export const ExecutionFailedEventSchema = z.object({
  type: z.literal('execution_failed'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
  retryAttempt: z.number().int(),
  willRetry: z.boolean(),
  nextRetryAt: z.string().datetime().optional(),
  timestamp: z.string().datetime(),
})
export type ExecutionFailedEvent = z.infer<typeof ExecutionFailedEventSchema>

/**
 * Emitted when execution is cancelled
 */
export const ExecutionCancelledEventSchema = z.object({
  type: z.literal('execution_cancelled'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  cancelledBy: z.enum(['user', 'system']),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
})
export type ExecutionCancelledEvent = z.infer<typeof ExecutionCancelledEventSchema>

/**
 * Emitted when execution is being retried
 */
export const ExecutionRetryingEventSchema = z.object({
  type: z.literal('execution_retrying'),
  executionId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  scheduleName: z.string().optional(),
  retryAttempt: z.number().int(),
  maxRetries: z.number().int(),
  retryAt: z.string().datetime(),
  previousError: z.string(),
  timestamp: z.string().datetime(),
})
export type ExecutionRetryingEvent = z.infer<typeof ExecutionRetryingEventSchema>

// =============================================================================
// PROPOSAL EVENTS
// =============================================================================

/**
 * Wrapper event when agent proposes a schedule (for SSE streaming)
 */
export const ScheduleProposalEventSchema = z.object({
  type: z.literal('schedule_proposal_received'),
  proposal: ScheduleProposalSchema,
  conversationId: z.string().uuid().optional(),
  messageId: z.string().optional(),
  timestamp: z.string().datetime(),
})
export type ScheduleProposalEvent = z.infer<typeof ScheduleProposalEventSchema>

/**
 * Emitted when proposal times out
 */
export const ScheduleProposalTimeoutEventSchema = z.object({
  type: z.literal('schedule_proposal_timeout'),
  proposalId: z.string().uuid(),
  timestamp: z.string().datetime(),
})
export type ScheduleProposalTimeoutEvent = z.infer<typeof ScheduleProposalTimeoutEventSchema>

// =============================================================================
// TIER LIMIT EVENTS
// =============================================================================

/**
 * Emitted when user approaches or hits tier limit
 */
export const ScheduleTierLimitEventSchema = z.object({
  type: z.literal('schedule_tier_limit'),
  currentCount: z.number().int(),
  maxCount: z.number().int(),
  tier: z.enum(['free', 'starter', 'pro', 'max']),
  isAtLimit: z.boolean(),
  timestamp: z.string().datetime(),
})
export type ScheduleTierLimitEvent = z.infer<typeof ScheduleTierLimitEventSchema>

// =============================================================================
// UNION TYPE FOR ALL EVENTS
// =============================================================================

export const ScheduleEventSchema = z.discriminatedUnion('type', [
  // Schedule lifecycle
  ScheduleCreatedEventSchema,
  ScheduleUpdatedEventSchema,
  SchedulePausedEventSchema,
  ScheduleResumedEventSchema,
  ScheduleDeletedEventSchema,
  ScheduleFailedEventSchema,
  // Execution lifecycle
  ExecutionScheduledEventSchema,
  ExecutionStartedEventSchema,
  ExecutionProgressEventSchema,
  ExecutionSucceededEventSchema,
  ExecutionFailedEventSchema,
  ExecutionCancelledEventSchema,
  ExecutionRetryingEventSchema,
  // Proposals
  ScheduleProposalEventSchema,
  ScheduleProposalTimeoutEventSchema,
  // Tier limits
  ScheduleTierLimitEventSchema,
])
export type ScheduleEvent = z.infer<typeof ScheduleEventSchema>

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isScheduleCreatedEvent(event: unknown): event is ScheduleCreatedEvent {
  return (event as ScheduleCreatedEvent)?.type === 'schedule_created'
}

export function isScheduleUpdatedEvent(event: unknown): event is ScheduleUpdatedEvent {
  return (event as ScheduleUpdatedEvent)?.type === 'schedule_updated'
}

export function isSchedulePausedEvent(event: unknown): event is SchedulePausedEvent {
  return (event as SchedulePausedEvent)?.type === 'schedule_paused'
}

export function isScheduleResumedEvent(event: unknown): event is ScheduleResumedEvent {
  return (event as ScheduleResumedEvent)?.type === 'schedule_resumed'
}

export function isScheduleDeletedEvent(event: unknown): event is ScheduleDeletedEvent {
  return (event as ScheduleDeletedEvent)?.type === 'schedule_deleted'
}

export function isExecutionStartedEvent(event: unknown): event is ExecutionStartedEvent {
  return (event as ExecutionStartedEvent)?.type === 'execution_started'
}

export function isExecutionSucceededEvent(event: unknown): event is ExecutionSucceededEvent {
  return (event as ExecutionSucceededEvent)?.type === 'execution_succeeded'
}

export function isExecutionFailedEvent(event: unknown): event is ExecutionFailedEvent {
  return (event as ExecutionFailedEvent)?.type === 'execution_failed'
}

export function isScheduleProposalEvent(event: unknown): event is ScheduleProposalEvent {
  return (event as ScheduleProposalEvent)?.type === 'schedule_proposal_received'
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a schedule created event
 */
export function createScheduleCreatedEvent(
  schedule: z.infer<typeof ScheduleSchema>,
  options?: { fromProposal?: boolean; proposalId?: string }
): ScheduleCreatedEvent {
  return {
    type: 'schedule_created',
    schedule,
    fromProposal: options?.fromProposal ?? false,
    proposalId: options?.proposalId,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create an execution started event
 */
export function createExecutionStartedEvent(params: {
  executionId: string
  scheduleId: string
  scheduleName?: string
  threadId: string
  activityId: string
}): ExecutionStartedEvent {
  return {
    type: 'execution_started',
    ...params,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create an execution succeeded event
 */
export function createExecutionSucceededEvent(params: {
  executionId: string
  scheduleId: string
  scheduleName?: string
  durationMs: number
  nextRunAt?: string
  result?: { summary?: string; outputs?: Array<{ type: string; path: string; name: string }> }
  totalRuns?: number
  successfulRuns?: number
}): ExecutionSucceededEvent {
  return {
    type: 'execution_succeeded',
    ...params,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create an execution failed event
 */
export function createExecutionFailedEvent(params: {
  executionId: string
  scheduleId: string
  scheduleName?: string
  error: { code: string; message: string; retryable: boolean }
  retryAttempt: number
  willRetry: boolean
  nextRetryAt?: string
}): ExecutionFailedEvent {
  return {
    type: 'execution_failed',
    ...params,
    timestamp: new Date().toISOString(),
  }
}
