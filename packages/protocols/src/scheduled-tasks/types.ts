import { z } from 'zod'

/**
 * Scheduled Tasks Protocol Types
 *
 * Defines entities for agent-proposed schedules, schedule management,
 * and execution tracking. Schedules allow users to run agents automatically
 * at specified times.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/**
 * Schedule type determines how timing is specified
 */
export const ScheduleTypeSchema = z.enum([
  'cron',       // Standard cron expression (e.g., "0 9 * * 1-5")
  'interval',   // Fixed interval (e.g., every 4 hours)
  'one_time',   // Single execution at a specific time
])
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>

/**
 * Schedule status lifecycle
 */
export const ScheduleStatusSchema = z.enum([
  'pending_approval',  // Agent proposed, awaiting user approval
  'active',            // Approved and running on schedule
  'paused',            // Temporarily paused by user
  'completed',         // One-time schedule that has executed
  'disabled',          // Permanently disabled (can be re-enabled)
  'failed',            // Too many consecutive failures
  'expired',           // Past end date
])
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>

/**
 * Execution result status
 */
export const ExecutionStatusSchema = z.enum([
  'pending',     // Scheduled, not yet started
  'running',     // Currently executing
  'succeeded',   // Completed successfully
  'failed',      // Failed with error
  'cancelled',   // Cancelled by user or system
  'skipped',     // Skipped (e.g., previous run still active)
  'retrying',    // Failed, attempting retry
])
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>

/**
 * Notification channels
 */
export const NotificationChannelSchema = z.enum([
  'none',        // No notifications
  'in_app',      // In-app notification (Activity Pane)
  'email',       // Email notification
  'webhook',     // Custom webhook callback
])
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>

/**
 * Notification trigger events
 */
export const NotificationTriggerSchema = z.enum([
  'on_start',        // When execution starts
  'on_success',      // When execution succeeds
  'on_failure',      // When execution fails
  'on_retry',        // When retry is attempted
])
export type NotificationTrigger = z.infer<typeof NotificationTriggerSchema>

/**
 * Subscription tier limits for schedules
 */
export const SCHEDULE_TIER_LIMITS = {
  free: 1,
  starter: 2,
  pro: 3,
  max: 10,
} as const
export type ScheduleTier = keyof typeof SCHEDULE_TIER_LIMITS

// =============================================================================
// NOTIFICATION SETTINGS
// =============================================================================

export const NotificationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.array(NotificationChannelSchema).default(['in_app']),
  triggers: z.array(NotificationTriggerSchema).default(['on_failure']),
  // Webhook-specific settings
  webhookUrl: z.string().url().optional(),
  webhookHeaders: z.record(z.string()).optional(),
  // Email-specific settings
  emailRecipients: z.array(z.string().email()).optional(),
})
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

export const RetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(5).default(3),
  retryDelayMs: z.number().int().min(1000).max(3600000).default(60000), // 1s - 1hr, default 1min
  backoffMultiplier: z.number().min(1).max(10).default(2), // Exponential backoff
  retryOn: z.array(z.string()).default(['timeout', 'rate_limit', 'server_error']), // Error types to retry
})
export type RetryConfig = z.infer<typeof RetryConfigSchema>

// =============================================================================
// CONTEXT SNAPSHOT
// =============================================================================

/**
 * File reference for context snapshot
 */
export const FileReferenceSnapshotSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  snapshotContent: z.boolean().default(false), // If true, content was captured at creation
})
export type FileReferenceSnapshot = z.infer<typeof FileReferenceSnapshotSchema>

/**
 * Captures the context at schedule creation time for consistent execution
 */
export const ContextSnapshotSchema = z.object({
  // Files/folders that should be included in agent context
  fileReferences: z.array(FileReferenceSnapshotSchema).optional(),
  // Memory IDs to include
  memoryIds: z.array(z.string()).optional(),
  // Agent-specific configuration overrides
  agentConfig: z.record(z.any()).optional(),
  // Brand context (if applicable)
  brandId: z.string().uuid().optional(),
  // Captured at
  capturedAt: z.string().datetime(),
})
export type ContextSnapshot = z.infer<typeof ContextSnapshotSchema>

// =============================================================================
// INTERVAL SPECIFICATION
// =============================================================================

export const IntervalUnitSchema = z.enum(['minutes', 'hours', 'days', 'weeks'])
export type IntervalUnit = z.infer<typeof IntervalUnitSchema>

export const IntervalSpecSchema = z.object({
  value: z.number().int().positive(),
  unit: IntervalUnitSchema,
})
export type IntervalSpec = z.infer<typeof IntervalSpecSchema>

// =============================================================================
// SCHEDULE ENTITY (Database Record)
// =============================================================================

export const ScheduleSchema = z.object({
  // Identity
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  userId: z.string(), // Creator/owner

  // Agent binding
  agentId: z.string(),
  agentName: z.string().optional(),
  agentUrl: z.string().url().optional(),

  // User-facing info
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  prompt: z.string().min(1).max(10000), // The instruction to execute

  // Schedule type and timing
  scheduleType: ScheduleTypeSchema,
  cron: z.string().max(100).optional(),           // For cron type
  interval: IntervalSpecSchema.optional(),         // For interval type
  oneTimeAt: z.string().datetime().optional(),     // For one_time type
  timezone: z.string().default('UTC'),
  scheduleDisplay: z.string().optional(),          // Human-readable (e.g., "Every Monday at 9am")

  // Date bounds
  startAt: z.string().datetime().optional(),       // When schedule becomes active
  endAt: z.string().datetime().optional(),         // When schedule expires

  // Status
  status: ScheduleStatusSchema,

  // Execution tracking
  nextRunAt: z.string().datetime().optional(),
  lastRunAt: z.string().datetime().optional(),
  lastRunStatus: ExecutionStatusSchema.optional(),
  runCount: z.number().int().default(0),
  successCount: z.number().int().default(0),
  failureCount: z.number().int().default(0),
  consecutiveFailures: z.number().int().default(0),

  // Configuration
  retryConfig: RetryConfigSchema.optional(),
  notificationSettings: NotificationSettingsSchema.optional(),
  contextSnapshot: ContextSnapshotSchema.optional(),

  // Limits
  maxExecutions: z.number().int().positive().optional(), // Stop after N executions
  maxConsecutiveFailures: z.number().int().default(3),   // Pause after N consecutive failures

  // Metadata
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),

  // Source tracking
  sourceConversationId: z.string().uuid().optional(), // Chat that created this
  sourceMessageId: z.string().optional(),             // Message that triggered proposal

  // Dedicated thread for this schedule's executions
  threadId: z.string().uuid().optional(),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pausedAt: z.string().datetime().optional(),
  disabledAt: z.string().datetime().optional(),
})
export type Schedule = z.infer<typeof ScheduleSchema>

// =============================================================================
// SCHEDULE PROPOSAL (Agent -> Client)
// =============================================================================

/**
 * What an agent emits when proposing a schedule via emit_schedule_proposal()
 */
export const ScheduleProposalSchema = z.object({
  type: z.literal('schedule_proposal'),
  proposalId: z.string().uuid(),
  agentId: z.string(),
  agentUrl: z.string().url().optional(),

  // Proposed schedule details
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  prompt: z.string().min(1).max(10000),

  // Timing
  scheduleType: ScheduleTypeSchema,
  cron: z.string().max(100).optional(),
  interval: IntervalSpecSchema.optional(),
  oneTimeAt: z.string().datetime().optional(),
  timezone: z.string().default('UTC'),
  scheduleDisplay: z.string(), // Human-readable (e.g., "Every Monday at 9am")

  // Optional bounds
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  maxExecutions: z.number().int().positive().optional(),

  // Suggested configuration
  suggestedRetryConfig: RetryConfigSchema.optional(),
  suggestedNotifications: NotificationSettingsSchema.optional(),
  suggestedContext: ContextSnapshotSchema.optional(),

  // Agent's reasoning for the schedule
  rationale: z.string().optional(),

  // Human-readable preview of when it will run
  nextRunsPreview: z.array(z.string().datetime()).max(5).optional(),

  // For UI display
  message: z.string().optional(),

  // Timeout for user response
  timeoutMs: z.number().int().positive().default(300000), // 5 minutes
})
export type ScheduleProposal = z.infer<typeof ScheduleProposalSchema>

// =============================================================================
// SCHEDULE RESPONSE (Client -> Agent/System)
// =============================================================================

export const ScheduleResponseActionSchema = z.enum(['confirm', 'edit', 'cancel'])
export type ScheduleResponseAction = z.infer<typeof ScheduleResponseActionSchema>

export const ScheduleResponseSchema = z.object({
  type: z.literal('schedule_response'),
  proposalId: z.string().uuid(),
  action: ScheduleResponseActionSchema,

  // User modifications (if action is 'edit' or 'confirm')
  modifications: z.object({
    name: z.string().min(1).max(255).optional(),
    prompt: z.string().min(1).max(10000).optional(),
    cron: z.string().max(100).optional(),
    interval: IntervalSpecSchema.optional(),
    oneTimeAt: z.string().datetime().optional(),
    timezone: z.string().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    retryConfig: RetryConfigSchema.optional(),
    notificationSettings: NotificationSettingsSchema.optional(),
  }).optional(),

  // Cancellation reason
  cancelReason: z.string().optional(),
})
export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>

// =============================================================================
// SCHEDULE EXECUTION (Individual Run Record)
// =============================================================================

export const ScheduleExecutionSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid(),
  orgId: z.string().uuid(),
  userId: z.string(),

  // Execution identity
  executionNumber: z.number().int().positive(), // Sequential run number

  // Thread/Activity correlation
  threadId: z.string().uuid(),     // Dedicated conversation thread
  activityId: z.string().uuid(),   // Activity Pane entry

  // Status
  status: ExecutionStatusSchema,

  // Timing
  scheduledAt: z.string().datetime(),   // When it was supposed to run
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().optional(),

  // Retry tracking
  retryAttempt: z.number().int().default(0),
  maxRetries: z.number().int().optional(),
  nextRetryAt: z.string().datetime().optional(),

  // Results
  result: z.object({
    success: z.boolean(),
    summary: z.string().optional(),
    outputs: z.array(z.object({
      type: z.string(),
      path: z.string(),
      name: z.string(),
      size: z.number().optional(),
    })).optional(),
    data: z.record(z.any()).optional(),
  }).optional(),

  // Error info
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    retryable: z.boolean(),
  }).optional(),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ScheduleExecution = z.infer<typeof ScheduleExecutionSchema>

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a new schedule proposal
 */
export function createScheduleProposal(
  agentId: string,
  params: {
    name: string
    prompt: string
    scheduleType: ScheduleType
    scheduleDisplay: string
    cron?: string
    interval?: IntervalSpec
    oneTimeAt?: string
    timezone?: string
    description?: string
    rationale?: string
    agentUrl?: string
    message?: string
    nextRunsPreview?: string[]
  }
): ScheduleProposal {
  return {
    type: 'schedule_proposal',
    proposalId: crypto.randomUUID(),
    agentId,
    agentUrl: params.agentUrl,
    name: params.name,
    description: params.description,
    prompt: params.prompt,
    scheduleType: params.scheduleType,
    scheduleDisplay: params.scheduleDisplay,
    cron: params.cron,
    interval: params.interval,
    oneTimeAt: params.oneTimeAt,
    timezone: params.timezone ?? 'UTC',
    rationale: params.rationale,
    message: params.message,
    nextRunsPreview: params.nextRunsPreview,
    timeoutMs: 300000,
  }
}

/**
 * Get tier limit for schedules
 */
export function getScheduleLimit(tier: ScheduleTier): number {
  return SCHEDULE_TIER_LIMITS[tier]
}

/**
 * Check if schedule can be created based on tier
 */
export function canCreateSchedule(
  tier: ScheduleTier,
  currentCount: number
): boolean {
  return currentCount < SCHEDULE_TIER_LIMITS[tier]
}

/**
 * Calculate next run time from interval
 */
export function getNextRunFromInterval(
  interval: IntervalSpec,
  fromDate: Date = new Date()
): Date {
  const ms = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  }
  return new Date(fromDate.getTime() + interval.value * ms[interval.unit])
}

/**
 * Format interval as human-readable string
 */
export function formatInterval(interval: IntervalSpec): string {
  const unitLabels = {
    minutes: interval.value === 1 ? 'minute' : 'minutes',
    hours: interval.value === 1 ? 'hour' : 'hours',
    days: interval.value === 1 ? 'day' : 'days',
    weeks: interval.value === 1 ? 'week' : 'weeks',
  }
  return `Every ${interval.value} ${unitLabels[interval.unit]}`
}
