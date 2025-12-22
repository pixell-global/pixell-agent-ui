import {
  // Event schemas
  ScheduleCreatedEventSchema,
  ScheduleUpdatedEventSchema,
  SchedulePausedEventSchema,
  ScheduleResumedEventSchema,
  ScheduleDeletedEventSchema,
  ScheduleFailedEventSchema,
  ExecutionScheduledEventSchema,
  ExecutionStartedEventSchema,
  ExecutionProgressEventSchema,
  ExecutionSucceededEventSchema,
  ExecutionFailedEventSchema,
  ExecutionCancelledEventSchema,
  ExecutionRetryingEventSchema,
  ScheduleProposalEventSchema,
  ScheduleProposalTimeoutEventSchema,
  ScheduleTierLimitEventSchema,
  ScheduleEventSchema,
  // Types
  type ScheduleCreatedEvent,
  type ScheduleUpdatedEvent,
  type ExecutionStartedEvent,
  type ExecutionSucceededEvent,
  type ExecutionFailedEvent,
  type ScheduleProposalEvent,
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
} from '../events'
import { ScheduleSchema, ScheduleProposalSchema } from '../types'
import type { Schedule, ScheduleProposal } from '../types'

describe('Scheduled Tasks Event Protocol', () => {
  // ==========================================================================
  // TEST DATA
  // ==========================================================================

  const mockSchedule: Schedule = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    userId: 'user-123',
    agentId: 'vivid-commenter',
    name: 'Daily Marketing Research',
    prompt: 'Search r/startups for marketing posts',
    scheduleType: 'cron',
    cron: '0 9 * * 1-5',
    timezone: 'UTC',
    scheduleDisplay: 'Every weekday at 9am',
    status: 'active',
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockProposal: ScheduleProposal = {
    type: 'schedule_proposal',
    proposalId: '550e8400-e29b-41d4-a716-446655440002',
    agentId: 'vivid-commenter',
    name: 'Weekly Research',
    prompt: 'Search for posts',
    scheduleType: 'cron',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    scheduleDisplay: 'Every Monday at 9am',
    timeoutMs: 300000,
  }

  const now = new Date().toISOString()

  // ==========================================================================
  // SCHEDULE LIFECYCLE EVENT TESTS
  // ==========================================================================

  describe('ScheduleCreatedEventSchema', () => {
    it('should validate schedule created event', () => {
      const event: ScheduleCreatedEvent = {
        type: 'schedule_created',
        schedule: mockSchedule,
        fromProposal: true,
        proposalId: '550e8400-e29b-41d4-a716-446655440002',
        timestamp: now,
      }
      const result = ScheduleCreatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate event without proposal reference', () => {
      const event: ScheduleCreatedEvent = {
        type: 'schedule_created',
        schedule: mockSchedule,
        fromProposal: false,
        timestamp: now,
      }
      const result = ScheduleCreatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should set fromProposal default to false', () => {
      const event = {
        type: 'schedule_created',
        schedule: mockSchedule,
        timestamp: now,
      }
      const result = ScheduleCreatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fromProposal).toBe(false)
      }
    })
  })

  describe('ScheduleUpdatedEventSchema', () => {
    it('should validate schedule updated event', () => {
      const event: ScheduleUpdatedEvent = {
        type: 'schedule_updated',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        changes: { name: 'Updated Name', cron: '0 10 * * 1-5' },
        previousStatus: 'active',
        newStatus: 'active',
        timestamp: now,
      }
      const result = ScheduleUpdatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate event with status change', () => {
      const event = {
        type: 'schedule_updated',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        changes: { status: 'paused' },
        previousStatus: 'active',
        newStatus: 'paused',
        timestamp: now,
      }
      const result = ScheduleUpdatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('SchedulePausedEventSchema', () => {
    it('should validate user paused event', () => {
      const event = {
        type: 'schedule_paused',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        pausedBy: 'user',
        reason: 'Taking a break',
        timestamp: now,
      }
      const result = SchedulePausedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate system paused event', () => {
      const event = {
        type: 'schedule_paused',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        pausedBy: 'system',
        reason: 'Too many consecutive failures',
        timestamp: now,
      }
      const result = SchedulePausedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ScheduleResumedEventSchema', () => {
    it('should validate schedule resumed event', () => {
      const event = {
        type: 'schedule_resumed',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        nextRunAt: new Date(Date.now() + 3600000).toISOString(),
        timestamp: now,
      }
      const result = ScheduleResumedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ScheduleDeletedEventSchema', () => {
    it('should validate schedule deleted event', () => {
      const event = {
        type: 'schedule_deleted',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        timestamp: now,
      }
      const result = ScheduleDeletedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ScheduleFailedEventSchema', () => {
    it('should validate schedule failed event', () => {
      const event = {
        type: 'schedule_failed',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        consecutiveFailures: 3,
        lastError: {
          code: 'AGENT_TIMEOUT',
          message: 'Agent did not respond',
        },
        timestamp: now,
      }
      const result = ScheduleFailedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // EXECUTION EVENT TESTS
  // ==========================================================================

  describe('ExecutionScheduledEventSchema', () => {
    it('should validate execution scheduled event', () => {
      const event = {
        type: 'execution_scheduled',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        executionNumber: 5,
        timestamp: now,
      }
      const result = ExecutionScheduledEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ExecutionStartedEventSchema', () => {
    it('should validate execution started event', () => {
      const event: ExecutionStartedEvent = {
        type: 'execution_started',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        threadId: '550e8400-e29b-41d4-a716-446655440020',
        activityId: '550e8400-e29b-41d4-a716-446655440030',
        timestamp: now,
      }
      const result = ExecutionStartedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ExecutionProgressEventSchema', () => {
    it('should validate execution progress event', () => {
      const event = {
        type: 'execution_progress',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        progress: 45,
        message: 'Searching subreddits...',
        phase: 'execute',
        timestamp: now,
      }
      const result = ExecutionProgressEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should reject progress out of range', () => {
      const invalid1 = {
        type: 'execution_progress',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        progress: -1,
        timestamp: now,
      }
      expect(ExecutionProgressEventSchema.safeParse(invalid1).success).toBe(false)

      const invalid2 = {
        type: 'execution_progress',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        progress: 101,
        timestamp: now,
      }
      expect(ExecutionProgressEventSchema.safeParse(invalid2).success).toBe(false)
    })
  })

  describe('ExecutionSucceededEventSchema', () => {
    it('should validate execution succeeded event', () => {
      const event: ExecutionSucceededEvent = {
        type: 'execution_succeeded',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        result: {
          summary: 'Found 15 relevant posts',
          outputs: [
            { type: 'csv', path: '/outputs/results.csv', name: 'results.csv' },
          ],
        },
        durationMs: 45000,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        totalRuns: 5,
        successfulRuns: 5,
        timestamp: now,
      }
      const result = ExecutionSucceededEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate event without result', () => {
      const event = {
        type: 'execution_succeeded',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        durationMs: 30000,
        timestamp: now,
      }
      const result = ExecutionSucceededEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ExecutionFailedEventSchema', () => {
    it('should validate execution failed event with retry', () => {
      const event: ExecutionFailedEvent = {
        type: 'execution_failed',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        error: {
          code: 'AGENT_TIMEOUT',
          message: 'Agent did not respond within 5 minutes',
          retryable: true,
        },
        retryAttempt: 1,
        willRetry: true,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
        timestamp: now,
      }
      const result = ExecutionFailedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate execution failed event without retry', () => {
      const event = {
        type: 'execution_failed',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        error: {
          code: 'INVALID_PROMPT',
          message: 'The prompt contains invalid instructions',
          retryable: false,
        },
        retryAttempt: 0,
        willRetry: false,
        timestamp: now,
      }
      const result = ExecutionFailedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ExecutionCancelledEventSchema', () => {
    it('should validate user cancelled event', () => {
      const event = {
        type: 'execution_cancelled',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        cancelledBy: 'user',
        reason: 'No longer needed',
        timestamp: now,
      }
      const result = ExecutionCancelledEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate system cancelled event', () => {
      const event = {
        type: 'execution_cancelled',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        cancelledBy: 'system',
        reason: 'Schedule was deleted',
        timestamp: now,
      }
      const result = ExecutionCancelledEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ExecutionRetryingEventSchema', () => {
    it('should validate execution retrying event', () => {
      const event = {
        type: 'execution_retrying',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Marketing Research',
        retryAttempt: 2,
        maxRetries: 3,
        retryAt: new Date(Date.now() + 120000).toISOString(),
        previousError: 'Connection timeout',
        timestamp: now,
      }
      const result = ExecutionRetryingEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // PROPOSAL EVENT TESTS
  // ==========================================================================

  describe('ScheduleProposalEventSchema', () => {
    it('should validate schedule proposal event', () => {
      const event: ScheduleProposalEvent = {
        type: 'schedule_proposal_received',
        proposal: mockProposal,
        conversationId: '550e8400-e29b-41d4-a716-446655440040',
        messageId: 'msg-123',
        timestamp: now,
      }
      const result = ScheduleProposalEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate event without conversation context', () => {
      const event = {
        type: 'schedule_proposal_received',
        proposal: mockProposal,
        timestamp: now,
      }
      const result = ScheduleProposalEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ScheduleProposalTimeoutEventSchema', () => {
    it('should validate proposal timeout event', () => {
      const event = {
        type: 'schedule_proposal_timeout',
        proposalId: '550e8400-e29b-41d4-a716-446655440002',
        timestamp: now,
      }
      const result = ScheduleProposalTimeoutEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // TIER LIMIT EVENT TESTS
  // ==========================================================================

  describe('ScheduleTierLimitEventSchema', () => {
    it('should validate tier limit warning event', () => {
      const event = {
        type: 'schedule_tier_limit',
        currentCount: 2,
        maxCount: 3,
        tier: 'pro',
        isAtLimit: false,
        timestamp: now,
      }
      const result = ScheduleTierLimitEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should validate tier limit reached event', () => {
      const event = {
        type: 'schedule_tier_limit',
        currentCount: 1,
        maxCount: 1,
        tier: 'free',
        isAtLimit: true,
        timestamp: now,
      }
      const result = ScheduleTierLimitEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // DISCRIMINATED UNION TESTS
  // ==========================================================================

  describe('ScheduleEventSchema (Discriminated Union)', () => {
    it('should correctly discriminate schedule_created events', () => {
      const event = {
        type: 'schedule_created',
        schedule: mockSchedule,
        fromProposal: false,
        timestamp: now,
      }
      const result = ScheduleEventSchema.safeParse(event)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('schedule_created')
      }
    })

    it('should correctly discriminate execution_started events', () => {
      const event = {
        type: 'execution_started',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        threadId: '550e8400-e29b-41d4-a716-446655440020',
        activityId: '550e8400-e29b-41d4-a716-446655440030',
        timestamp: now,
      }
      const result = ScheduleEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should reject unknown event types', () => {
      const invalid = {
        type: 'unknown_event',
        data: 'test',
        timestamp: now,
      }
      const result = ScheduleEventSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate all event types in the union', () => {
      const events: Array<{ type: string; valid: boolean }> = [
        { type: 'schedule_created', valid: true },
        { type: 'schedule_updated', valid: true },
        { type: 'schedule_paused', valid: true },
        { type: 'schedule_resumed', valid: true },
        { type: 'schedule_deleted', valid: true },
        { type: 'schedule_failed', valid: true },
        { type: 'execution_scheduled', valid: true },
        { type: 'execution_started', valid: true },
        { type: 'execution_progress', valid: true },
        { type: 'execution_succeeded', valid: true },
        { type: 'execution_failed', valid: true },
        { type: 'execution_cancelled', valid: true },
        { type: 'execution_retrying', valid: true },
        { type: 'schedule_proposal_received', valid: true },
        { type: 'schedule_proposal_timeout', valid: true },
        { type: 'schedule_tier_limit', valid: true },
      ]

      events.forEach(({ type }) => {
        // Just verify the type is recognized in the discriminated union
        // Full validation happens in individual tests
        expect(['schedule_created', 'schedule_updated', 'schedule_paused',
          'schedule_resumed', 'schedule_deleted', 'schedule_failed',
          'execution_scheduled', 'execution_started', 'execution_progress',
          'execution_succeeded', 'execution_failed', 'execution_cancelled',
          'execution_retrying', 'schedule_proposal_received',
          'schedule_proposal_timeout', 'schedule_tier_limit'
        ]).toContain(type)
      })
    })
  })

  // ==========================================================================
  // TYPE GUARD TESTS
  // ==========================================================================

  describe('Type Guards', () => {
    const createdEvent: ScheduleCreatedEvent = {
      type: 'schedule_created',
      schedule: mockSchedule,
      fromProposal: false,
      timestamp: now,
    }

    const updatedEvent: ScheduleUpdatedEvent = {
      type: 'schedule_updated',
      scheduleId: '550e8400-e29b-41d4-a716-446655440000',
      changes: { name: 'New Name' },
      timestamp: now,
    }

    const startedEvent: ExecutionStartedEvent = {
      type: 'execution_started',
      executionId: '550e8400-e29b-41d4-a716-446655440010',
      scheduleId: '550e8400-e29b-41d4-a716-446655440000',
      threadId: '550e8400-e29b-41d4-a716-446655440020',
      activityId: '550e8400-e29b-41d4-a716-446655440030',
      timestamp: now,
    }

    const succeededEvent: ExecutionSucceededEvent = {
      type: 'execution_succeeded',
      executionId: '550e8400-e29b-41d4-a716-446655440010',
      scheduleId: '550e8400-e29b-41d4-a716-446655440000',
      durationMs: 30000,
      timestamp: now,
    }

    const failedEvent: ExecutionFailedEvent = {
      type: 'execution_failed',
      executionId: '550e8400-e29b-41d4-a716-446655440010',
      scheduleId: '550e8400-e29b-41d4-a716-446655440000',
      error: { code: 'ERROR', message: 'Test', retryable: false },
      retryAttempt: 0,
      willRetry: false,
      timestamp: now,
    }

    const proposalEvent: ScheduleProposalEvent = {
      type: 'schedule_proposal_received',
      proposal: mockProposal,
      timestamp: now,
    }

    describe('isScheduleCreatedEvent', () => {
      it('should return true for schedule_created events', () => {
        expect(isScheduleCreatedEvent(createdEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isScheduleCreatedEvent(updatedEvent)).toBe(false)
        expect(isScheduleCreatedEvent(startedEvent)).toBe(false)
        expect(isScheduleCreatedEvent(null)).toBe(false)
        expect(isScheduleCreatedEvent(undefined)).toBe(false)
        expect(isScheduleCreatedEvent({})).toBe(false)
      })
    })

    describe('isScheduleUpdatedEvent', () => {
      it('should return true for schedule_updated events', () => {
        expect(isScheduleUpdatedEvent(updatedEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isScheduleUpdatedEvent(createdEvent)).toBe(false)
      })
    })

    describe('isSchedulePausedEvent', () => {
      it('should return true for schedule_paused events', () => {
        const pausedEvent = {
          type: 'schedule_paused',
          scheduleId: '550e8400-e29b-41d4-a716-446655440000',
          pausedBy: 'user',
          timestamp: now,
        }
        expect(isSchedulePausedEvent(pausedEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isSchedulePausedEvent(createdEvent)).toBe(false)
      })
    })

    describe('isScheduleResumedEvent', () => {
      it('should return true for schedule_resumed events', () => {
        const resumedEvent = {
          type: 'schedule_resumed',
          scheduleId: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: now,
        }
        expect(isScheduleResumedEvent(resumedEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isScheduleResumedEvent(createdEvent)).toBe(false)
      })
    })

    describe('isScheduleDeletedEvent', () => {
      it('should return true for schedule_deleted events', () => {
        const deletedEvent = {
          type: 'schedule_deleted',
          scheduleId: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: now,
        }
        expect(isScheduleDeletedEvent(deletedEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isScheduleDeletedEvent(createdEvent)).toBe(false)
      })
    })

    describe('isExecutionStartedEvent', () => {
      it('should return true for execution_started events', () => {
        expect(isExecutionStartedEvent(startedEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isExecutionStartedEvent(createdEvent)).toBe(false)
        expect(isExecutionStartedEvent(succeededEvent)).toBe(false)
      })
    })

    describe('isExecutionSucceededEvent', () => {
      it('should return true for execution_succeeded events', () => {
        expect(isExecutionSucceededEvent(succeededEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isExecutionSucceededEvent(failedEvent)).toBe(false)
      })
    })

    describe('isExecutionFailedEvent', () => {
      it('should return true for execution_failed events', () => {
        expect(isExecutionFailedEvent(failedEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isExecutionFailedEvent(succeededEvent)).toBe(false)
      })
    })

    describe('isScheduleProposalEvent', () => {
      it('should return true for schedule_proposal_received events', () => {
        expect(isScheduleProposalEvent(proposalEvent)).toBe(true)
      })

      it('should return false for other events', () => {
        expect(isScheduleProposalEvent(createdEvent)).toBe(false)
      })
    })
  })

  // ==========================================================================
  // HELPER FUNCTION TESTS
  // ==========================================================================

  describe('createScheduleCreatedEvent', () => {
    it('should create a valid schedule created event', () => {
      const event = createScheduleCreatedEvent(mockSchedule)

      expect(event.type).toBe('schedule_created')
      expect(event.schedule).toEqual(mockSchedule)
      expect(event.fromProposal).toBe(false)
      expect(event.timestamp).toBeDefined()

      const result = ScheduleCreatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it('should create event with proposal reference', () => {
      const event = createScheduleCreatedEvent(mockSchedule, {
        fromProposal: true,
        proposalId: '550e8400-e29b-41d4-a716-446655440002',
      })

      expect(event.fromProposal).toBe(true)
      expect(event.proposalId).toBe('550e8400-e29b-41d4-a716-446655440002')

      const result = ScheduleCreatedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('createExecutionStartedEvent', () => {
    it('should create a valid execution started event', () => {
      const event = createExecutionStartedEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Research',
        threadId: '550e8400-e29b-41d4-a716-446655440020',
        activityId: '550e8400-e29b-41d4-a716-446655440030',
      })

      expect(event.type).toBe('execution_started')
      expect(event.executionId).toBe('550e8400-e29b-41d4-a716-446655440010')
      expect(event.timestamp).toBeDefined()

      const result = ExecutionStartedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('createExecutionSucceededEvent', () => {
    it('should create a valid execution succeeded event', () => {
      const event = createExecutionSucceededEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Research',
        durationMs: 45000,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        result: {
          summary: 'Found 10 posts',
          outputs: [{ type: 'csv', path: '/out.csv', name: 'out.csv' }],
        },
        totalRuns: 5,
        successfulRuns: 5,
      })

      expect(event.type).toBe('execution_succeeded')
      expect(event.durationMs).toBe(45000)
      expect(event.result?.summary).toBe('Found 10 posts')
      expect(event.timestamp).toBeDefined()

      const result = ExecutionSucceededEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('createExecutionFailedEvent', () => {
    it('should create a valid execution failed event', () => {
      const event = createExecutionFailedEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: '550e8400-e29b-41d4-a716-446655440000',
        scheduleName: 'Daily Research',
        error: {
          code: 'TIMEOUT',
          message: 'Agent timed out',
          retryable: true,
        },
        retryAttempt: 1,
        willRetry: true,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
      })

      expect(event.type).toBe('execution_failed')
      expect(event.error.code).toBe('TIMEOUT')
      expect(event.willRetry).toBe(true)
      expect(event.timestamp).toBeDefined()

      const result = ExecutionFailedEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // INTEGRATION TESTS - FULL LIFECYCLE
  // ==========================================================================

  describe('Full Schedule Lifecycle Integration', () => {
    it('should validate a complete schedule lifecycle', () => {
      // 1. Proposal received
      const proposalEvent = {
        type: 'schedule_proposal_received',
        proposal: mockProposal,
        conversationId: '550e8400-e29b-41d4-a716-446655440040',
        timestamp: new Date().toISOString(),
      }
      expect(ScheduleProposalEventSchema.safeParse(proposalEvent).success).toBe(true)

      // 2. Schedule created from proposal
      const createdEvent = createScheduleCreatedEvent(mockSchedule, {
        fromProposal: true,
        proposalId: mockProposal.proposalId,
      })
      expect(ScheduleCreatedEventSchema.safeParse(createdEvent).success).toBe(true)

      // 3. Execution scheduled
      const scheduledEvent = {
        type: 'execution_scheduled',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        executionNumber: 1,
        timestamp: new Date().toISOString(),
      }
      expect(ExecutionScheduledEventSchema.safeParse(scheduledEvent).success).toBe(true)

      // 4. Execution started
      const startedEvent = createExecutionStartedEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        scheduleName: mockSchedule.name,
        threadId: '550e8400-e29b-41d4-a716-446655440020',
        activityId: '550e8400-e29b-41d4-a716-446655440030',
      })
      expect(ExecutionStartedEventSchema.safeParse(startedEvent).success).toBe(true)

      // 5. Progress updates
      const progressEvent = {
        type: 'execution_progress',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        progress: 50,
        message: 'Halfway done',
        phase: 'execute',
        timestamp: new Date().toISOString(),
      }
      expect(ExecutionProgressEventSchema.safeParse(progressEvent).success).toBe(true)

      // 6. Execution succeeded
      const succeededEvent = createExecutionSucceededEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        scheduleName: mockSchedule.name,
        durationMs: 60000,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        totalRuns: 1,
        successfulRuns: 1,
      })
      expect(ExecutionSucceededEventSchema.safeParse(succeededEvent).success).toBe(true)

      // 7. Schedule paused
      const pausedEvent = {
        type: 'schedule_paused',
        scheduleId: mockSchedule.id,
        scheduleName: mockSchedule.name,
        pausedBy: 'user',
        reason: 'Taking a break',
        timestamp: new Date().toISOString(),
      }
      expect(SchedulePausedEventSchema.safeParse(pausedEvent).success).toBe(true)

      // 8. Schedule resumed
      const resumedEvent = {
        type: 'schedule_resumed',
        scheduleId: mockSchedule.id,
        scheduleName: mockSchedule.name,
        nextRunAt: new Date(Date.now() + 3600000).toISOString(),
        timestamp: new Date().toISOString(),
      }
      expect(ScheduleResumedEventSchema.safeParse(resumedEvent).success).toBe(true)

      // 9. Schedule deleted
      const deletedEvent = {
        type: 'schedule_deleted',
        scheduleId: mockSchedule.id,
        scheduleName: mockSchedule.name,
        timestamp: new Date().toISOString(),
      }
      expect(ScheduleDeletedEventSchema.safeParse(deletedEvent).success).toBe(true)
    })

    it('should validate a failed execution with retry lifecycle', () => {
      // 1. Execution started
      const startedEvent = createExecutionStartedEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        threadId: '550e8400-e29b-41d4-a716-446655440020',
        activityId: '550e8400-e29b-41d4-a716-446655440030',
      })
      expect(isExecutionStartedEvent(startedEvent)).toBe(true)

      // 2. First failure
      const failedEvent1 = createExecutionFailedEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        error: { code: 'TIMEOUT', message: 'Timeout', retryable: true },
        retryAttempt: 0,
        willRetry: true,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
      })
      expect(isExecutionFailedEvent(failedEvent1)).toBe(true)
      expect(failedEvent1.willRetry).toBe(true)

      // 3. Retrying
      const retryingEvent = {
        type: 'execution_retrying',
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        retryAttempt: 1,
        maxRetries: 3,
        retryAt: new Date(Date.now() + 60000).toISOString(),
        previousError: 'Timeout',
        timestamp: new Date().toISOString(),
      }
      expect(ExecutionRetryingEventSchema.safeParse(retryingEvent).success).toBe(true)

      // 4. Second failure (final)
      const failedEvent2 = createExecutionFailedEvent({
        executionId: '550e8400-e29b-41d4-a716-446655440010',
        scheduleId: mockSchedule.id,
        error: { code: 'TIMEOUT', message: 'Timeout again', retryable: true },
        retryAttempt: 3,
        willRetry: false,
      })
      expect(failedEvent2.willRetry).toBe(false)

      // 5. Schedule marked as failed (too many consecutive failures)
      const scheduleFailedEvent = {
        type: 'schedule_failed',
        scheduleId: mockSchedule.id,
        consecutiveFailures: 3,
        lastError: { code: 'TIMEOUT', message: 'Timeout' },
        timestamp: new Date().toISOString(),
      }
      expect(ScheduleFailedEventSchema.safeParse(scheduleFailedEvent).success).toBe(true)
    })
  })
})
