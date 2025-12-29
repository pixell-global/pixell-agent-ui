import { Request, Response } from 'express'
import {
  SchedulesRepo,
  ListSchedulesOptions,
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduleType,
  ScheduleStatus,
  IntervalUnit,
} from '@pixell/db-mysql'
import { SchedulerService } from '../services/scheduler-service'

// Initialize repository
const schedulesRepo = new SchedulesRepo()

// Tier limits for schedules
const TIER_LIMITS: Record<string, number> = {
  free: 1,
  starter: 2,
  pro: 3,
  max: 10,
}

// =============================================================================
// SCHEDULES CRUD
// =============================================================================

/**
 * List schedules for a user
 * GET /api/schedules?status=&agentId=&limit=&offset=
 */
export async function listSchedulesHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const options: ListSchedulesOptions = {
      status: parseStatusParam(req.query.status as string | undefined),
      agentId: req.query.agentId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      includeDeleted: req.query.includeDeleted === 'true',
    }

    const schedules = await schedulesRepo.list(userId, options)
    const stats = await schedulesRepo.getStats(userId)

    res.json({
      ok: true,
      schedules,
      stats,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: stats.total,
      },
    })
  } catch (error) {
    console.error('List schedules error:', error)
    res.status(500).json({ ok: false, error: 'Failed to list schedules' })
  }
}

/**
 * Get a single schedule by ID
 * GET /api/schedules/:id
 */
export async function getScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const schedule = await schedulesRepo.getById(id, userId)

    if (!schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    // Get recent executions
    const executions = await schedulesRepo.listExecutions(id, { limit: 10 })

    res.json({ ok: true, schedule, executions })
  } catch (error) {
    console.error('Get schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to get schedule' })
  }
}

/**
 * Create a new schedule
 * POST /api/schedules
 */
export async function createScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    // Check tier limits
    const userTier = (req.headers['x-user-tier'] as string) || 'free'
    const limit = TIER_LIMITS[userTier] || TIER_LIMITS.free
    const currentCount = await schedulesRepo.countForUser(userId)

    if (currentCount >= limit) {
      return res.status(403).json({
        ok: false,
        error: `Schedule limit reached. Your ${userTier} plan allows ${limit} active schedule(s).`,
        limit,
        current: currentCount,
      })
    }

    const {
      agentId,
      agentName,
      name,
      description,
      prompt,
      scheduleType,
      cronExpression,
      intervalValue,
      intervalUnit,
      oneTimeAt,
      timezone,
      retryConfig,
      notificationSettings,
      contextSnapshot,
      validFrom,
      validUntil,
    } = req.body

    // Validate required fields
    if (!agentId || !name || !prompt || !scheduleType) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: agentId, name, prompt, scheduleType',
      })
    }

    // Validate schedule type
    const validTypes: ScheduleType[] = ['cron', 'interval', 'one_time']
    if (!validTypes.includes(scheduleType)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid scheduleType. Must be one of: ${validTypes.join(', ')}`,
      })
    }

    // Validate type-specific fields
    if (scheduleType === 'cron' && !cronExpression) {
      return res.status(400).json({
        ok: false,
        error: 'cronExpression required for cron schedule type',
      })
    }

    if (scheduleType === 'interval' && (!intervalValue || !intervalUnit)) {
      return res.status(400).json({
        ok: false,
        error: 'intervalValue and intervalUnit required for interval schedule type',
      })
    }

    if (scheduleType === 'one_time' && !oneTimeAt) {
      return res.status(400).json({
        ok: false,
        error: 'oneTimeAt required for one_time schedule type',
      })
    }

    const input: CreateScheduleInput = {
      agentId,
      agentName,
      name,
      description,
      prompt,
      scheduleType,
      cronExpression,
      intervalValue,
      intervalUnit,
      oneTimeAt: oneTimeAt ? new Date(oneTimeAt) : undefined,
      timezone: timezone || 'UTC',
      retryConfig,
      notificationSettings,
      contextSnapshot,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    }

    const schedule = await schedulesRepo.create(userId, input)

    // Calculate and set next run time
    const nextRunAt = calculateNextRun(schedule)
    if (nextRunAt) {
      await schedulesRepo.updateNextRun(schedule.id, nextRunAt)
    }

    // Register with scheduler service if active
    if (schedule.status === 'active') {
      const schedulerService = SchedulerService.getInstance()
      schedulerService.registerSchedule(schedule)
    }

    // Refetch with updated nextRunAt
    const updatedSchedule = await schedulesRepo.getById(schedule.id, userId)

    res.status(201).json({ ok: true, schedule: updatedSchedule })
  } catch (error) {
    console.error('Create schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to create schedule' })
  }
}

/**
 * Create schedule from agent proposal
 * POST /api/schedules/from-proposal
 */
export async function createFromProposalHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { proposalId, ...scheduleData } = req.body

    if (!proposalId) {
      return res.status(400).json({ ok: false, error: 'proposalId required' })
    }

    // Check tier limits
    const userTier = (req.headers['x-user-tier'] as string) || 'free'
    const limit = TIER_LIMITS[userTier] || TIER_LIMITS.free
    const currentCount = await schedulesRepo.countForUser(userId)

    if (currentCount >= limit) {
      return res.status(403).json({
        ok: false,
        error: `Schedule limit reached. Your ${userTier} plan allows ${limit} active schedule(s).`,
        limit,
        current: currentCount,
      })
    }

    const schedule = await schedulesRepo.createFromProposal(userId, proposalId, {
      agentId: scheduleData.agentId,
      agentName: scheduleData.agentName,
      name: scheduleData.name,
      description: scheduleData.description,
      prompt: scheduleData.prompt,
      scheduleType: scheduleData.scheduleType,
      cronExpression: scheduleData.cronExpression,
      intervalValue: scheduleData.intervalValue,
      intervalUnit: scheduleData.intervalUnit,
      oneTimeAt: scheduleData.oneTimeAt ? new Date(scheduleData.oneTimeAt) : undefined,
      timezone: scheduleData.timezone || 'UTC',
      retryConfig: scheduleData.retryConfig,
      notificationSettings: scheduleData.notificationSettings,
      contextSnapshot: scheduleData.contextSnapshot,
      // Include execution plan from plan mode (for consistent scheduled runs)
      executionPlan: scheduleData.executionPlan,
    })

    res.status(201).json({
      ok: true,
      schedule,
      message: 'Schedule created and awaiting approval',
    })
  } catch (error) {
    console.error('Create from proposal error:', error)
    res.status(500).json({ ok: false, error: 'Failed to create schedule from proposal' })
  }
}

/**
 * Update a schedule
 * PATCH /api/schedules/:id
 */
export async function updateScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const updates: UpdateScheduleInput = {}

    // Only include provided fields
    const allowedFields = [
      'name', 'description', 'prompt', 'cronExpression',
      'intervalValue', 'intervalUnit', 'oneTimeAt', 'timezone',
      'retryConfig', 'notificationSettings', 'contextSnapshot',
      'validFrom', 'validUntil',
    ]

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'oneTimeAt' || field === 'validFrom' || field === 'validUntil') {
          (updates as any)[field] = req.body[field] ? new Date(req.body[field]) : null
        } else {
          (updates as any)[field] = req.body[field]
        }
      }
    }

    const schedule = await schedulesRepo.update(id, userId, updates)

    if (!schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    // Update next run time if schedule config changed
    if (updates.cronExpression || updates.intervalValue || updates.intervalUnit || updates.oneTimeAt) {
      const nextRunAt = calculateNextRun(schedule)
      if (nextRunAt) {
        await schedulesRepo.updateNextRun(schedule.id, nextRunAt)
      }

      // Re-register with scheduler
      const schedulerService = SchedulerService.getInstance()
      schedulerService.unregisterSchedule(schedule.id)
      if (schedule.status === 'active') {
        schedulerService.registerSchedule(schedule)
      }
    }

    const updatedSchedule = await schedulesRepo.getById(id, userId)
    res.json({ ok: true, schedule: updatedSchedule })
  } catch (error) {
    console.error('Update schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to update schedule' })
  }
}

/**
 * Delete a schedule
 * DELETE /api/schedules/:id
 */
export async function deleteScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const hardDelete = req.query.hard === 'true'

    // Unregister from scheduler
    const schedulerService = SchedulerService.getInstance()
    schedulerService.unregisterSchedule(id)

    const success = hardDelete
      ? await schedulesRepo.hardDelete(id, userId)
      : await schedulesRepo.softDelete(id, userId)

    if (!success) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    res.json({ ok: true, deleted: true })
  } catch (error) {
    console.error('Delete schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to delete schedule' })
  }
}

// =============================================================================
// SCHEDULE ACTIONS
// =============================================================================

/**
 * Approve a pending schedule
 * POST /api/schedules/:id/approve
 */
export async function approveScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const existing = await schedulesRepo.getById(id, userId)

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    if (existing.status !== 'pending_approval') {
      return res.status(400).json({
        ok: false,
        error: `Cannot approve schedule with status: ${existing.status}`,
      })
    }

    const nextRunAt = calculateNextRun(existing)
    if (!nextRunAt) {
      return res.status(400).json({
        ok: false,
        error: 'Could not calculate next run time for schedule',
      })
    }

    const schedule = await schedulesRepo.approve(id, userId, nextRunAt)

    // Register with scheduler
    if (schedule) {
      const schedulerService = SchedulerService.getInstance()
      schedulerService.registerSchedule(schedule)
    }

    res.json({ ok: true, schedule })
  } catch (error) {
    console.error('Approve schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to approve schedule' })
  }
}

/**
 * Pause a schedule
 * POST /api/schedules/:id/pause
 */
export async function pauseScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const existing = await schedulesRepo.getById(id, userId)

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    if (existing.status !== 'active') {
      return res.status(400).json({
        ok: false,
        error: `Cannot pause schedule with status: ${existing.status}`,
      })
    }

    const schedule = await schedulesRepo.pause(id, userId)

    // Unregister from scheduler
    const schedulerService = SchedulerService.getInstance()
    schedulerService.unregisterSchedule(id)

    res.json({ ok: true, schedule })
  } catch (error) {
    console.error('Pause schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to pause schedule' })
  }
}

/**
 * Resume a paused schedule
 * POST /api/schedules/:id/resume
 */
export async function resumeScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const existing = await schedulesRepo.getById(id, userId)

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    if (existing.status !== 'paused' && existing.status !== 'failed') {
      return res.status(400).json({
        ok: false,
        error: `Cannot resume schedule with status: ${existing.status}`,
      })
    }

    const nextRunAt = calculateNextRun(existing)
    if (!nextRunAt) {
      return res.status(400).json({
        ok: false,
        error: 'Could not calculate next run time for schedule',
      })
    }

    const schedule = await schedulesRepo.resume(id, userId, nextRunAt)

    // Register with scheduler
    if (schedule) {
      const schedulerService = SchedulerService.getInstance()
      schedulerService.registerSchedule(schedule)
    }

    res.json({ ok: true, schedule })
  } catch (error) {
    console.error('Resume schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to resume schedule' })
  }
}

/**
 * Manually trigger a schedule run
 * POST /api/schedules/:id/run?async=true
 *
 * Query params:
 * - async: If true, returns immediately without waiting for execution to complete.
 *          The execution status can be polled via GET /api/schedules/:id/executions/:executionId
 */
export async function runScheduleHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params
    const asyncMode = req.query.async === 'true'
    const schedule = await schedulesRepo.getById(id, userId)

    if (!schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    // Allow manual runs for active and paused schedules
    if (!['active', 'paused'].includes(schedule.status)) {
      return res.status(400).json({
        ok: false,
        error: `Cannot manually run schedule with status: ${schedule.status}`,
      })
    }

    // Trigger execution via scheduler service
    const schedulerService = SchedulerService.getInstance()
    const execution = await schedulerService.triggerManualRun(schedule, { async: asyncMode })

    res.json({
      ok: true,
      execution,
      message: asyncMode
        ? 'Schedule execution started (async). Poll GET /api/schedules/:id/executions/:executionId for status.'
        : 'Schedule execution triggered',
      async: asyncMode,
    })
  } catch (error) {
    console.error('Run schedule error:', error)
    res.status(500).json({ ok: false, error: 'Failed to trigger schedule run' })
  }
}

// =============================================================================
// EXECUTIONS
// =============================================================================

/**
 * List executions for a schedule
 * GET /api/schedules/:id/executions?status=&limit=&offset=
 */
export async function listExecutionsHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id } = req.params

    // Verify schedule belongs to user
    const schedule = await schedulesRepo.getById(id, userId)
    if (!schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    const executions = await schedulesRepo.listExecutions(id, {
      status: parseExecutionStatusParam(req.query.status as string | undefined),
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    })

    res.json({ ok: true, executions })
  } catch (error) {
    console.error('List executions error:', error)
    res.status(500).json({ ok: false, error: 'Failed to list executions' })
  }
}

/**
 * Get a single execution by ID
 * GET /api/schedules/:scheduleId/executions/:executionId
 */
export async function getExecutionHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id, executionId } = req.params

    // Verify schedule belongs to user
    const schedule = await schedulesRepo.getById(id, userId)
    if (!schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    const execution = await schedulesRepo.getExecutionById(executionId)

    if (!execution || execution.scheduleId !== id) {
      return res.status(404).json({ ok: false, error: 'Execution not found' })
    }

    res.json({ ok: true, execution })
  } catch (error) {
    console.error('Get execution error:', error)
    res.status(500).json({ ok: false, error: 'Failed to get execution' })
  }
}

/**
 * Cancel a pending/running execution
 * POST /api/schedules/:scheduleId/executions/:executionId/cancel
 */
export async function cancelExecutionHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const { id, executionId } = req.params

    // Verify schedule belongs to user
    const schedule = await schedulesRepo.getById(id, userId)
    if (!schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' })
    }

    const execution = await schedulesRepo.getExecutionById(executionId)

    if (!execution || execution.scheduleId !== id) {
      return res.status(404).json({ ok: false, error: 'Execution not found' })
    }

    if (!['pending', 'running', 'retrying'].includes(execution.status)) {
      return res.status(400).json({
        ok: false,
        error: `Cannot cancel execution with status: ${execution.status}`,
      })
    }

    await schedulesRepo.cancelExecution(executionId)

    res.json({ ok: true, cancelled: true })
  } catch (error) {
    console.error('Cancel execution error:', error)
    res.status(500).json({ ok: false, error: 'Failed to cancel execution' })
  }
}

// =============================================================================
// STATS
// =============================================================================

/**
 * Get schedule stats for a user
 * GET /api/schedules/stats
 */
export async function getStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User ID required' })
    }

    const stats = await schedulesRepo.getStats(userId)
    const userTier = (req.headers['x-user-tier'] as string) || 'free'
    const limit = TIER_LIMITS[userTier] || TIER_LIMITS.free
    const currentCount = await schedulesRepo.countForUser(userId)

    res.json({
      ok: true,
      stats,
      tier: {
        name: userTier,
        limit,
        used: currentCount,
        remaining: Math.max(0, limit - currentCount),
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ ok: false, error: 'Failed to get stats' })
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse status query parameter (can be single value or comma-separated)
 */
function parseStatusParam(status: string | undefined): ScheduleStatus | ScheduleStatus[] | undefined {
  if (!status) return undefined

  const statuses = status.split(',').map(s => s.trim()) as ScheduleStatus[]
  return statuses.length === 1 ? statuses[0] : statuses
}

/**
 * Parse execution status query parameter
 */
function parseExecutionStatusParam(status: string | undefined): any {
  if (!status) return undefined

  const statuses = status.split(',').map(s => s.trim())
  return statuses.length === 1 ? statuses[0] : statuses
}

/**
 * Calculate the next run time for a schedule
 */
function calculateNextRun(schedule: any): Date | null {
  const now = new Date()

  switch (schedule.scheduleType) {
    case 'cron':
      // Use cron-parser to calculate next run
      try {
        const cronParser = require('cron-parser')
        const interval = cronParser.parseExpression(schedule.cronExpression, {
          currentDate: now,
          tz: schedule.timezone || 'UTC',
        })
        return interval.next().toDate()
      } catch (error) {
        console.error('Failed to parse cron expression:', error)
        return null
      }

    case 'interval':
      // Calculate next run based on interval
      const multipliers: Record<string, number> = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000,
      }
      const intervalMs = schedule.intervalValue * (multipliers[schedule.intervalUnit] || 0)

      // If lastRunAt exists, calculate from there; otherwise from now
      const baseTime = schedule.lastRunAt ? new Date(schedule.lastRunAt) : now
      return new Date(baseTime.getTime() + intervalMs)

    case 'one_time':
      // For one-time schedules, return the scheduled time if it's in the future
      const oneTimeAt = new Date(schedule.oneTimeAt)
      return oneTimeAt > now ? oneTimeAt : null

    default:
      return null
  }
}
