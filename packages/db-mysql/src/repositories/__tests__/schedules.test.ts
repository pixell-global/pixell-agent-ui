/**
 * Comprehensive integration tests for schedules repository
 * Tests schedule CRUD, execution tracking, status transitions, and tier limits
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, sql, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../../connection'
import { users, organizations, organizationMembers, schedules, scheduleExecutions } from '../../schema'
import { SchedulesRepo } from '../schedules'

describe('Schedules Repository', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let repo: SchedulesRepo

  // Test data
  const testUserId = `test-sched-user-${randomUUID()}`
  const testOrgId = randomUUID()
  const testEmail = `sched-test-${randomUUID()}@example.com`
  const testAgentId = 'test-agent-123'

  beforeAll(async () => {
    db = await getDb()
    repo = new SchedulesRepo()

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      displayName: 'Schedule Test User',
    })

    // Create test organization
    await db.insert(organizations).values({
      id: testOrgId,
      name: 'Schedule Test Org',
      createdBy: testUserId,
    })

    // Create org membership
    await db.insert(organizationMembers).values({
      orgId: testOrgId,
      userId: testUserId,
      role: 'owner',
    })
  })

  afterAll(async () => {
    // Cleanup all test schedules and executions
    const testSchedules = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(eq(schedules.userId, testUserId))

    for (const schedule of testSchedules) {
      await db.delete(scheduleExecutions).where(eq(scheduleExecutions.scheduleId, schedule.id))
    }

    await db.delete(schedules).where(eq(schedules.userId, testUserId))
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, testUserId))
    await db.delete(organizations).where(eq(organizations.id, testOrgId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

  describe('Schedule CRUD Operations', () => {
    describe('create', () => {
      it('should create a cron schedule', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          agentName: 'Test Agent',
          name: 'Daily Report',
          description: 'Generate daily report',
          prompt: 'Generate a daily report',
          scheduleType: 'cron',
          cronExpression: '0 9 * * *',
          timezone: 'America/New_York',
        })

        expect(schedule).toBeDefined()
        expect(schedule.id).toBeDefined()
        expect(schedule.name).toBe('Daily Report')
        expect(schedule.scheduleType).toBe('cron')
        expect(schedule.cronExpression).toBe('0 9 * * *')
        expect(schedule.status).toBe('active')
        expect(schedule.runCount).toBe(0)
        expect(schedule.threadId).toBeDefined()
      })

      it('should create an interval schedule', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Hourly Check',
          prompt: 'Check system status',
          scheduleType: 'interval',
          intervalValue: 2,
          intervalUnit: 'hours',
        })

        expect(schedule.scheduleType).toBe('interval')
        expect(schedule.intervalValue).toBe(2)
        expect(schedule.intervalUnit).toBe('hours')
      })

      it('should create a one-time schedule', async () => {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 1)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'One-time Task',
          prompt: 'Run once',
          scheduleType: 'one_time',
          oneTimeAt: futureDate,
        })

        expect(schedule.scheduleType).toBe('one_time')
        expect(schedule.oneTimeAt).toBeDefined()
      })

      it('should create schedule with retry config', async () => {
        const retryConfig = {
          maxRetries: 5,
          retryDelayMs: 30000,
          backoffMultiplier: 1.5,
          maxRetryDelayMs: 1800000,
        }

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Retry Schedule',
          prompt: 'Task with retry',
          scheduleType: 'cron',
          cronExpression: '0 * * * *',
          retryConfig,
        })

        expect(schedule.retryConfig).toBeDefined()
        expect(schedule.retryConfig?.maxRetries).toBe(5)
        expect(schedule.retryConfig?.backoffMultiplier).toBe(1.5)
      })

      it('should create schedule with notification settings', async () => {
        const notificationSettings = {
          onSuccess: true,
          onFailure: true,
          onPause: false,
          channels: ['in_app', 'email'] as ('in_app' | 'email')[],
        }

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Notified Schedule',
          prompt: 'Task with notifications',
          scheduleType: 'cron',
          cronExpression: '0 12 * * *',
          notificationSettings,
        })

        expect(schedule.notificationSettings).toBeDefined()
        expect(schedule.notificationSettings?.onSuccess).toBe(true)
        expect(schedule.notificationSettings?.channels).toContain('email')
      })

      it('should create schedule with context snapshot', async () => {
        const contextSnapshot = {
          files: [
            { id: 'file-1', name: 'report.xlsx', path: '/files/report.xlsx' },
          ],
          variables: { region: 'us-east' },
          createdAt: new Date().toISOString(),
        }

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Context Schedule',
          prompt: 'Task with context',
          scheduleType: 'cron',
          cronExpression: '0 6 * * 1',
          contextSnapshot,
        })

        expect(schedule.contextSnapshot).toBeDefined()
        expect(schedule.contextSnapshot?.files).toHaveLength(1)
        expect(schedule.contextSnapshot?.variables?.region).toBe('us-east')
      })
    })

    describe('createFromProposal', () => {
      it('should create schedule with pending_approval status', async () => {
        const proposalId = randomUUID()

        const schedule = await repo.createFromProposal(testUserId, proposalId, {
          agentId: testAgentId,
          name: 'Proposed Schedule',
          prompt: 'Agent proposed task',
          scheduleType: 'cron',
          cronExpression: '0 9 * * 1',
        })

        expect(schedule.status).toBe('pending_approval')
        expect(schedule.fromProposal).toBe(true)
        expect(schedule.proposalId).toBe(proposalId)
      })
    })

    describe('getById', () => {
      it('should return schedule by ID', async () => {
        const created = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Get By ID Test',
          prompt: 'Test prompt',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const found = await repo.getById(created.id, testUserId)

        expect(found).toBeDefined()
        expect(found?.id).toBe(created.id)
        expect(found?.name).toBe('Get By ID Test')
      })

      it('should return null for non-existent ID', async () => {
        const found = await repo.getById(randomUUID(), testUserId)
        expect(found).toBeNull()
      })

      it('should not return deleted schedules', async () => {
        const created = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'To Delete',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.softDelete(created.id, testUserId)

        const found = await repo.getById(created.id, testUserId)
        expect(found).toBeNull()
      })
    })

    describe('list', () => {
      it('should list all schedules for user', async () => {
        // Create multiple schedules
        await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'List Test 1',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'List Test 2',
          prompt: 'Test',
          scheduleType: 'interval',
          intervalValue: 1,
          intervalUnit: 'hours',
        })

        const list = await repo.list(testUserId)

        expect(list.length).toBeGreaterThanOrEqual(2)
      })

      it('should filter by status', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Active Schedule',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.pause(schedule.id, testUserId)

        const pausedList = await repo.list(testUserId, { status: 'paused' })
        const pausedIds = pausedList.map((s) => s.id)

        expect(pausedIds).toContain(schedule.id)
      })

      it('should filter by multiple statuses', async () => {
        const list = await repo.list(testUserId, {
          status: ['active', 'paused'],
        })

        for (const schedule of list) {
          expect(['active', 'paused']).toContain(schedule.status)
        }
      })

      it('should filter by agentId', async () => {
        const specificAgentId = `agent-${randomUUID()}`

        await repo.create(testUserId, {
          agentId: specificAgentId,
          name: 'Agent Specific',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const list = await repo.list(testUserId, { agentId: specificAgentId })

        expect(list.length).toBeGreaterThanOrEqual(1)
        for (const schedule of list) {
          expect(schedule.agentId).toBe(specificAgentId)
        }
      })

      it('should respect limit and offset', async () => {
        const list1 = await repo.list(testUserId, { limit: 2, offset: 0 })
        const list2 = await repo.list(testUserId, { limit: 2, offset: 2 })

        expect(list1.length).toBeLessThanOrEqual(2)

        // IDs should not overlap
        const ids1 = new Set(list1.map((s) => s.id))
        const ids2 = new Set(list2.map((s) => s.id))

        for (const id of ids2) {
          expect(ids1.has(id)).toBe(false)
        }
      })

      it('should exclude deleted by default', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'To Be Deleted',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.softDelete(schedule.id, testUserId)

        const list = await repo.list(testUserId)
        const ids = list.map((s) => s.id)

        expect(ids).not.toContain(schedule.id)
      })

      it('should include deleted when requested', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Deleted But Listed',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.softDelete(schedule.id, testUserId)

        const list = await repo.list(testUserId, { includeDeleted: true })
        const ids = list.map((s) => s.id)

        expect(ids).toContain(schedule.id)
      })
    })

    describe('update', () => {
      it('should update schedule properties', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Original Name',
          prompt: 'Original prompt',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const updated = await repo.update(schedule.id, testUserId, {
          name: 'Updated Name',
          prompt: 'Updated prompt',
          cronExpression: '0 6 * * *',
        })

        expect(updated?.name).toBe('Updated Name')
        expect(updated?.prompt).toBe('Updated prompt')
        expect(updated?.cronExpression).toBe('0 6 * * *')
      })

      it('should return null for non-existent schedule', async () => {
        const updated = await repo.update(randomUUID(), testUserId, {
          name: 'Should Fail',
        })

        expect(updated).toBeNull()
      })

      it('should update timezone', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'TZ Test',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 9 * * *',
          timezone: 'UTC',
        })

        const updated = await repo.update(schedule.id, testUserId, {
          timezone: 'America/Los_Angeles',
        })

        expect(updated?.timezone).toBe('America/Los_Angeles')
      })
    })
  })

  describe('Status Transitions', () => {
    describe('approve', () => {
      it('should approve pending schedule', async () => {
        const proposalId = randomUUID()
        const schedule = await repo.createFromProposal(testUserId, proposalId, {
          agentId: testAgentId,
          name: 'Pending Approval',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 9 * * 1',
        })

        expect(schedule.status).toBe('pending_approval')

        const nextRunAt = new Date()
        nextRunAt.setDate(nextRunAt.getDate() + 7)

        const approved = await repo.approve(schedule.id, testUserId, nextRunAt)

        expect(approved?.status).toBe('active')
        expect(approved?.nextRunAt).toBeDefined()
      })
    })

    describe('pause', () => {
      it('should pause active schedule', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'To Pause',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const paused = await repo.pause(schedule.id, testUserId)

        expect(paused?.status).toBe('paused')
        expect(paused?.pausedAt).toBeDefined()
      })
    })

    describe('resume', () => {
      it('should resume paused schedule', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'To Resume',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.pause(schedule.id, testUserId)

        const nextRunAt = new Date()
        nextRunAt.setHours(nextRunAt.getHours() + 1)

        const resumed = await repo.resume(schedule.id, testUserId, nextRunAt)

        expect(resumed?.status).toBe('active')
        expect(resumed?.pausedAt).toBeNull()
        expect(resumed?.consecutiveFailures).toBe(0)
      })

      it('should reset consecutive failures on resume', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Failed Schedule',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        // Simulate failures
        await repo.recordFailure(schedule.id)
        await repo.recordFailure(schedule.id)
        await repo.pause(schedule.id, testUserId)

        const nextRunAt = new Date()
        const resumed = await repo.resume(schedule.id, testUserId, nextRunAt)

        expect(resumed?.consecutiveFailures).toBe(0)
      })
    })

    describe('markCompleted', () => {
      it('should mark one-time schedule as completed', async () => {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 1)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'One-time Complete',
          prompt: 'Test',
          scheduleType: 'one_time',
          oneTimeAt: futureDate,
        })

        await repo.markCompleted(schedule.id)

        const found = await repo.getById(schedule.id, testUserId)

        expect(found?.status).toBe('completed')
        expect(found?.nextRunAt).toBeNull()
      })
    })
  })

  describe('Run Tracking', () => {
    describe('recordSuccess', () => {
      it('should increment success counters', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Success Track',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.recordSuccess(schedule.id)

        const updated = await repo.getById(schedule.id, testUserId)

        expect(updated?.runCount).toBe(1)
        expect(updated?.successCount).toBe(1)
        expect(updated?.consecutiveFailures).toBe(0)
        expect(updated?.lastRunAt).toBeDefined()
      })

      it('should reset consecutive failures on success', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Reset Failures',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        // Record a failure first
        await repo.recordFailure(schedule.id)

        let updated = await repo.getById(schedule.id, testUserId)
        expect(updated?.consecutiveFailures).toBe(1)

        // Then record success
        await repo.recordSuccess(schedule.id)

        updated = await repo.getById(schedule.id, testUserId)
        expect(updated?.consecutiveFailures).toBe(0)
      })
    })

    describe('recordFailure', () => {
      it('should increment failure counters', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Failure Track',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.recordFailure(schedule.id)

        const updated = await repo.getById(schedule.id, testUserId)

        expect(updated?.runCount).toBe(1)
        expect(updated?.failureCount).toBe(1)
        expect(updated?.consecutiveFailures).toBe(1)
      })

      it('should mark as failed after max consecutive failures', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Max Failures',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const maxFailures = 3

        for (let i = 0; i < maxFailures; i++) {
          await repo.recordFailure(schedule.id, maxFailures)
        }

        const updated = await repo.getById(schedule.id, testUserId)

        expect(updated?.status).toBe('failed')
        expect(updated?.consecutiveFailures).toBe(maxFailures)
      })

      it('should return markedAsFailed flag correctly', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Check Failed Flag',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const result1 = await repo.recordFailure(schedule.id, 2)
        expect(result1.markedAsFailed).toBe(false)

        const result2 = await repo.recordFailure(schedule.id, 2)
        expect(result2.markedAsFailed).toBe(true)
      })
    })

    describe('updateNextRun', () => {
      it('should update next run time', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Next Run Update',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const nextRun = new Date()
        nextRun.setDate(nextRun.getDate() + 1)

        await repo.updateNextRun(schedule.id, nextRun)

        const updated = await repo.getById(schedule.id, testUserId)
        expect(updated?.nextRunAt?.getTime()).toBeCloseTo(nextRun.getTime(), -3)
      })

      it('should allow null next run (for completed)', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Null Next Run',
          prompt: 'Test',
          scheduleType: 'one_time',
          oneTimeAt: new Date(),
        })

        await repo.updateNextRun(schedule.id, null)

        const updated = await repo.getById(schedule.id, testUserId)
        expect(updated?.nextRunAt).toBeNull()
      })
    })
  })

  describe('Due Schedules', () => {
    describe('getDueSchedules', () => {
      it('should return schedules with past nextRunAt', async () => {
        const pastDate = new Date()
        pastDate.setHours(pastDate.getHours() - 1)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Due Schedule',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.updateNextRun(schedule.id, pastDate)

        const dueSchedules = await repo.getDueSchedules()
        const dueIds = dueSchedules.map((s) => s.id)

        expect(dueIds).toContain(schedule.id)
      })

      it('should not return paused schedules', async () => {
        const pastDate = new Date()
        pastDate.setHours(pastDate.getHours() - 1)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Paused Due',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.updateNextRun(schedule.id, pastDate)
        await repo.pause(schedule.id, testUserId)

        const dueSchedules = await repo.getDueSchedules()
        const dueIds = dueSchedules.map((s) => s.id)

        expect(dueIds).not.toContain(schedule.id)
      })

      it('should not return deleted schedules', async () => {
        const pastDate = new Date()
        pastDate.setHours(pastDate.getHours() - 1)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Deleted Due',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        await repo.updateNextRun(schedule.id, pastDate)
        await repo.softDelete(schedule.id, testUserId)

        const dueSchedules = await repo.getDueSchedules()
        const dueIds = dueSchedules.map((s) => s.id)

        expect(dueIds).not.toContain(schedule.id)
      })
    })
  })

  describe('Tier Limits', () => {
    describe('countForUser', () => {
      it('should count active schedules', async () => {
        // Get initial count
        const initialCount = await repo.countForUser(testUserId)

        // Create a new schedule
        await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Count Test',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const newCount = await repo.countForUser(testUserId)

        expect(newCount).toBe(initialCount + 1)
      })

      it('should not count deleted schedules', async () => {
        const initialCount = await repo.countForUser(testUserId)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Delete Count Test',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        let count = await repo.countForUser(testUserId)
        expect(count).toBe(initialCount + 1)

        await repo.softDelete(schedule.id, testUserId)

        count = await repo.countForUser(testUserId)
        expect(count).toBe(initialCount)
      })

      it('should not count completed schedules', async () => {
        const initialCount = await repo.countForUser(testUserId)

        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Complete Count Test',
          prompt: 'Test',
          scheduleType: 'one_time',
          oneTimeAt: new Date(),
        })

        let count = await repo.countForUser(testUserId)
        expect(count).toBe(initialCount + 1)

        await repo.markCompleted(schedule.id)

        count = await repo.countForUser(testUserId)
        expect(count).toBe(initialCount)
      })
    })

    describe('getStats', () => {
      it('should return correct stats breakdown', async () => {
        // Create schedules in different states
        const activeSchedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Stats Active',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const pausedSchedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Stats Paused',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })
        await repo.pause(pausedSchedule.id, testUserId)

        const failedSchedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Stats Failed',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })
        // Mark as failed by hitting max consecutive failures
        await db.update(schedules).set({ status: 'failed' }).where(eq(schedules.id, failedSchedule.id))

        const stats = await repo.getStats(testUserId)

        expect(stats.total).toBeGreaterThanOrEqual(3)
        expect(stats.active).toBeGreaterThanOrEqual(1)
        expect(stats.paused).toBeGreaterThanOrEqual(1)
        expect(stats.failed).toBeGreaterThanOrEqual(1)
        expect(stats.byAgent[testAgentId]).toBeGreaterThanOrEqual(3)
      })
    })
  })

  describe('Delete Operations', () => {
    describe('softDelete', () => {
      it('should soft delete schedule', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Soft Delete Test',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        const result = await repo.softDelete(schedule.id, testUserId)

        expect(result).toBe(true)

        const found = await repo.getById(schedule.id, testUserId)
        expect(found).toBeNull()

        // But should still exist with deleted flag
        const list = await repo.list(testUserId, { includeDeleted: true })
        const ids = list.map((s) => s.id)
        expect(ids).toContain(schedule.id)
      })

      it('should return false for non-existent schedule', async () => {
        const result = await repo.softDelete(randomUUID(), testUserId)
        expect(result).toBe(false)
      })
    })

    describe('hardDelete', () => {
      it('should hard delete schedule and executions', async () => {
        const schedule = await repo.create(testUserId, {
          agentId: testAgentId,
          name: 'Hard Delete Test',
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 0 * * *',
        })

        // Create an execution
        await repo.createExecution(schedule.id, testOrgId, new Date(), 1)

        const result = await repo.hardDelete(schedule.id, testUserId)

        expect(result).toBe(true)

        // Schedule should be gone completely
        const list = await repo.list(testUserId, { includeDeleted: true })
        const ids = list.map((s) => s.id)
        expect(ids).not.toContain(schedule.id)

        // Executions should also be gone
        const executions = await repo.listExecutions(schedule.id)
        expect(executions).toHaveLength(0)
      })
    })
  })
})

describe('Schedule Executions', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let repo: SchedulesRepo

  const testUserId = `exec-test-user-${randomUUID()}`
  const testOrgId = randomUUID()
  const testEmail = `exec-test-${randomUUID()}@example.com`
  let testScheduleId: string

  beforeAll(async () => {
    db = await getDb()
    repo = new SchedulesRepo()

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      displayName: 'Execution Test User',
    })

    // Create test organization
    await db.insert(organizations).values({
      id: testOrgId,
      name: 'Execution Test Org',
      createdBy: testUserId,
    })

    // Create org membership
    await db.insert(organizationMembers).values({
      orgId: testOrgId,
      userId: testUserId,
      role: 'owner',
    })

    // Create test schedule
    const schedule = await repo.create(testUserId, {
      agentId: 'exec-test-agent',
      name: 'Execution Test Schedule',
      prompt: 'Test',
      scheduleType: 'cron',
      cronExpression: '0 * * * *',
    })
    testScheduleId = schedule.id
  })

  afterAll(async () => {
    await db.delete(scheduleExecutions).where(eq(scheduleExecutions.scheduleId, testScheduleId))
    await db.delete(schedules).where(eq(schedules.id, testScheduleId))
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, testUserId))
    await db.delete(organizations).where(eq(organizations.id, testOrgId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

  describe('createExecution', () => {
    it('should create execution record', async () => {
      const execution = await repo.createExecution(
        testScheduleId,
        testOrgId,
        new Date(),
        1
      )

      expect(execution).toBeDefined()
      expect(execution.id).toBeDefined()
      expect(execution.scheduleId).toBe(testScheduleId)
      expect(execution.orgId).toBe(testOrgId)
      expect(execution.executionNumber).toBe(1)
      expect(execution.status).toBe('pending')
      expect(execution.threadId).toBeDefined() // Should copy from schedule
    })

    it('should increment execution number', async () => {
      const exec1 = await repo.createExecution(testScheduleId, testOrgId, new Date(), 10)
      const exec2 = await repo.createExecution(testScheduleId, testOrgId, new Date(), 11)

      expect(exec2.executionNumber).toBe(exec1.executionNumber + 1)
    })
  })

  describe('getExecutionById', () => {
    it('should return execution by ID', async () => {
      const created = await repo.createExecution(testScheduleId, testOrgId, new Date(), 100)

      const found = await repo.getExecutionById(created.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
    })

    it('should return null for non-existent ID', async () => {
      const found = await repo.getExecutionById(randomUUID())
      expect(found).toBeNull()
    })
  })

  describe('listExecutions', () => {
    it('should list executions for schedule', async () => {
      await repo.createExecution(testScheduleId, testOrgId, new Date(), 200)
      await repo.createExecution(testScheduleId, testOrgId, new Date(), 201)

      const list = await repo.listExecutions(testScheduleId)

      expect(list.length).toBeGreaterThanOrEqual(2)
      for (const exec of list) {
        expect(exec.scheduleId).toBe(testScheduleId)
      }
    })

    it('should filter by status', async () => {
      const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 300)
      await repo.startExecution(exec.id, randomUUID())

      const runningList = await repo.listExecutions(testScheduleId, { status: 'running' })
      const runningIds = runningList.map((e) => e.id)

      expect(runningIds).toContain(exec.id)
    })

    it('should filter by multiple statuses', async () => {
      const list = await repo.listExecutions(testScheduleId, {
        status: ['pending', 'running'],
      })

      for (const exec of list) {
        expect(['pending', 'running']).toContain(exec.status)
      }
    })

    it('should order by scheduledAt descending', async () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-02')
      const date3 = new Date('2024-01-03')

      await repo.createExecution(testScheduleId, testOrgId, date1, 400)
      await repo.createExecution(testScheduleId, testOrgId, date2, 401)
      await repo.createExecution(testScheduleId, testOrgId, date3, 402)

      const list = await repo.listExecutions(testScheduleId, { limit: 10 })

      // Most recent first
      for (let i = 0; i < list.length - 1; i++) {
        expect(list[i].scheduledAt.getTime()).toBeGreaterThanOrEqual(
          list[i + 1].scheduledAt.getTime()
        )
      }
    })
  })

  describe('getLatestExecution', () => {
    it('should return latest execution by number', async () => {
      await repo.createExecution(testScheduleId, testOrgId, new Date(), 500)
      const latest = await repo.createExecution(testScheduleId, testOrgId, new Date(), 501)

      const found = await repo.getLatestExecution(testScheduleId)

      expect(found?.id).toBe(latest.id)
    })

    it('should return null if no executions', async () => {
      const emptySchedule = await repo.create(testUserId, {
        agentId: 'empty-test',
        name: 'No Executions',
        prompt: 'Test',
        scheduleType: 'cron',
        cronExpression: '0 0 * * *',
      })

      const found = await repo.getLatestExecution(emptySchedule.id)
      expect(found).toBeNull()

      // Cleanup
      await db.delete(schedules).where(eq(schedules.id, emptySchedule.id))
    })
  })

  describe('Execution Status Transitions', () => {
    describe('startExecution', () => {
      it('should mark execution as running', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 600)
        const activityId = randomUUID()

        await repo.startExecution(exec.id, activityId)

        const found = await repo.getExecutionById(exec.id)

        expect(found?.status).toBe('running')
        expect(found?.activityId).toBe(activityId)
        expect(found?.startedAt).toBeDefined()
      })
    })

    describe('succeedExecution', () => {
      it('should mark execution as succeeded', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 700)
        await repo.startExecution(exec.id, randomUUID())

        await repo.succeedExecution(exec.id, {
          summary: 'Completed successfully',
          outputs: [{ type: 'file', path: '/outputs/report.pdf', name: 'Report' }],
        })

        const found = await repo.getExecutionById(exec.id)

        expect(found?.status).toBe('succeeded')
        expect(found?.resultSummary).toBe('Completed successfully')
        expect(found?.resultOutputs).toHaveLength(1)
        expect(found?.completedAt).toBeDefined()
        expect(found?.durationMs).toBeDefined()
      })

      it('should calculate duration correctly', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 701)
        await repo.startExecution(exec.id, randomUUID())

        // Wait a small amount
        await new Promise((resolve) => setTimeout(resolve, 100))

        await repo.succeedExecution(exec.id)

        const found = await repo.getExecutionById(exec.id)

        expect(found?.durationMs).toBeGreaterThan(0)
      })
    })

    describe('failExecution', () => {
      it('should mark execution as failed', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 800)
        await repo.startExecution(exec.id, randomUUID())

        await repo.failExecution(
          exec.id,
          { code: 'TIMEOUT', message: 'Request timed out', retryable: true },
          false
        )

        const found = await repo.getExecutionById(exec.id)

        expect(found?.status).toBe('failed')
        expect(found?.errorCode).toBe('TIMEOUT')
        expect(found?.errorMessage).toBe('Request timed out')
        expect(found?.errorRetryable).toBe(true)
        expect(found?.completedAt).toBeDefined()
      })

      it('should mark as retrying when willRetry is true', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 801)
        await repo.startExecution(exec.id, randomUUID())

        const nextRetryAt = new Date()
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + 5)

        await repo.failExecution(
          exec.id,
          { code: 'NETWORK_ERROR', message: 'Connection failed', retryable: true },
          true,
          nextRetryAt
        )

        const found = await repo.getExecutionById(exec.id)

        expect(found?.status).toBe('retrying')
        expect(found?.nextRetryAt).toBeDefined()
        expect(found?.completedAt).toBeNull()
        expect(found?.retryAttempt).toBe(1)
      })

      it('should increment retry attempt', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 802)
        await repo.startExecution(exec.id, randomUUID())

        await repo.failExecution(
          exec.id,
          { code: 'ERROR', message: 'Failed', retryable: true },
          true,
          new Date()
        )

        let found = await repo.getExecutionById(exec.id)
        expect(found?.retryAttempt).toBe(1)

        await repo.failExecution(
          exec.id,
          { code: 'ERROR', message: 'Failed again', retryable: true },
          true,
          new Date()
        )

        found = await repo.getExecutionById(exec.id)
        expect(found?.retryAttempt).toBe(2)
      })
    })

    describe('cancelExecution', () => {
      it('should mark execution as cancelled', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 900)
        await repo.startExecution(exec.id, randomUUID())

        await repo.cancelExecution(exec.id)

        const found = await repo.getExecutionById(exec.id)

        expect(found?.status).toBe('cancelled')
        expect(found?.completedAt).toBeDefined()
      })
    })

    describe('skipExecution', () => {
      it('should mark execution as skipped', async () => {
        const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 901)

        await repo.skipExecution(exec.id)

        const found = await repo.getExecutionById(exec.id)

        expect(found?.status).toBe('skipped')
        expect(found?.completedAt).toBeDefined()
      })
    })
  })

  describe('getRetryableExecutions', () => {
    it('should return executions pending retry', async () => {
      const pastRetryTime = new Date()
      pastRetryTime.setMinutes(pastRetryTime.getMinutes() - 5)

      const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 1000)
      await repo.startExecution(exec.id, randomUUID())
      await repo.failExecution(
        exec.id,
        { code: 'ERROR', message: 'Failed', retryable: true },
        true,
        pastRetryTime
      )

      const retryable = await repo.getRetryableExecutions()
      const retryableIds = retryable.map((e) => e.id)

      expect(retryableIds).toContain(exec.id)
    })

    it('should not return executions with future retry time', async () => {
      const futureRetryTime = new Date()
      futureRetryTime.setHours(futureRetryTime.getHours() + 1)

      const exec = await repo.createExecution(testScheduleId, testOrgId, new Date(), 1001)
      await repo.startExecution(exec.id, randomUUID())
      await repo.failExecution(
        exec.id,
        { code: 'ERROR', message: 'Failed', retryable: true },
        true,
        futureRetryTime
      )

      const retryable = await repo.getRetryableExecutions()
      const retryableIds = retryable.map((e) => e.id)

      expect(retryableIds).not.toContain(exec.id)
    })
  })
})

describe('Schedules Repository - Edge Cases', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let repo: SchedulesRepo

  const testUserId = `edge-test-user-${randomUUID()}`
  const testOrgId = randomUUID()
  const testEmail = `edge-test-${randomUUID()}@example.com`

  beforeAll(async () => {
    db = await getDb()
    repo = new SchedulesRepo()

    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      displayName: 'Edge Test User',
    })

    await db.insert(organizations).values({
      id: testOrgId,
      name: 'Edge Test Org',
      createdBy: testUserId,
    })

    await db.insert(organizationMembers).values({
      orgId: testOrgId,
      userId: testUserId,
      role: 'owner',
    })
  })

  afterAll(async () => {
    const testSchedules = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(eq(schedules.userId, testUserId))

    for (const schedule of testSchedules) {
      await db.delete(scheduleExecutions).where(eq(scheduleExecutions.scheduleId, schedule.id))
    }

    await db.delete(schedules).where(eq(schedules.userId, testUserId))
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, testUserId))
    await db.delete(organizations).where(eq(organizations.id, testOrgId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

  describe('Special Characters and Long Values', () => {
    it('should handle special characters in name', async () => {
      const schedule = await repo.create(testUserId, {
        agentId: 'test-agent',
        name: "Daily Report - Q4 2024 (Rev. 2) [URGENT]",
        prompt: 'Test',
        scheduleType: 'cron',
        cronExpression: '0 0 * * *',
      })

      expect(schedule.name).toBe("Daily Report - Q4 2024 (Rev. 2) [URGENT]")
    })

    it('should handle Unicode in name and prompt', async () => {
      const schedule = await repo.create(testUserId, {
        agentId: 'test-agent',
        name: '日本語レポート 🎉',
        prompt: 'Generate report in 日本語 with emojis 🚀',
        scheduleType: 'cron',
        cronExpression: '0 9 * * *',
      })

      expect(schedule.name).toBe('日本語レポート 🎉')
      expect(schedule.prompt).toContain('日本語')
    })

    it('should handle very long prompt', async () => {
      const longPrompt = 'Generate a comprehensive report covering: ' + 'topic '.repeat(1000)

      const schedule = await repo.create(testUserId, {
        agentId: 'test-agent',
        name: 'Long Prompt Test',
        prompt: longPrompt,
        scheduleType: 'cron',
        cronExpression: '0 0 * * *',
      })

      expect(schedule.prompt.length).toBeGreaterThan(5000)
    })
  })

  describe('Timezone Handling', () => {
    it('should store various timezones', async () => {
      const timezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland',
      ]

      for (const tz of timezones) {
        const schedule = await repo.create(testUserId, {
          agentId: 'test-agent',
          name: `TZ Test - ${tz}`,
          prompt: 'Test',
          scheduleType: 'cron',
          cronExpression: '0 9 * * *',
          timezone: tz,
        })

        expect(schedule.timezone).toBe(tz)
      }
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent schedule creates', async () => {
      const createPromises = Array(5)
        .fill(null)
        .map((_, i) =>
          repo.create(testUserId, {
            agentId: 'test-agent',
            name: `Concurrent Create ${i}`,
            prompt: 'Test',
            scheduleType: 'cron',
            cronExpression: '0 0 * * *',
          })
        )

      const results = await Promise.all(createPromises)

      // All should succeed with unique IDs
      const ids = results.map((r) => r.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(5)
    })

    it('should handle concurrent success/failure recording', async () => {
      const schedule = await repo.create(testUserId, {
        agentId: 'test-agent',
        name: 'Concurrent Track',
        prompt: 'Test',
        scheduleType: 'cron',
        cronExpression: '0 0 * * *',
      })

      // Simulate concurrent recording (though in real usage this shouldn't happen)
      await Promise.all([
        repo.recordSuccess(schedule.id),
        repo.recordSuccess(schedule.id),
      ])

      const updated = await repo.getById(schedule.id, testUserId)

      // Should have 2 runs recorded
      expect(updated?.runCount).toBe(2)
    })
  })

  describe('Validity Period', () => {
    it('should store validity period', async () => {
      const validFrom = new Date()
      const validUntil = new Date()
      validUntil.setMonth(validUntil.getMonth() + 1)

      const schedule = await repo.create(testUserId, {
        agentId: 'test-agent',
        name: 'Valid Period Test',
        prompt: 'Test',
        scheduleType: 'cron',
        cronExpression: '0 0 * * *',
        validFrom,
        validUntil,
      })

      expect(schedule.validFrom).toBeDefined()
      expect(schedule.validUntil).toBeDefined()
    })
  })
})
