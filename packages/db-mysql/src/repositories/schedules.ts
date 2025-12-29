import { and, eq, desc, asc, isNull, sql, lte, gte, or, ne, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import {
  schedules,
  scheduleExecutions,
  Schedule,
  NewSchedule,
  ScheduleExecution,
  NewScheduleExecution,
  ScheduleRetryConfig,
  ScheduleNotificationSettings,
  ScheduleContextSnapshot,
  ScheduleExecutionPlan,
  ExecutionResultOutput,
} from '../schema'
import { BaseRepository } from './base'

// =============================================================================
// TYPES
// =============================================================================

export type ScheduleType = 'cron' | 'interval' | 'one_time'
export type ScheduleStatus = 'pending_approval' | 'active' | 'paused' | 'completed' | 'disabled' | 'failed' | 'expired'
export type ExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped' | 'retrying'
export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks'

export interface ListSchedulesOptions {
  status?: ScheduleStatus | ScheduleStatus[]
  agentId?: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
}

export interface ListExecutionsOptions {
  status?: ExecutionStatus | ExecutionStatus[]
  limit?: number
  offset?: number
}

export interface ScheduleStats {
  total: number
  active: number
  paused: number
  failed: number
  byAgent: Record<string, number>
}

export interface CreateScheduleInput {
  agentId: string
  agentName?: string
  name: string
  description?: string
  prompt: string
  scheduleType: ScheduleType
  cronExpression?: string
  intervalValue?: number
  intervalUnit?: IntervalUnit
  oneTimeAt?: Date
  timezone?: string
  retryConfig?: ScheduleRetryConfig
  notificationSettings?: ScheduleNotificationSettings
  contextSnapshot?: ScheduleContextSnapshot
  executionPlan?: ScheduleExecutionPlan
  proposalId?: string
  fromProposal?: boolean
  validFrom?: Date
  validUntil?: Date
}

export interface UpdateScheduleInput {
  name?: string
  description?: string
  prompt?: string
  cronExpression?: string
  intervalValue?: number
  intervalUnit?: IntervalUnit
  oneTimeAt?: Date
  timezone?: string
  status?: ScheduleStatus
  retryConfig?: ScheduleRetryConfig
  notificationSettings?: ScheduleNotificationSettings
  contextSnapshot?: ScheduleContextSnapshot
  validFrom?: Date
  validUntil?: Date
}

// =============================================================================
// REPOSITORY
// =============================================================================

export class SchedulesRepo extends BaseRepository {
  // =========================================================================
  // SCHEDULES - CREATE
  // =========================================================================

  /**
   * Create a new schedule
   */
  async create(userId: string, input: CreateScheduleInput): Promise<Schedule> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()
    const id = randomUUID()
    const threadId = randomUUID() // Dedicated thread for this schedule

    const newSchedule: NewSchedule = {
      id,
      orgId,
      userId,
      agentId: input.agentId,
      agentName: input.agentName || null,
      name: input.name,
      description: input.description || null,
      prompt: input.prompt,
      scheduleType: input.scheduleType,
      cronExpression: input.cronExpression || null,
      intervalValue: input.intervalValue || null,
      intervalUnit: input.intervalUnit || null,
      oneTimeAt: input.oneTimeAt || null,
      timezone: input.timezone || 'UTC',
      status: input.fromProposal ? 'pending_approval' : 'active',
      retryConfig: input.retryConfig || null,
      notificationSettings: input.notificationSettings || null,
      contextSnapshot: input.contextSnapshot || null,
      executionPlan: input.executionPlan || null,
      threadId,
      proposalId: input.proposalId || null,
      fromProposal: input.fromProposal || false,
      validFrom: input.validFrom || null,
      validUntil: input.validUntil || null,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
    }

    await db.insert(schedules).values(newSchedule)

    const [created] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id))
      .limit(1)

    return created
  }

  /**
   * Create schedule from proposal (sets pending_approval status)
   */
  async createFromProposal(
    userId: string,
    proposalId: string,
    input: Omit<CreateScheduleInput, 'fromProposal' | 'proposalId'>
  ): Promise<Schedule> {
    return this.create(userId, {
      ...input,
      proposalId,
      fromProposal: true,
    })
  }

  // =========================================================================
  // SCHEDULES - READ
  // =========================================================================

  /**
   * Get a schedule by ID
   */
  async getById(id: string, userId: string): Promise<Schedule | null> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const [schedule] = await db
      .select()
      .from(schedules)
      .where(and(
        eq(schedules.id, id),
        eq(schedules.orgId, orgId),
        isNull(schedules.deletedAt)
      ))
      .limit(1)

    return schedule || null
  }

  /**
   * Get a schedule by ID (org-level, no user check)
   */
  async getByIdForOrg(id: string, orgId: string): Promise<Schedule | null> {
    const db = await getDb()

    const [schedule] = await db
      .select()
      .from(schedules)
      .where(and(
        eq(schedules.id, id),
        eq(schedules.orgId, orgId),
        isNull(schedules.deletedAt)
      ))
      .limit(1)

    return schedule || null
  }

  /**
   * List schedules for a user
   */
  async list(userId: string, options: ListSchedulesOptions = {}): Promise<Schedule[]> {
    const { status, agentId, limit = 50, offset = 0, includeDeleted = false } = options
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const conditions = [
      eq(schedules.orgId, orgId),
      eq(schedules.userId, userId),
    ]

    if (!includeDeleted) {
      conditions.push(isNull(schedules.deletedAt))
    }

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(schedules.status, status))
      } else {
        conditions.push(eq(schedules.status, status))
      }
    }

    if (agentId) {
      conditions.push(eq(schedules.agentId, agentId))
    }

    return db
      .select()
      .from(schedules)
      .where(and(...conditions))
      .orderBy(desc(schedules.createdAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * List all schedules for an org (admin view)
   */
  async listForOrg(orgId: string, options: ListSchedulesOptions = {}): Promise<Schedule[]> {
    const { status, agentId, limit = 50, offset = 0, includeDeleted = false } = options
    const db = await getDb()

    const conditions = [eq(schedules.orgId, orgId)]

    if (!includeDeleted) {
      conditions.push(isNull(schedules.deletedAt))
    }

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(schedules.status, status))
      } else {
        conditions.push(eq(schedules.status, status))
      }
    }

    if (agentId) {
      conditions.push(eq(schedules.agentId, agentId))
    }

    return db
      .select()
      .from(schedules)
      .where(and(...conditions))
      .orderBy(desc(schedules.createdAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Get schedules due for execution
   */
  async getDueSchedules(beforeTime: Date = new Date()): Promise<Schedule[]> {
    const db = await getDb()

    return db
      .select()
      .from(schedules)
      .where(and(
        eq(schedules.status, 'active'),
        isNull(schedules.deletedAt),
        lte(schedules.nextRunAt, beforeTime)
      ))
      .orderBy(asc(schedules.nextRunAt))
  }

  /**
   * Count schedules for a user (for tier limit checking)
   */
  async countForUser(userId: string): Promise<number> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(and(
        eq(schedules.orgId, orgId),
        eq(schedules.userId, userId),
        isNull(schedules.deletedAt),
        ne(schedules.status, 'completed'),
        ne(schedules.status, 'expired')
      ))

    return result?.count || 0
  }

  /**
   * Get schedule stats for a user
   */
  async getStats(userId: string): Promise<ScheduleStats> {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()

    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(and(
        eq(schedules.orgId, orgId),
        eq(schedules.userId, userId),
        isNull(schedules.deletedAt)
      ))

    // Active count
    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(and(
        eq(schedules.orgId, orgId),
        eq(schedules.userId, userId),
        eq(schedules.status, 'active'),
        isNull(schedules.deletedAt)
      ))

    // Paused count
    const [pausedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(and(
        eq(schedules.orgId, orgId),
        eq(schedules.userId, userId),
        eq(schedules.status, 'paused'),
        isNull(schedules.deletedAt)
      ))

    // Failed count
    const [failedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(and(
        eq(schedules.orgId, orgId),
        eq(schedules.userId, userId),
        eq(schedules.status, 'failed'),
        isNull(schedules.deletedAt)
      ))

    // Count by agent
    const agentResults = await db
      .select({
        agentId: schedules.agentId,
        count: sql<number>`count(*)`
      })
      .from(schedules)
      .where(and(
        eq(schedules.orgId, orgId),
        eq(schedules.userId, userId),
        isNull(schedules.deletedAt)
      ))
      .groupBy(schedules.agentId)

    const byAgent: Record<string, number> = {}
    for (const row of agentResults) {
      byAgent[row.agentId] = row.count
    }

    return {
      total: totalResult?.count || 0,
      active: activeResult?.count || 0,
      paused: pausedResult?.count || 0,
      failed: failedResult?.count || 0,
      byAgent,
    }
  }

  // =========================================================================
  // SCHEDULES - UPDATE
  // =========================================================================

  /**
   * Update a schedule
   */
  async update(id: string, userId: string, updates: UpdateScheduleInput): Promise<Schedule | null> {
    const schedule = await this.getById(id, userId)
    if (!schedule) return null

    const db = await getDb()
    const updateData: Partial<NewSchedule> = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.prompt !== undefined) updateData.prompt = updates.prompt
    if (updates.cronExpression !== undefined) updateData.cronExpression = updates.cronExpression
    if (updates.intervalValue !== undefined) updateData.intervalValue = updates.intervalValue
    if (updates.intervalUnit !== undefined) updateData.intervalUnit = updates.intervalUnit
    if (updates.oneTimeAt !== undefined) updateData.oneTimeAt = updates.oneTimeAt
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.retryConfig !== undefined) updateData.retryConfig = updates.retryConfig
    if (updates.notificationSettings !== undefined) updateData.notificationSettings = updates.notificationSettings
    if (updates.contextSnapshot !== undefined) updateData.contextSnapshot = updates.contextSnapshot
    if (updates.validFrom !== undefined) updateData.validFrom = updates.validFrom
    if (updates.validUntil !== undefined) updateData.validUntil = updates.validUntil

    await db
      .update(schedules)
      .set(updateData)
      .where(eq(schedules.id, id))

    return this.getById(id, userId)
  }

  /**
   * Approve a pending schedule
   */
  async approve(id: string, userId: string, nextRunAt: Date): Promise<Schedule | null> {
    const db = await getDb()

    await db
      .update(schedules)
      .set({
        status: 'active',
        nextRunAt,
      })
      .where(eq(schedules.id, id))

    return this.getById(id, userId)
  }

  /**
   * Pause a schedule
   */
  async pause(id: string, userId: string): Promise<Schedule | null> {
    const db = await getDb()

    await db
      .update(schedules)
      .set({
        status: 'paused',
        pausedAt: new Date(),
      })
      .where(eq(schedules.id, id))

    return this.getById(id, userId)
  }

  /**
   * Resume a paused schedule
   */
  async resume(id: string, userId: string, nextRunAt: Date): Promise<Schedule | null> {
    const db = await getDb()

    await db
      .update(schedules)
      .set({
        status: 'active',
        pausedAt: null,
        nextRunAt,
        consecutiveFailures: 0, // Reset consecutive failures on resume
      })
      .where(eq(schedules.id, id))

    return this.getById(id, userId)
  }

  /**
   * Update next run time
   */
  async updateNextRun(id: string, nextRunAt: Date | null): Promise<void> {
    const db = await getDb()

    await db
      .update(schedules)
      .set({ nextRunAt })
      .where(eq(schedules.id, id))
  }

  /**
   * Record a successful execution
   */
  async recordSuccess(id: string): Promise<void> {
    const db = await getDb()

    await db
      .update(schedules)
      .set({
        lastRunAt: new Date(),
        runCount: sql`${schedules.runCount} + 1`,
        successCount: sql`${schedules.successCount} + 1`,
        consecutiveFailures: 0,
      })
      .where(eq(schedules.id, id))
  }

  /**
   * Record a failed execution
   */
  async recordFailure(id: string, maxConsecutiveFailures: number = 5): Promise<{ markedAsFailed: boolean }> {
    const db = await getDb()

    // First, increment the failure counters
    await db
      .update(schedules)
      .set({
        lastRunAt: new Date(),
        runCount: sql`${schedules.runCount} + 1`,
        failureCount: sql`${schedules.failureCount} + 1`,
        consecutiveFailures: sql`${schedules.consecutiveFailures} + 1`,
      })
      .where(eq(schedules.id, id))

    // Check if we need to mark as failed
    const [schedule] = await db
      .select({ consecutiveFailures: schedules.consecutiveFailures })
      .from(schedules)
      .where(eq(schedules.id, id))
      .limit(1)

    if (schedule && schedule.consecutiveFailures >= maxConsecutiveFailures) {
      await db
        .update(schedules)
        .set({ status: 'failed' })
        .where(eq(schedules.id, id))
      return { markedAsFailed: true }
    }

    return { markedAsFailed: false }
  }

  /**
   * Mark schedule as completed (for one-time schedules)
   */
  async markCompleted(id: string): Promise<void> {
    const db = await getDb()

    await db
      .update(schedules)
      .set({
        status: 'completed',
        nextRunAt: null,
      })
      .where(eq(schedules.id, id))
  }

  // =========================================================================
  // SCHEDULES - DELETE
  // =========================================================================

  /**
   * Soft delete a schedule
   */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const schedule = await this.getById(id, userId)
    if (!schedule) return false

    const db = await getDb()
    await db
      .update(schedules)
      .set({ deletedAt: new Date() })
      .where(eq(schedules.id, id))

    return true
  }

  /**
   * Hard delete a schedule and all its executions
   */
  async hardDelete(id: string, userId: string): Promise<boolean> {
    const schedule = await this.getById(id, userId)
    if (!schedule) return false

    const db = await getDb()

    // Delete executions first
    await db
      .delete(scheduleExecutions)
      .where(eq(scheduleExecutions.scheduleId, id))

    // Delete schedule
    await db
      .delete(schedules)
      .where(eq(schedules.id, id))

    return true
  }

  // =========================================================================
  // EXECUTIONS - CREATE
  // =========================================================================

  /**
   * Create a new execution record
   */
  async createExecution(
    scheduleId: string,
    orgId: string,
    scheduledAt: Date,
    executionNumber: number
  ): Promise<ScheduleExecution> {
    const db = await getDb()
    const id = randomUUID()

    // Get the schedule's thread ID
    const [schedule] = await db
      .select({ threadId: schedules.threadId })
      .from(schedules)
      .where(eq(schedules.id, scheduleId))
      .limit(1)

    const newExecution: NewScheduleExecution = {
      id,
      scheduleId,
      orgId,
      executionNumber,
      status: 'pending',
      threadId: schedule?.threadId || null,
      scheduledAt,
      retryAttempt: 0,
      maxRetries: 3,
    }

    await db.insert(scheduleExecutions).values(newExecution)

    const [created] = await db
      .select()
      .from(scheduleExecutions)
      .where(eq(scheduleExecutions.id, id))
      .limit(1)

    return created
  }

  // =========================================================================
  // EXECUTIONS - READ
  // =========================================================================

  /**
   * Get an execution by ID
   */
  async getExecutionById(id: string): Promise<ScheduleExecution | null> {
    const db = await getDb()

    const [execution] = await db
      .select()
      .from(scheduleExecutions)
      .where(eq(scheduleExecutions.id, id))
      .limit(1)

    return execution || null
  }

  /**
   * List executions for a schedule
   */
  async listExecutions(
    scheduleId: string,
    options: ListExecutionsOptions = {}
  ): Promise<ScheduleExecution[]> {
    const { status, limit = 20, offset = 0 } = options
    const db = await getDb()

    const conditions = [eq(scheduleExecutions.scheduleId, scheduleId)]

    if (status) {
      if (Array.isArray(status)) {
        conditions.push(inArray(scheduleExecutions.status, status))
      } else {
        conditions.push(eq(scheduleExecutions.status, status))
      }
    }

    return db
      .select()
      .from(scheduleExecutions)
      .where(and(...conditions))
      .orderBy(desc(scheduleExecutions.scheduledAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Get the latest execution for a schedule
   */
  async getLatestExecution(scheduleId: string): Promise<ScheduleExecution | null> {
    const db = await getDb()

    const [execution] = await db
      .select()
      .from(scheduleExecutions)
      .where(eq(scheduleExecutions.scheduleId, scheduleId))
      .orderBy(desc(scheduleExecutions.executionNumber))
      .limit(1)

    return execution || null
  }

  /**
   * Get pending or retrying executions (for scheduler retry logic)
   */
  async getRetryableExecutions(): Promise<ScheduleExecution[]> {
    const db = await getDb()

    return db
      .select()
      .from(scheduleExecutions)
      .where(and(
        eq(scheduleExecutions.status, 'retrying'),
        lte(scheduleExecutions.nextRetryAt, new Date())
      ))
      .orderBy(asc(scheduleExecutions.nextRetryAt))
  }

  // =========================================================================
  // EXECUTIONS - UPDATE
  // =========================================================================

  /**
   * Mark execution as started
   */
  async startExecution(id: string, activityId: string): Promise<void> {
    const db = await getDb()

    await db
      .update(scheduleExecutions)
      .set({
        status: 'running',
        activityId,
        startedAt: new Date(),
      })
      .where(eq(scheduleExecutions.id, id))
  }

  /**
   * Mark execution as succeeded
   */
  async succeedExecution(
    id: string,
    result?: { summary?: string; outputs?: ExecutionResultOutput[] }
  ): Promise<void> {
    const db = await getDb()
    const now = new Date()

    // Get the start time to calculate duration
    const [execution] = await db
      .select({ startedAt: scheduleExecutions.startedAt })
      .from(scheduleExecutions)
      .where(eq(scheduleExecutions.id, id))
      .limit(1)

    const durationMs = execution?.startedAt
      ? now.getTime() - execution.startedAt.getTime()
      : null

    await db
      .update(scheduleExecutions)
      .set({
        status: 'succeeded',
        completedAt: now,
        durationMs,
        resultSummary: result?.summary || null,
        resultOutputs: result?.outputs || null,
      })
      .where(eq(scheduleExecutions.id, id))
  }

  /**
   * Mark execution as failed
   */
  async failExecution(
    id: string,
    error: { code: string; message: string; retryable: boolean },
    willRetry: boolean,
    nextRetryAt?: Date
  ): Promise<void> {
    const db = await getDb()
    const now = new Date()

    // Get current state
    const [execution] = await db
      .select({
        startedAt: scheduleExecutions.startedAt,
        retryAttempt: scheduleExecutions.retryAttempt,
      })
      .from(scheduleExecutions)
      .where(eq(scheduleExecutions.id, id))
      .limit(1)

    const durationMs = execution?.startedAt
      ? now.getTime() - execution.startedAt.getTime()
      : null

    await db
      .update(scheduleExecutions)
      .set({
        status: willRetry ? 'retrying' : 'failed',
        completedAt: willRetry ? null : now,
        durationMs,
        errorCode: error.code,
        errorMessage: error.message,
        errorRetryable: error.retryable,
        retryAttempt: (execution?.retryAttempt || 0) + 1,
        nextRetryAt: willRetry ? nextRetryAt : null,
      })
      .where(eq(scheduleExecutions.id, id))
  }

  /**
   * Mark execution as cancelled
   */
  async cancelExecution(id: string): Promise<void> {
    const db = await getDb()

    await db
      .update(scheduleExecutions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(scheduleExecutions.id, id))
  }

  /**
   * Mark execution as skipped
   */
  async skipExecution(id: string): Promise<void> {
    const db = await getDb()

    await db
      .update(scheduleExecutions)
      .set({
        status: 'skipped',
        completedAt: new Date(),
      })
      .where(eq(scheduleExecutions.id, id))
  }
}
