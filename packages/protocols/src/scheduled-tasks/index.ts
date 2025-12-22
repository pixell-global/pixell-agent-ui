/**
 * Scheduled Tasks Protocol
 *
 * Exports all types and events for the scheduled tasks feature.
 * This module provides the protocol definitions for:
 * - Schedule entities and proposals
 * - Execution tracking
 * - Real-time events for WebSocket/SSE
 */

// Core types
export {
  // Enums
  ScheduleTypeSchema,
  ScheduleStatusSchema,
  ExecutionStatusSchema,
  NotificationChannelSchema,
  NotificationTriggerSchema,
  IntervalUnitSchema,
  ScheduleResponseActionSchema,
  type ScheduleType,
  type ScheduleStatus,
  type ExecutionStatus,
  type NotificationChannel,
  type NotificationTrigger,
  type IntervalUnit,
  type ScheduleResponseAction,

  // Constants
  SCHEDULE_TIER_LIMITS,
  type ScheduleTier,

  // Configuration types
  NotificationSettingsSchema,
  RetryConfigSchema,
  ContextSnapshotSchema,
  IntervalSpecSchema,
  FileReferenceSnapshotSchema,
  type NotificationSettings,
  type RetryConfig,
  type ContextSnapshot,
  type IntervalSpec,
  type FileReferenceSnapshot,

  // Main entities
  ScheduleSchema,
  ScheduleProposalSchema,
  ScheduleResponseSchema,
  ScheduleExecutionSchema,
  type Schedule,
  type ScheduleProposal,
  type ScheduleResponse,
  type ScheduleExecution,

  // Helper functions
  createScheduleProposal,
  getScheduleLimit,
  canCreateSchedule,
  getNextRunFromInterval,
  formatInterval,
} from './types'

// Events
export {
  // Schedule lifecycle events
  ScheduleCreatedEventSchema,
  ScheduleUpdatedEventSchema,
  SchedulePausedEventSchema,
  ScheduleResumedEventSchema,
  ScheduleDeletedEventSchema,
  ScheduleFailedEventSchema,
  type ScheduleCreatedEvent,
  type ScheduleUpdatedEvent,
  type SchedulePausedEvent,
  type ScheduleResumedEvent,
  type ScheduleDeletedEvent,
  type ScheduleFailedEvent,

  // Execution events
  ExecutionScheduledEventSchema,
  ExecutionStartedEventSchema,
  ExecutionProgressEventSchema,
  ExecutionSucceededEventSchema,
  ExecutionFailedEventSchema,
  ExecutionCancelledEventSchema,
  ExecutionRetryingEventSchema,
  type ExecutionScheduledEvent,
  type ExecutionStartedEvent,
  type ExecutionProgressEvent,
  type ExecutionSucceededEvent,
  type ExecutionFailedEvent,
  type ExecutionCancelledEvent,
  type ExecutionRetryingEvent,

  // Proposal events
  ScheduleProposalEventSchema,
  ScheduleProposalTimeoutEventSchema,
  type ScheduleProposalEvent,
  type ScheduleProposalTimeoutEvent,

  // Tier limit events
  ScheduleTierLimitEventSchema,
  type ScheduleTierLimitEvent,

  // Union type
  ScheduleEventSchema,
  type ScheduleEvent,

  // Type guards
  isScheduleCreatedEvent,
  isScheduleUpdatedEvent,
  isSchedulePausedEvent,
  isScheduleResumedEvent,
  isScheduleDeletedEvent,
  isExecutionStartedEvent,
  isExecutionSucceededEvent,
  isExecutionFailedEvent,
  isScheduleProposalEvent,

  // Helper functions
  createScheduleCreatedEvent,
  createExecutionStartedEvent,
  createExecutionSucceededEvent,
  createExecutionFailedEvent,
} from './events'
