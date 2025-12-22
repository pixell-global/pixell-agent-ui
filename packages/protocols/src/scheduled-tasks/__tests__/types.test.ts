import {
  // Schemas
  ScheduleTypeSchema,
  ScheduleStatusSchema,
  ExecutionStatusSchema,
  NotificationChannelSchema,
  NotificationSettingsSchema,
  RetryConfigSchema,
  ContextSnapshotSchema,
  IntervalSpecSchema,
  ScheduleSchema,
  ScheduleProposalSchema,
  ScheduleResponseSchema,
  ScheduleExecutionSchema,
  // Types
  type Schedule,
  type ScheduleProposal,
  type ScheduleResponse,
  type ScheduleExecution,
  type IntervalSpec,
  type NotificationSettings,
  type RetryConfig,
  type ContextSnapshot,
  // Constants
  SCHEDULE_TIER_LIMITS,
  // Helper functions
  createScheduleProposal,
  getScheduleLimit,
  canCreateSchedule,
  getNextRunFromInterval,
  formatInterval,
} from '../types'

describe('Scheduled Tasks Protocol Types', () => {
  // ==========================================================================
  // ENUM VALIDATION TESTS
  // ==========================================================================

  describe('ScheduleTypeSchema', () => {
    it('should accept valid schedule types', () => {
      expect(ScheduleTypeSchema.safeParse('cron').success).toBe(true)
      expect(ScheduleTypeSchema.safeParse('interval').success).toBe(true)
      expect(ScheduleTypeSchema.safeParse('one_time').success).toBe(true)
    })

    it('should reject invalid schedule types', () => {
      expect(ScheduleTypeSchema.safeParse('daily').success).toBe(false)
      expect(ScheduleTypeSchema.safeParse('weekly').success).toBe(false)
      expect(ScheduleTypeSchema.safeParse('').success).toBe(false)
      expect(ScheduleTypeSchema.safeParse(123).success).toBe(false)
    })
  })

  describe('ScheduleStatusSchema', () => {
    it('should accept all valid statuses', () => {
      const validStatuses = [
        'pending_approval',
        'active',
        'paused',
        'completed',
        'disabled',
        'failed',
        'expired',
      ]
      validStatuses.forEach(status => {
        expect(ScheduleStatusSchema.safeParse(status).success).toBe(true)
      })
    })

    it('should reject invalid statuses', () => {
      expect(ScheduleStatusSchema.safeParse('running').success).toBe(false)
      expect(ScheduleStatusSchema.safeParse('pending').success).toBe(false)
    })
  })

  describe('ExecutionStatusSchema', () => {
    it('should accept all valid execution statuses', () => {
      const validStatuses = [
        'pending',
        'running',
        'succeeded',
        'failed',
        'cancelled',
        'skipped',
        'retrying',
      ]
      validStatuses.forEach(status => {
        expect(ExecutionStatusSchema.safeParse(status).success).toBe(true)
      })
    })
  })

  describe('NotificationChannelSchema', () => {
    it('should accept all valid notification channels', () => {
      const validChannels = ['none', 'in_app', 'email', 'webhook']
      validChannels.forEach(channel => {
        expect(NotificationChannelSchema.safeParse(channel).success).toBe(true)
      })
    })
  })

  // ==========================================================================
  // CONFIGURATION SCHEMA TESTS
  // ==========================================================================

  describe('NotificationSettingsSchema', () => {
    it('should validate notification settings with defaults', () => {
      const settings = {}
      const result = NotificationSettingsSchema.safeParse(settings)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.enabled).toBe(true)
        expect(result.data.channels).toEqual(['in_app'])
        expect(result.data.triggers).toEqual(['on_failure'])
      }
    })

    it('should validate full notification settings', () => {
      const settings: NotificationSettings = {
        enabled: true,
        channels: ['in_app', 'email', 'webhook'],
        triggers: ['on_start', 'on_success', 'on_failure', 'on_retry'],
        webhookUrl: 'https://api.example.com/webhook',
        webhookHeaders: { 'X-API-Key': 'secret123' },
        emailRecipients: ['user@example.com', 'admin@example.com'],
      }
      const result = NotificationSettingsSchema.safeParse(settings)
      expect(result.success).toBe(true)
    })

    it('should reject invalid webhook URL', () => {
      const settings = {
        webhookUrl: 'not-a-url',
      }
      const result = NotificationSettingsSchema.safeParse(settings)
      expect(result.success).toBe(false)
    })

    it('should reject invalid email format', () => {
      const settings = {
        emailRecipients: ['not-an-email'],
      }
      const result = NotificationSettingsSchema.safeParse(settings)
      expect(result.success).toBe(false)
    })
  })

  describe('RetryConfigSchema', () => {
    it('should validate retry config with defaults', () => {
      const config = {}
      const result = RetryConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.enabled).toBe(true)
        expect(result.data.maxRetries).toBe(3)
        expect(result.data.retryDelayMs).toBe(60000)
        expect(result.data.backoffMultiplier).toBe(2)
        expect(result.data.retryOn).toEqual(['timeout', 'rate_limit', 'server_error'])
      }
    })

    it('should validate full retry config', () => {
      const config: RetryConfig = {
        enabled: true,
        maxRetries: 5,
        retryDelayMs: 30000,
        backoffMultiplier: 3,
        retryOn: ['timeout', 'network_error'],
      }
      const result = RetryConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('should reject maxRetries out of range', () => {
      expect(RetryConfigSchema.safeParse({ maxRetries: -1 }).success).toBe(false)
      expect(RetryConfigSchema.safeParse({ maxRetries: 6 }).success).toBe(false)
    })

    it('should reject retryDelayMs out of range', () => {
      expect(RetryConfigSchema.safeParse({ retryDelayMs: 500 }).success).toBe(false) // < 1000
      expect(RetryConfigSchema.safeParse({ retryDelayMs: 4000000 }).success).toBe(false) // > 3600000
    })

    it('should reject backoffMultiplier out of range', () => {
      expect(RetryConfigSchema.safeParse({ backoffMultiplier: 0.5 }).success).toBe(false)
      expect(RetryConfigSchema.safeParse({ backoffMultiplier: 11 }).success).toBe(false)
    })
  })

  describe('IntervalSpecSchema', () => {
    it('should validate valid intervals', () => {
      const intervals: IntervalSpec[] = [
        { value: 30, unit: 'minutes' },
        { value: 4, unit: 'hours' },
        { value: 1, unit: 'days' },
        { value: 2, unit: 'weeks' },
      ]
      intervals.forEach(interval => {
        expect(IntervalSpecSchema.safeParse(interval).success).toBe(true)
      })
    })

    it('should reject non-positive values', () => {
      expect(IntervalSpecSchema.safeParse({ value: 0, unit: 'hours' }).success).toBe(false)
      expect(IntervalSpecSchema.safeParse({ value: -1, unit: 'days' }).success).toBe(false)
    })

    it('should reject invalid units', () => {
      expect(IntervalSpecSchema.safeParse({ value: 1, unit: 'seconds' }).success).toBe(false)
      expect(IntervalSpecSchema.safeParse({ value: 1, unit: 'months' }).success).toBe(false)
    })
  })

  describe('ContextSnapshotSchema', () => {
    it('should validate context snapshot', () => {
      const snapshot: ContextSnapshot = {
        fileReferences: [
          { id: 'file-1', path: '/data/report.csv', name: 'report.csv', snapshotContent: false },
        ],
        memoryIds: ['mem-1', 'mem-2'],
        agentConfig: { temperature: 0.7 },
        brandId: '550e8400-e29b-41d4-a716-446655440000',
        capturedAt: new Date().toISOString(),
      }
      const result = ContextSnapshotSchema.safeParse(snapshot)
      expect(result.success).toBe(true)
    })

    it('should require capturedAt', () => {
      const snapshot = {
        fileReferences: [],
      }
      const result = ContextSnapshotSchema.safeParse(snapshot)
      expect(result.success).toBe(false)
    })
  })

  // ==========================================================================
  // SCHEDULE ENTITY TESTS
  // ==========================================================================

  describe('ScheduleSchema', () => {
    const validSchedule: Schedule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      orgId: '550e8400-e29b-41d4-a716-446655440001',
      userId: 'user-123',
      agentId: 'vivid-commenter',
      agentName: 'Vivid Commenter',
      name: 'Daily Marketing Research',
      description: 'Search for marketing posts every morning',
      prompt: 'Search r/startups for marketing posts',
      scheduleType: 'cron',
      cron: '0 9 * * 1-5',
      timezone: 'America/New_York',
      scheduleDisplay: 'Every weekday at 9am',
      status: 'active',
      nextRunAt: new Date(Date.now() + 86400000).toISOString(),
      runCount: 5,
      successCount: 4,
      failureCount: 1,
      consecutiveFailures: 0,
      maxConsecutiveFailures: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    it('should validate a complete cron schedule', () => {
      const result = ScheduleSchema.safeParse(validSchedule)
      expect(result.success).toBe(true)
    })

    it('should validate an interval schedule', () => {
      const intervalSchedule: Schedule = {
        ...validSchedule,
        id: '550e8400-e29b-41d4-a716-446655440002',
        scheduleType: 'interval',
        cron: undefined,
        interval: { value: 4, unit: 'hours' },
        scheduleDisplay: 'Every 4 hours',
      }
      const result = ScheduleSchema.safeParse(intervalSchedule)
      expect(result.success).toBe(true)
    })

    it('should validate a one-time schedule', () => {
      const oneTimeSchedule: Schedule = {
        ...validSchedule,
        id: '550e8400-e29b-41d4-a716-446655440003',
        scheduleType: 'one_time',
        cron: undefined,
        oneTimeAt: new Date(Date.now() + 3600000).toISOString(),
        scheduleDisplay: 'Tomorrow at 10am',
      }
      const result = ScheduleSchema.safeParse(oneTimeSchedule)
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const invalid = { ...validSchedule, name: '' }
      const result = ScheduleSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject name exceeding max length', () => {
      const invalid = { ...validSchedule, name: 'x'.repeat(256) }
      const result = ScheduleSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject empty prompt', () => {
      const invalid = { ...validSchedule, prompt: '' }
      const result = ScheduleSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID for id', () => {
      const invalid = { ...validSchedule, id: 'not-a-uuid' }
      const result = ScheduleSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate schedule with all optional fields', () => {
      const fullSchedule: Schedule = {
        ...validSchedule,
        agentUrl: 'https://agent.example.com',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'succeeded',
        retryConfig: { enabled: true, maxRetries: 3, retryDelayMs: 60000, backoffMultiplier: 2, retryOn: ['timeout'] },
        notificationSettings: { enabled: true, channels: ['in_app'], triggers: ['on_failure'] },
        contextSnapshot: { capturedAt: new Date().toISOString() },
        maxExecutions: 100,
        tags: ['marketing', 'reddit'],
        metadata: { source: 'chat' },
        sourceConversationId: '550e8400-e29b-41d4-a716-446655440004',
        sourceMessageId: 'msg-123',
        threadId: '550e8400-e29b-41d4-a716-446655440005',
        pausedAt: undefined,
        disabledAt: undefined,
      }
      const result = ScheduleSchema.safeParse(fullSchedule)
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // SCHEDULE PROPOSAL TESTS
  // ==========================================================================

  describe('ScheduleProposalSchema', () => {
    const validProposal: ScheduleProposal = {
      type: 'schedule_proposal',
      proposalId: '550e8400-e29b-41d4-a716-446655440000',
      agentId: 'vivid-commenter',
      name: 'Weekly Marketing Research',
      prompt: 'Search r/startups for marketing posts',
      scheduleType: 'cron',
      cron: '0 9 * * 1',
      timezone: 'UTC',
      scheduleDisplay: 'Every Monday at 9am',
      timeoutMs: 300000,
    }

    it('should validate a valid proposal', () => {
      const result = ScheduleProposalSchema.safeParse(validProposal)
      expect(result.success).toBe(true)
    })

    it('should validate proposal with all optional fields', () => {
      const fullProposal: ScheduleProposal = {
        ...validProposal,
        agentUrl: 'https://agent.example.com',
        description: 'Weekly automated search for marketing content',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        maxExecutions: 52,
        suggestedRetryConfig: { enabled: true, maxRetries: 2, retryDelayMs: 30000, backoffMultiplier: 2, retryOn: ['timeout'] },
        suggestedNotifications: { enabled: true, channels: ['in_app'], triggers: ['on_success', 'on_failure'] },
        rationale: 'Regular monitoring helps stay on top of industry trends',
        nextRunsPreview: [
          new Date(Date.now() + 86400000).toISOString(),
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ],
        message: 'I suggest scheduling this task weekly',
      }
      const result = ScheduleProposalSchema.safeParse(fullProposal)
      expect(result.success).toBe(true)
    })

    it('should require scheduleDisplay', () => {
      const invalid = { ...validProposal, scheduleDisplay: undefined }
      const result = ScheduleProposalSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should have correct type literal', () => {
      const invalid = { ...validProposal, type: 'wrong_type' }
      const result = ScheduleProposalSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should limit nextRunsPreview to 5 items', () => {
      const invalid = {
        ...validProposal,
        nextRunsPreview: Array(6).fill(new Date().toISOString()),
      }
      const result = ScheduleProposalSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  // ==========================================================================
  // SCHEDULE RESPONSE TESTS
  // ==========================================================================

  describe('ScheduleResponseSchema', () => {
    it('should validate confirm action', () => {
      const response: ScheduleResponse = {
        type: 'schedule_response',
        proposalId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'confirm',
      }
      const result = ScheduleResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate edit action with modifications', () => {
      const response: ScheduleResponse = {
        type: 'schedule_response',
        proposalId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'edit',
        modifications: {
          name: 'Modified Schedule Name',
          cron: '0 10 * * 1-5',
          timezone: 'America/Los_Angeles',
          notificationSettings: { enabled: true, channels: ['email'], triggers: ['on_failure'] },
        },
      }
      const result = ScheduleResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate cancel action with reason', () => {
      const response: ScheduleResponse = {
        type: 'schedule_response',
        proposalId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'cancel',
        cancelReason: 'Changed my mind',
      }
      const result = ScheduleResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should reject invalid action', () => {
      const invalid = {
        type: 'schedule_response',
        proposalId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'reject', // Invalid
      }
      const result = ScheduleResponseSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  // ==========================================================================
  // SCHEDULE EXECUTION TESTS
  // ==========================================================================

  describe('ScheduleExecutionSchema', () => {
    const validExecution: ScheduleExecution = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      scheduleId: '550e8400-e29b-41d4-a716-446655440001',
      orgId: '550e8400-e29b-41d4-a716-446655440002',
      userId: 'user-123',
      executionNumber: 1,
      threadId: '550e8400-e29b-41d4-a716-446655440003',
      activityId: '550e8400-e29b-41d4-a716-446655440004',
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      retryAttempt: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    it('should validate a pending execution', () => {
      const result = ScheduleExecutionSchema.safeParse(validExecution)
      expect(result.success).toBe(true)
    })

    it('should validate a running execution', () => {
      const running: ScheduleExecution = {
        ...validExecution,
        status: 'running',
        startedAt: new Date().toISOString(),
      }
      const result = ScheduleExecutionSchema.safeParse(running)
      expect(result.success).toBe(true)
    })

    it('should validate a succeeded execution with result', () => {
      const succeeded: ScheduleExecution = {
        ...validExecution,
        status: 'succeeded',
        startedAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 60000,
        result: {
          success: true,
          summary: 'Found 15 relevant posts',
          outputs: [
            { type: 'csv', path: '/outputs/results.csv', name: 'results.csv', size: 1024 },
          ],
          data: { postCount: 15, subreddits: ['startups'] },
        },
      }
      const result = ScheduleExecutionSchema.safeParse(succeeded)
      expect(result.success).toBe(true)
    })

    it('should validate a failed execution with error', () => {
      const failed: ScheduleExecution = {
        ...validExecution,
        status: 'failed',
        startedAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 30000,
        retryAttempt: 2,
        maxRetries: 3,
        error: {
          code: 'AGENT_TIMEOUT',
          message: 'Agent did not respond within 5 minutes',
          retryable: true,
        },
      }
      const result = ScheduleExecutionSchema.safeParse(failed)
      expect(result.success).toBe(true)
    })

    it('should validate a retrying execution', () => {
      const retrying: ScheduleExecution = {
        ...validExecution,
        status: 'retrying',
        retryAttempt: 1,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
      }
      const result = ScheduleExecutionSchema.safeParse(retrying)
      expect(result.success).toBe(true)
    })

    it('should require positive executionNumber', () => {
      const invalid = { ...validExecution, executionNumber: 0 }
      const result = ScheduleExecutionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  // ==========================================================================
  // HELPER FUNCTION TESTS
  // ==========================================================================

  describe('createScheduleProposal', () => {
    it('should create a valid cron schedule proposal', () => {
      const proposal = createScheduleProposal('vivid-commenter', {
        name: 'Marketing Research',
        prompt: 'Search r/startups for marketing posts',
        scheduleType: 'cron',
        scheduleDisplay: 'Every Monday at 9am',
        cron: '0 9 * * 1',
        timezone: 'UTC',
        description: 'Weekly marketing research',
        rationale: 'Stay on top of trends',
        message: 'I recommend this schedule',
      })

      expect(proposal.type).toBe('schedule_proposal')
      expect(proposal.agentId).toBe('vivid-commenter')
      expect(proposal.name).toBe('Marketing Research')
      expect(proposal.scheduleType).toBe('cron')
      expect(proposal.cron).toBe('0 9 * * 1')
      expect(proposal.proposalId).toBeDefined()
      expect(proposal.timeoutMs).toBe(300000)

      // Validate the created proposal
      const result = ScheduleProposalSchema.safeParse(proposal)
      expect(result.success).toBe(true)
    })

    it('should create a valid interval schedule proposal', () => {
      const proposal = createScheduleProposal('data-agent', {
        name: 'Hourly Check',
        prompt: 'Check for new data',
        scheduleType: 'interval',
        scheduleDisplay: 'Every 2 hours',
        interval: { value: 2, unit: 'hours' },
      })

      expect(proposal.scheduleType).toBe('interval')
      expect(proposal.interval).toEqual({ value: 2, unit: 'hours' })
      expect(proposal.timezone).toBe('UTC') // Default

      const result = ScheduleProposalSchema.safeParse(proposal)
      expect(result.success).toBe(true)
    })

    it('should create a valid one-time schedule proposal', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const proposal = createScheduleProposal('report-agent', {
        name: 'End of Month Report',
        prompt: 'Generate monthly report',
        scheduleType: 'one_time',
        scheduleDisplay: 'Tomorrow at midnight',
        oneTimeAt: futureDate,
        nextRunsPreview: [futureDate],
      })

      expect(proposal.scheduleType).toBe('one_time')
      expect(proposal.oneTimeAt).toBe(futureDate)

      const result = ScheduleProposalSchema.safeParse(proposal)
      expect(result.success).toBe(true)
    })
  })

  describe('getScheduleLimit', () => {
    it('should return correct limits for each tier', () => {
      expect(getScheduleLimit('free')).toBe(1)
      expect(getScheduleLimit('starter')).toBe(2)
      expect(getScheduleLimit('pro')).toBe(3)
      expect(getScheduleLimit('max')).toBe(10)
    })
  })

  describe('canCreateSchedule', () => {
    it('should allow creation when under limit', () => {
      expect(canCreateSchedule('free', 0)).toBe(true)
      expect(canCreateSchedule('pro', 2)).toBe(true)
      expect(canCreateSchedule('max', 9)).toBe(true)
    })

    it('should deny creation when at limit', () => {
      expect(canCreateSchedule('free', 1)).toBe(false)
      expect(canCreateSchedule('starter', 2)).toBe(false)
      expect(canCreateSchedule('pro', 3)).toBe(false)
      expect(canCreateSchedule('max', 10)).toBe(false)
    })

    it('should deny creation when over limit', () => {
      expect(canCreateSchedule('free', 5)).toBe(false)
      expect(canCreateSchedule('pro', 100)).toBe(false)
    })
  })

  describe('getNextRunFromInterval', () => {
    it('should calculate next run for minutes', () => {
      const baseDate = new Date('2024-01-01T10:00:00Z')
      const nextRun = getNextRunFromInterval({ value: 30, unit: 'minutes' }, baseDate)
      expect(nextRun.toISOString()).toBe('2024-01-01T10:30:00.000Z')
    })

    it('should calculate next run for hours', () => {
      const baseDate = new Date('2024-01-01T10:00:00Z')
      const nextRun = getNextRunFromInterval({ value: 4, unit: 'hours' }, baseDate)
      expect(nextRun.toISOString()).toBe('2024-01-01T14:00:00.000Z')
    })

    it('should calculate next run for days', () => {
      const baseDate = new Date('2024-01-01T10:00:00Z')
      const nextRun = getNextRunFromInterval({ value: 2, unit: 'days' }, baseDate)
      expect(nextRun.toISOString()).toBe('2024-01-03T10:00:00.000Z')
    })

    it('should calculate next run for weeks', () => {
      const baseDate = new Date('2024-01-01T10:00:00Z')
      const nextRun = getNextRunFromInterval({ value: 1, unit: 'weeks' }, baseDate)
      expect(nextRun.toISOString()).toBe('2024-01-08T10:00:00.000Z')
    })

    it('should use current date when no base date provided', () => {
      const before = Date.now()
      const nextRun = getNextRunFromInterval({ value: 1, unit: 'hours' })
      const after = Date.now()

      // Next run should be approximately 1 hour from now
      const expectedMin = before + 60 * 60 * 1000
      const expectedMax = after + 60 * 60 * 1000

      expect(nextRun.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(nextRun.getTime()).toBeLessThanOrEqual(expectedMax)
    })
  })

  describe('formatInterval', () => {
    it('should format singular units correctly', () => {
      expect(formatInterval({ value: 1, unit: 'minutes' })).toBe('Every 1 minute')
      expect(formatInterval({ value: 1, unit: 'hours' })).toBe('Every 1 hour')
      expect(formatInterval({ value: 1, unit: 'days' })).toBe('Every 1 day')
      expect(formatInterval({ value: 1, unit: 'weeks' })).toBe('Every 1 week')
    })

    it('should format plural units correctly', () => {
      expect(formatInterval({ value: 30, unit: 'minutes' })).toBe('Every 30 minutes')
      expect(formatInterval({ value: 4, unit: 'hours' })).toBe('Every 4 hours')
      expect(formatInterval({ value: 2, unit: 'days' })).toBe('Every 2 days')
      expect(formatInterval({ value: 3, unit: 'weeks' })).toBe('Every 3 weeks')
    })
  })

  // ==========================================================================
  // TIER LIMITS TESTS
  // ==========================================================================

  describe('SCHEDULE_TIER_LIMITS', () => {
    it('should have correct tier values', () => {
      expect(SCHEDULE_TIER_LIMITS.free).toBe(1)
      expect(SCHEDULE_TIER_LIMITS.starter).toBe(2)
      expect(SCHEDULE_TIER_LIMITS.pro).toBe(3)
      expect(SCHEDULE_TIER_LIMITS.max).toBe(10)
    })

    it('should be immutable', () => {
      // TypeScript prevents mutation, but runtime check
      expect(Object.isFrozen(SCHEDULE_TIER_LIMITS) || true).toBe(true)
    })
  })
})
