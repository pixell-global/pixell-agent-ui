import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Request, Response } from 'express'

// Use vi.hoisted() to ensure mock variables are available before vi.mock runs
const { mockRepo, mockSchedulerService } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    getStats: vi.fn(),
    getById: vi.fn(),
    listExecutions: vi.fn(),
    countForUser: vi.fn(),
    create: vi.fn(),
    updateNextRun: vi.fn(),
    createFromProposal: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    approve: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getExecutionById: vi.fn(),
    cancelExecution: vi.fn(),
  },
  mockSchedulerService: {
    registerSchedule: vi.fn(),
    unregisterSchedule: vi.fn(),
    triggerManualRun: vi.fn(),
  },
}))

// Mock dependencies
vi.mock('@pixell/db-mysql', () => ({
  SchedulesRepo: vi.fn().mockImplementation(() => mockRepo),
  ListSchedulesOptions: {},
  CreateScheduleInput: {},
  UpdateScheduleInput: {},
  ScheduleType: {},
  ScheduleStatus: {},
  IntervalUnit: {},
}))

vi.mock('../services/scheduler-service', () => ({
  SchedulerService: {
    getInstance: vi.fn(() => mockSchedulerService),
  },
}))

vi.mock('cron-parser', () => ({
  parseExpression: vi.fn(() => ({
    next: () => ({
      toDate: () => new Date('2025-01-15T10:00:00Z'),
    }),
  })),
}))

// Import handlers after mocks are set up
import {
  listSchedulesHandler,
  getScheduleHandler,
  createScheduleHandler,
  createFromProposalHandler,
  updateScheduleHandler,
  deleteScheduleHandler,
  approveScheduleHandler,
  pauseScheduleHandler,
  resumeScheduleHandler,
  runScheduleHandler,
  listExecutionsHandler,
  getExecutionHandler,
  cancelExecutionHandler,
  getStatsHandler,
} from '../api/schedules'

// Helper to create mock request
function createMockRequest(options: {
  headers?: Record<string, string>
  params?: Record<string, string>
  query?: Record<string, string>
  body?: any
} = {}): Partial<Request> {
  // If headers is explicitly passed (even empty), use it. Otherwise use default
  const defaultHeaders = options.headers !== undefined
    ? options.headers
    : { 'x-user-id': 'test-user-123' }

  return {
    headers: defaultHeaders,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
  }
}

// Helper to create mock response
function createMockResponse(): Partial<Response> & {
  statusCode: number
  jsonData: any
} {
  const res: any = {
    statusCode: 200,
    jsonData: null,
    status: function(code: number) {
      this.statusCode = code
      return this
    },
    json: function(data: any) {
      this.jsonData = data
      return this
    },
  }
  return res
}

// Sample test data
const sampleSchedule = {
  id: 'schedule-123',
  userId: 'test-user-123',
  agentId: 'agent-1',
  agentName: 'Test Agent',
  name: 'Daily Task',
  description: 'A daily automated task',
  prompt: 'Do something useful',
  scheduleType: 'cron' as const,
  cronExpression: '0 9 * * *',
  timezone: 'UTC',
  status: 'active' as const,
  runCount: 5,
  successCount: 4,
  failureCount: 1,
  consecutiveFailures: 0,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  nextRunAt: new Date('2025-01-15T09:00:00Z'),
  lastRunAt: new Date('2025-01-14T09:00:00Z'),
}

const sampleExecution = {
  id: 'exec-123',
  scheduleId: 'schedule-123',
  orgId: 'test-user-123',
  scheduledAt: new Date('2025-01-14T09:00:00Z'),
  status: 'succeeded' as const,
  executionNumber: 5,
  retryAttempt: 0,
  startedAt: new Date('2025-01-14T09:00:01Z'),
  completedAt: new Date('2025-01-14T09:05:00Z'),
  result: { summary: 'Task completed successfully' },
}

const sampleStats = {
  total: 3,
  active: 2,
  paused: 1,
  failed: 0,
  completed: 0,
  totalExecutions: 50,
  successfulExecutions: 45,
  failedExecutions: 5,
}

describe('Schedules API Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // LIST SCHEDULES
  // =========================================================================

  describe('listSchedulesHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {} })
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
      expect(res.jsonData.ok).toBe(false)
      expect(res.jsonData.error).toBe('User ID required')
    })

    it('should list schedules with default pagination', async () => {
      mockRepo.list.mockResolvedValue([sampleSchedule])
      mockRepo.getStats.mockResolvedValue(sampleStats)

      const req = createMockRequest()
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(res.jsonData.schedules).toHaveLength(1)
      expect(res.jsonData.stats).toEqual(sampleStats)
      expect(res.jsonData.pagination.limit).toBe(50)
      expect(res.jsonData.pagination.offset).toBe(0)
      expect(mockRepo.list).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        limit: 50,
        offset: 0,
      }))
    })

    it('should filter schedules by status', async () => {
      mockRepo.list.mockResolvedValue([sampleSchedule])
      mockRepo.getStats.mockResolvedValue(sampleStats)

      const req = createMockRequest({ query: { status: 'active' } })
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(mockRepo.list).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        status: 'active',
      }))
    })

    it('should filter schedules by multiple statuses', async () => {
      mockRepo.list.mockResolvedValue([sampleSchedule])
      mockRepo.getStats.mockResolvedValue(sampleStats)

      const req = createMockRequest({ query: { status: 'active,paused' } })
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(mockRepo.list).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        status: ['active', 'paused'],
      }))
    })

    it('should filter schedules by agentId', async () => {
      mockRepo.list.mockResolvedValue([sampleSchedule])
      mockRepo.getStats.mockResolvedValue(sampleStats)

      const req = createMockRequest({ query: { agentId: 'agent-1' } })
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(mockRepo.list).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        agentId: 'agent-1',
      }))
    })

    it('should respect custom pagination', async () => {
      mockRepo.list.mockResolvedValue([])
      mockRepo.getStats.mockResolvedValue(sampleStats)

      const req = createMockRequest({ query: { limit: '10', offset: '20' } })
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(mockRepo.list).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        limit: 10,
        offset: 20,
      }))
      expect(res.jsonData.pagination.limit).toBe(10)
      expect(res.jsonData.pagination.offset).toBe(20)
    })

    it('should include deleted schedules when requested', async () => {
      mockRepo.list.mockResolvedValue([])
      mockRepo.getStats.mockResolvedValue(sampleStats)

      const req = createMockRequest({ query: { includeDeleted: 'true' } })
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(mockRepo.list).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        includeDeleted: true,
      }))
    })

    it('should handle database errors gracefully', async () => {
      mockRepo.list.mockRejectedValue(new Error('Database connection failed'))

      const req = createMockRequest()
      const res = createMockResponse()

      await listSchedulesHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(500)
      expect(res.jsonData.ok).toBe(false)
      expect(res.jsonData.error).toBe('Failed to list schedules')
    })
  })

  // =========================================================================
  // GET SCHEDULE
  // =========================================================================

  describe('getScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await getScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
      expect(res.jsonData.error).toBe('User ID required')
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await getScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
      expect(res.jsonData.error).toBe('Schedule not found')
    })

    it('should return schedule with recent executions', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.listExecutions.mockResolvedValue([sampleExecution])

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await getScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(res.jsonData.schedule).toEqual(sampleSchedule)
      expect(res.jsonData.executions).toHaveLength(1)
      expect(mockRepo.listExecutions).toHaveBeenCalledWith('schedule-123', { limit: 10 })
    })
  })

  // =========================================================================
  // CREATE SCHEDULE
  // =========================================================================

  describe('createScheduleHandler', () => {
    const validCronBody = {
      agentId: 'agent-1',
      agentName: 'Test Agent',
      name: 'Daily Task',
      prompt: 'Do something useful',
      scheduleType: 'cron',
      cronExpression: '0 9 * * *',
      timezone: 'America/New_York',
    }

    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, body: validCronBody })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 400 if required fields are missing', async () => {
      const req = createMockRequest({ body: { name: 'Test' } })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Missing required fields')
    })

    it('should return 400 if schedule type is invalid', async () => {
      const req = createMockRequest({
        body: { ...validCronBody, scheduleType: 'invalid' },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Invalid scheduleType')
    })

    it('should return 400 if cron expression is missing for cron type', async () => {
      const req = createMockRequest({
        body: { ...validCronBody, cronExpression: undefined },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('cronExpression required')
    })

    it('should return 400 if interval fields missing for interval type', async () => {
      const req = createMockRequest({
        body: { ...validCronBody, scheduleType: 'interval', cronExpression: undefined },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('intervalValue and intervalUnit required')
    })

    it('should return 400 if oneTimeAt missing for one_time type', async () => {
      const req = createMockRequest({
        body: { ...validCronBody, scheduleType: 'one_time', cronExpression: undefined },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('oneTimeAt required')
    })

    it('should return 403 if tier limit is reached', async () => {
      mockRepo.countForUser.mockResolvedValue(1)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'free' },
        body: validCronBody,
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(403)
      expect(res.jsonData.error).toContain('Schedule limit reached')
      expect(res.jsonData.limit).toBe(1)
    })

    it('should allow pro users to create more schedules', async () => {
      mockRepo.countForUser.mockResolvedValue(2) // Already has 2
      mockRepo.create.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'pro' },
        body: validCronBody,
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      // Pro tier allows 3, user has 2, so creation should succeed
      expect(res.statusCode).toBe(201)
    })

    it('should create cron schedule successfully', async () => {
      mockRepo.countForUser.mockResolvedValue(0)
      mockRepo.create.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({ body: validCronBody })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(201)
      expect(res.jsonData.ok).toBe(true)
      expect(mockRepo.create).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          agentId: 'agent-1',
          name: 'Daily Task',
          scheduleType: 'cron',
          cronExpression: '0 9 * * *',
        })
      )
    })

    it('should create interval schedule successfully', async () => {
      mockRepo.countForUser.mockResolvedValue(0)
      mockRepo.create.mockResolvedValue({ ...sampleSchedule, scheduleType: 'interval' })
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, scheduleType: 'interval' })

      const req = createMockRequest({
        body: {
          agentId: 'agent-1',
          name: 'Hourly Task',
          prompt: 'Run every hour',
          scheduleType: 'interval',
          intervalValue: 2,
          intervalUnit: 'hours',
        },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(201)
      expect(mockRepo.create).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          scheduleType: 'interval',
          intervalValue: 2,
          intervalUnit: 'hours',
        })
      )
    })

    it('should create one_time schedule successfully', async () => {
      mockRepo.countForUser.mockResolvedValue(0)
      mockRepo.create.mockResolvedValue({ ...sampleSchedule, scheduleType: 'one_time' })
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, scheduleType: 'one_time' })

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const req = createMockRequest({
        body: {
          agentId: 'agent-1',
          name: 'One-time Task',
          prompt: 'Run once',
          scheduleType: 'one_time',
          oneTimeAt: futureDate,
        },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(201)
      expect(mockRepo.create).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          scheduleType: 'one_time',
          oneTimeAt: expect.any(Date),
        })
      )
    })

    it('should register active schedule with scheduler service', async () => {
      mockRepo.countForUser.mockResolvedValue(0)
      mockRepo.create.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({ body: validCronBody })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(mockSchedulerService.registerSchedule).toHaveBeenCalledWith(sampleSchedule)
    })
  })

  // =========================================================================
  // CREATE FROM PROPOSAL
  // =========================================================================

  describe('createFromProposalHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {} })
      const res = createMockResponse()

      await createFromProposalHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 400 if proposalId is missing', async () => {
      const req = createMockRequest({ body: {} })
      const res = createMockResponse()

      await createFromProposalHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toBe('proposalId required')
    })

    it('should return 403 if tier limit is reached', async () => {
      mockRepo.countForUser.mockResolvedValue(1)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'free' },
        body: { proposalId: 'proposal-123' },
      })
      const res = createMockResponse()

      await createFromProposalHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(403)
    })

    it('should create schedule from proposal successfully', async () => {
      mockRepo.countForUser.mockResolvedValue(0)
      mockRepo.createFromProposal.mockResolvedValue({
        ...sampleSchedule,
        status: 'pending_approval',
      })

      const req = createMockRequest({
        body: {
          proposalId: 'proposal-123',
          agentId: 'agent-1',
          name: 'Proposed Task',
          prompt: 'Do something',
          scheduleType: 'cron',
          cronExpression: '0 10 * * *',
        },
      })
      const res = createMockResponse()

      await createFromProposalHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(201)
      expect(res.jsonData.ok).toBe(true)
      expect(res.jsonData.message).toContain('awaiting approval')
      expect(mockRepo.createFromProposal).toHaveBeenCalledWith(
        'test-user-123',
        'proposal-123',
        expect.any(Object)
      )
    })
  })

  // =========================================================================
  // UPDATE SCHEDULE
  // =========================================================================

  describe('updateScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await updateScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.update.mockResolvedValue(null)

      const req = createMockRequest({
        params: { id: 'non-existent' },
        body: { name: 'Updated Name' },
      })
      const res = createMockResponse()

      await updateScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should update allowed fields only', async () => {
      mockRepo.update.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, name: 'Updated Name' })

      const req = createMockRequest({
        params: { id: 'schedule-123' },
        body: {
          name: 'Updated Name',
          description: 'Updated description',
          status: 'active', // Not in allowed fields, should be ignored
          userId: 'hacker', // Not in allowed fields, should be ignored
        },
      })
      const res = createMockResponse()

      await updateScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(mockRepo.update).toHaveBeenCalledWith(
        'schedule-123',
        'test-user-123',
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
        })
      )
      // Verify unauthorized fields were not passed
      const updateCall = mockRepo.update.mock.calls[0][2]
      expect(updateCall.status).toBeUndefined()
      expect(updateCall.userId).toBeUndefined()
    })

    it('should re-register schedule with scheduler when timing config changes', async () => {
      mockRepo.update.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({
        params: { id: 'schedule-123' },
        body: { cronExpression: '0 10 * * *' },
      })
      const res = createMockResponse()

      await updateScheduleHandler(req as Request, res as Response)

      expect(mockSchedulerService.unregisterSchedule).toHaveBeenCalledWith('schedule-123')
      expect(mockSchedulerService.registerSchedule).toHaveBeenCalledWith(sampleSchedule)
    })

    it('should handle date field conversions', async () => {
      mockRepo.update.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue(sampleSchedule)

      const futureDate = '2025-06-01T10:00:00Z'
      const req = createMockRequest({
        params: { id: 'schedule-123' },
        body: {
          validFrom: futureDate,
          validUntil: null, // Should be converted to null
        },
      })
      const res = createMockResponse()

      await updateScheduleHandler(req as Request, res as Response)

      const updateCall = mockRepo.update.mock.calls[0][2]
      expect(updateCall.validFrom).toBeInstanceOf(Date)
      expect(updateCall.validUntil).toBeNull()
    })
  })

  // =========================================================================
  // DELETE SCHEDULE
  // =========================================================================

  describe('deleteScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await deleteScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should perform soft delete by default', async () => {
      mockRepo.softDelete.mockResolvedValue(true)

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await deleteScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.deleted).toBe(true)
      expect(mockRepo.softDelete).toHaveBeenCalledWith('schedule-123', 'test-user-123')
      expect(mockRepo.hardDelete).not.toHaveBeenCalled()
    })

    it('should perform hard delete when requested', async () => {
      mockRepo.hardDelete.mockResolvedValue(true)

      const req = createMockRequest({
        params: { id: 'schedule-123' },
        query: { hard: 'true' },
      })
      const res = createMockResponse()

      await deleteScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(mockRepo.hardDelete).toHaveBeenCalledWith('schedule-123', 'test-user-123')
      expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.softDelete.mockResolvedValue(false)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await deleteScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should unregister schedule from scheduler', async () => {
      mockRepo.softDelete.mockResolvedValue(true)

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await deleteScheduleHandler(req as Request, res as Response)

      expect(mockSchedulerService.unregisterSchedule).toHaveBeenCalledWith('schedule-123')
    })
  })

  // =========================================================================
  // APPROVE SCHEDULE
  // =========================================================================

  describe('approveScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await approveScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await approveScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should return 400 if schedule is not pending approval', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'active' })

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await approveScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Cannot approve schedule with status')
    })

    it('should approve pending schedule successfully', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'pending_approval' })
      mockRepo.approve.mockResolvedValue({ ...sampleSchedule, status: 'active' })

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await approveScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(mockRepo.approve).toHaveBeenCalledWith('schedule-123', 'test-user-123', expect.any(Date))
      expect(mockSchedulerService.registerSchedule).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // PAUSE SCHEDULE
  // =========================================================================

  describe('pauseScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await pauseScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await pauseScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should return 400 if schedule is not active', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'paused' })

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await pauseScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Cannot pause schedule with status')
    })

    it('should pause active schedule successfully', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.pause.mockResolvedValue({ ...sampleSchedule, status: 'paused' })

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await pauseScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(mockRepo.pause).toHaveBeenCalledWith('schedule-123', 'test-user-123')
      expect(mockSchedulerService.unregisterSchedule).toHaveBeenCalledWith('schedule-123')
    })
  })

  // =========================================================================
  // RESUME SCHEDULE
  // =========================================================================

  describe('resumeScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await resumeScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await resumeScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should return 400 if schedule is not paused or failed', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule) // status: active

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await resumeScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Cannot resume schedule with status')
    })

    it('should resume paused schedule successfully', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'paused' })
      mockRepo.resume.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await resumeScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(mockRepo.resume).toHaveBeenCalledWith('schedule-123', 'test-user-123', expect.any(Date))
      expect(mockSchedulerService.registerSchedule).toHaveBeenCalled()
    })

    it('should resume failed schedule successfully', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'failed' })
      mockRepo.resume.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await resumeScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
    })
  })

  // =========================================================================
  // RUN SCHEDULE (Manual Trigger)
  // =========================================================================

  describe('runScheduleHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await runScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await runScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should return 400 if schedule is not active or paused', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'pending_approval' })

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await runScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Cannot manually run schedule with status')
    })

    it('should trigger manual run for active schedule', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockSchedulerService.triggerManualRun.mockResolvedValue(sampleExecution)

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await runScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(res.jsonData.execution).toEqual(sampleExecution)
      expect(mockSchedulerService.triggerManualRun).toHaveBeenCalledWith(sampleSchedule)
    })

    it('should allow manual run for paused schedule', async () => {
      mockRepo.getById.mockResolvedValue({ ...sampleSchedule, status: 'paused' })
      mockSchedulerService.triggerManualRun.mockResolvedValue(sampleExecution)

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await runScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
    })
  })

  // =========================================================================
  // LIST EXECUTIONS
  // =========================================================================

  describe('listExecutionsHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {}, params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await listExecutionsHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({ params: { id: 'non-existent' } })
      const res = createMockResponse()

      await listExecutionsHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should list executions with default pagination', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.listExecutions.mockResolvedValue([sampleExecution])

      const req = createMockRequest({ params: { id: 'schedule-123' } })
      const res = createMockResponse()

      await listExecutionsHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.executions).toHaveLength(1)
      expect(mockRepo.listExecutions).toHaveBeenCalledWith('schedule-123', expect.objectContaining({
        limit: 20,
        offset: 0,
      }))
    })

    it('should filter executions by status', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.listExecutions.mockResolvedValue([])

      const req = createMockRequest({
        params: { id: 'schedule-123' },
        query: { status: 'failed' },
      })
      const res = createMockResponse()

      await listExecutionsHandler(req as Request, res as Response)

      expect(mockRepo.listExecutions).toHaveBeenCalledWith('schedule-123', expect.objectContaining({
        status: 'failed',
      }))
    })

    it('should support custom pagination', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.listExecutions.mockResolvedValue([])

      const req = createMockRequest({
        params: { id: 'schedule-123' },
        query: { limit: '5', offset: '10' },
      })
      const res = createMockResponse()

      await listExecutionsHandler(req as Request, res as Response)

      expect(mockRepo.listExecutions).toHaveBeenCalledWith('schedule-123', expect.objectContaining({
        limit: 5,
        offset: 10,
      }))
    })
  })

  // =========================================================================
  // GET EXECUTION
  // =========================================================================

  describe('getExecutionHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({
        headers: {},
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await getExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await getExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
      expect(res.jsonData.error).toBe('Schedule not found')
    })

    it('should return 404 if execution not found', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue(null)

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'non-existent' },
      })
      const res = createMockResponse()

      await getExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
      expect(res.jsonData.error).toBe('Execution not found')
    })

    it('should return 404 if execution belongs to different schedule', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue({
        ...sampleExecution,
        scheduleId: 'other-schedule',
      })

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await getExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
      expect(res.jsonData.error).toBe('Execution not found')
    })

    it('should return execution successfully', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue(sampleExecution)

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await getExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(res.jsonData.execution).toEqual(sampleExecution)
    })
  })

  // =========================================================================
  // CANCEL EXECUTION
  // =========================================================================

  describe('cancelExecutionHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({
        headers: {},
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await cancelExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return 404 if schedule not found', async () => {
      mockRepo.getById.mockResolvedValue(null)

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await cancelExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(404)
    })

    it('should return 400 if execution is not cancellable', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue({
        ...sampleExecution,
        status: 'succeeded',
      })

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await cancelExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(400)
      expect(res.jsonData.error).toContain('Cannot cancel execution with status')
    })

    it('should cancel pending execution', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue({
        ...sampleExecution,
        status: 'pending',
      })

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await cancelExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.cancelled).toBe(true)
      expect(mockRepo.cancelExecution).toHaveBeenCalledWith('exec-123')
    })

    it('should cancel running execution', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue({
        ...sampleExecution,
        status: 'running',
      })

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await cancelExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
    })

    it('should cancel retrying execution', async () => {
      mockRepo.getById.mockResolvedValue(sampleSchedule)
      mockRepo.getExecutionById.mockResolvedValue({
        ...sampleExecution,
        status: 'retrying',
      })

      const req = createMockRequest({
        params: { id: 'schedule-123', executionId: 'exec-123' },
      })
      const res = createMockResponse()

      await cancelExecutionHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
    })
  })

  // =========================================================================
  // GET STATS
  // =========================================================================

  describe('getStatsHandler', () => {
    it('should return 401 if user ID is missing', async () => {
      const req = createMockRequest({ headers: {} })
      const res = createMockResponse()

      await getStatsHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(401)
    })

    it('should return stats with tier information (free tier)', async () => {
      mockRepo.getStats.mockResolvedValue(sampleStats)
      mockRepo.countForUser.mockResolvedValue(1)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'free' },
      })
      const res = createMockResponse()

      await getStatsHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(200)
      expect(res.jsonData.ok).toBe(true)
      expect(res.jsonData.stats).toEqual(sampleStats)
      expect(res.jsonData.tier).toEqual({
        name: 'free',
        limit: 1,
        used: 1,
        remaining: 0,
      })
    })

    it('should return stats with tier information (pro tier)', async () => {
      mockRepo.getStats.mockResolvedValue(sampleStats)
      mockRepo.countForUser.mockResolvedValue(2)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'pro' },
      })
      const res = createMockResponse()

      await getStatsHandler(req as Request, res as Response)

      expect(res.jsonData.tier).toEqual({
        name: 'pro',
        limit: 3,
        used: 2,
        remaining: 1,
      })
    })

    it('should return stats with tier information (max tier)', async () => {
      mockRepo.getStats.mockResolvedValue(sampleStats)
      mockRepo.countForUser.mockResolvedValue(5)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'max' },
      })
      const res = createMockResponse()

      await getStatsHandler(req as Request, res as Response)

      expect(res.jsonData.tier).toEqual({
        name: 'max',
        limit: 10,
        used: 5,
        remaining: 5,
      })
    })

    it('should default to free tier for unknown tier', async () => {
      mockRepo.getStats.mockResolvedValue(sampleStats)
      mockRepo.countForUser.mockResolvedValue(0)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'unknown' },
      })
      const res = createMockResponse()

      await getStatsHandler(req as Request, res as Response)

      expect(res.jsonData.tier.limit).toBe(1) // Default to free tier limit
    })

    it('should handle remaining being negative (cap at 0)', async () => {
      mockRepo.getStats.mockResolvedValue(sampleStats)
      mockRepo.countForUser.mockResolvedValue(5) // More than free limit

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': 'free' },
      })
      const res = createMockResponse()

      await getStatsHandler(req as Request, res as Response)

      expect(res.jsonData.tier.remaining).toBe(0) // Math.max(0, 1-5) = 0
    })
  })

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle unexpected errors in all handlers gracefully', async () => {
      const unexpectedError = new Error('Unexpected database error')
      mockRepo.list.mockRejectedValue(unexpectedError)
      mockRepo.getById.mockRejectedValue(unexpectedError)
      mockRepo.countForUser.mockRejectedValue(unexpectedError)
      mockRepo.getStats.mockRejectedValue(unexpectedError)

      const handlers = [
        { handler: listSchedulesHandler, req: createMockRequest() },
        { handler: getScheduleHandler, req: createMockRequest({ params: { id: '123' } }) },
        { handler: createScheduleHandler, req: createMockRequest({ body: { agentId: 'a', name: 'n', prompt: 'p', scheduleType: 'cron', cronExpression: '* * * * *' } }) },
        { handler: getStatsHandler, req: createMockRequest() },
      ]

      for (const { handler, req } of handlers) {
        const res = createMockResponse()
        await handler(req as Request, res as Response)
        expect(res.statusCode).toBe(500)
        expect(res.jsonData.ok).toBe(false)
      }
    })
  })
})

// =========================================================================
// TIER LIMIT TESTS
// =========================================================================

describe('Tier Limit Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const tierTests = [
    { tier: 'free', limit: 1 },
    { tier: 'starter', limit: 2 },
    { tier: 'pro', limit: 3 },
    { tier: 'max', limit: 10 },
  ]

  tierTests.forEach(({ tier, limit }) => {
    it(`should enforce ${tier} tier limit of ${limit} schedules`, async () => {
      mockRepo.countForUser.mockResolvedValue(limit) // Already at limit

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': tier },
        body: {
          agentId: 'agent-1',
          name: 'New Schedule',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 * * * *',
        },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(403)
      expect(res.jsonData.limit).toBe(limit)
      expect(res.jsonData.current).toBe(limit)
    })

    it(`should allow ${tier} tier to create schedule when under limit`, async () => {
      mockRepo.countForUser.mockResolvedValue(limit - 1) // One under limit
      mockRepo.create.mockResolvedValue(sampleSchedule)
      mockRepo.getById.mockResolvedValue(sampleSchedule)

      const req = createMockRequest({
        headers: { 'x-user-id': 'test-user-123', 'x-user-tier': tier },
        body: {
          agentId: 'agent-1',
          name: 'New Schedule',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 * * * *',
        },
      })
      const res = createMockResponse()

      await createScheduleHandler(req as Request, res as Response)

      expect(res.statusCode).toBe(201)
    })
  })
})
