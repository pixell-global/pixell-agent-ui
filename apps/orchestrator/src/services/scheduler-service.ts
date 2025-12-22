import * as cron from 'node-cron'
import { SchedulesRepo, Schedule, ScheduleExecution } from '@pixell/db-mysql'
import { randomUUID } from 'crypto'

// =============================================================================
// TYPES
// =============================================================================

interface ScheduledJob {
  scheduleId: string
  cronTask: cron.ScheduledTask | null
  intervalTimer: NodeJS.Timeout | null
  oneTimeTimer: NodeJS.Timeout | null
}

interface ExecutionContext {
  schedule: Schedule
  execution: ScheduleExecution
  activityId: string
}

type ExecutionHandler = (context: ExecutionContext) => Promise<{ success: boolean; summary?: string; error?: string }>

// =============================================================================
// SCHEDULER SERVICE
// =============================================================================

export class SchedulerService {
  private static instance: SchedulerService | null = null
  private repo: SchedulesRepo
  private jobs: Map<string, ScheduledJob>
  private executionHandler: ExecutionHandler | null
  private pollInterval: NodeJS.Timeout | null
  private isRunning: boolean

  private constructor() {
    this.repo = new SchedulesRepo()
    this.jobs = new Map()
    this.executionHandler = null
    this.pollInterval = null
    this.isRunning = false
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService()
    }
    return SchedulerService.instance
  }

  /**
   * Start the scheduler service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⏰ Scheduler already running')
      return
    }

    console.log('⏰ Starting scheduler service...')
    this.isRunning = true

    // Load all active schedules from database
    await this.loadActiveSchedules()

    // Start polling for due schedules (fallback mechanism)
    this.startPolling()

    console.log(`⏰ Scheduler started with ${this.jobs.size} active jobs`)
  }

  /**
   * Stop the scheduler service
   */
  stop(): void {
    console.log('⏰ Stopping scheduler service...')
    this.isRunning = false

    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    // Stop all jobs
    for (const [id, job] of this.jobs) {
      this.stopJob(job)
    }
    this.jobs.clear()

    console.log('⏰ Scheduler stopped')
  }

  /**
   * Set the execution handler for running schedules
   */
  setExecutionHandler(handler: ExecutionHandler): void {
    this.executionHandler = handler
  }

  /**
   * Register a schedule with the scheduler
   */
  registerSchedule(schedule: Schedule): void {
    // Unregister first if already exists
    this.unregisterSchedule(schedule.id)

    if (schedule.status !== 'active') {
      console.log(`⏰ Skipping non-active schedule: ${schedule.name} (${schedule.status})`)
      return
    }

    const job: ScheduledJob = {
      scheduleId: schedule.id,
      cronTask: null,
      intervalTimer: null,
      oneTimeTimer: null,
    }

    switch (schedule.scheduleType) {
      case 'cron':
        this.registerCronJob(schedule, job)
        break
      case 'interval':
        this.registerIntervalJob(schedule, job)
        break
      case 'one_time':
        this.registerOneTimeJob(schedule, job)
        break
    }

    this.jobs.set(schedule.id, job)
    console.log(`⏰ Registered schedule: ${schedule.name} (${schedule.scheduleType})`)
  }

  /**
   * Unregister a schedule from the scheduler
   */
  unregisterSchedule(scheduleId: string): void {
    const job = this.jobs.get(scheduleId)
    if (job) {
      this.stopJob(job)
      this.jobs.delete(scheduleId)
      console.log(`⏰ Unregistered schedule: ${scheduleId}`)
    }
  }

  /**
   * Trigger a manual run of a schedule
   */
  async triggerManualRun(schedule: Schedule): Promise<ScheduleExecution> {
    console.log(`⏰ Manual trigger for schedule: ${schedule.name}`)
    return this.executeSchedule(schedule)
  }

  /**
   * Get the status of all registered jobs
   */
  getJobsStatus(): Array<{ scheduleId: string; type: string; isRunning: boolean }> {
    return Array.from(this.jobs.entries()).map(([id, job]) => ({
      scheduleId: id,
      type: job.cronTask ? 'cron' : job.intervalTimer ? 'interval' : 'one_time',
      isRunning: !!(job.cronTask || job.intervalTimer || job.oneTimeTimer),
    }))
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Load all active schedules from the database
   */
  private async loadActiveSchedules(): Promise<void> {
    try {
      // Get all active schedules across all orgs
      const dueSchedules = await this.repo.getDueSchedules(new Date(Date.now() + 24 * 60 * 60 * 1000)) // Next 24 hours

      for (const schedule of dueSchedules) {
        this.registerSchedule(schedule)
      }

      // Also load any that need immediate execution
      const immediateSchedules = await this.repo.getDueSchedules()
      for (const schedule of immediateSchedules) {
        if (!this.jobs.has(schedule.id)) {
          this.registerSchedule(schedule)
        }
        // Execute immediately if due
        this.executeSchedule(schedule).catch(err => {
          console.error(`⏰ Failed to execute due schedule ${schedule.id}:`, err)
        })
      }
    } catch (error) {
      console.error('⏰ Failed to load active schedules:', error)
    }
  }

  /**
   * Start polling for due schedules
   */
  private startPolling(): void {
    // Poll every minute for due schedules
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        const dueSchedules = await this.repo.getDueSchedules()

        for (const schedule of dueSchedules) {
          // Only execute if not already registered (edge case handling)
          if (!this.jobs.has(schedule.id)) {
            this.registerSchedule(schedule)
          }
          await this.executeSchedule(schedule)
        }

        // Also check for retryable executions
        const retryable = await this.repo.getRetryableExecutions()
        for (const execution of retryable) {
          await this.retryExecution(execution)
        }
      } catch (error) {
        console.error('⏰ Polling error:', error)
      }
    }, 60000) // 1 minute
  }

  /**
   * Register a cron job
   */
  private registerCronJob(schedule: Schedule, job: ScheduledJob): void {
    if (!schedule.cronExpression) return

    try {
      job.cronTask = cron.schedule(schedule.cronExpression, async () => {
        await this.executeSchedule(schedule)
      }, {
        timezone: schedule.timezone || 'UTC',
      })

      job.cronTask.start()
    } catch (error) {
      console.error(`⏰ Failed to create cron job for ${schedule.id}:`, error)
    }
  }

  /**
   * Register an interval job
   */
  private registerIntervalJob(schedule: Schedule, job: ScheduledJob): void {
    if (!schedule.intervalValue || !schedule.intervalUnit) return

    const multipliers: Record<string, number> = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
    }

    const intervalMs = schedule.intervalValue * (multipliers[schedule.intervalUnit] || 0)

    // Calculate initial delay
    let initialDelay = 0
    if (schedule.nextRunAt) {
      const nextRun = new Date(schedule.nextRunAt)
      initialDelay = Math.max(0, nextRun.getTime() - Date.now())
    }

    // Set initial timeout, then interval
    job.intervalTimer = setTimeout(async () => {
      await this.executeSchedule(schedule)

      // After first run, set up the interval
      job.intervalTimer = setInterval(async () => {
        await this.executeSchedule(schedule)
      }, intervalMs)
    }, initialDelay)
  }

  /**
   * Register a one-time job
   */
  private registerOneTimeJob(schedule: Schedule, job: ScheduledJob): void {
    if (!schedule.oneTimeAt) return

    const runAt = new Date(schedule.oneTimeAt)
    const delay = Math.max(0, runAt.getTime() - Date.now())

    if (delay === 0) {
      // Execute immediately
      this.executeSchedule(schedule).catch(err => {
        console.error(`⏰ Failed to execute one-time schedule ${schedule.id}:`, err)
      })
    } else {
      job.oneTimeTimer = setTimeout(async () => {
        await this.executeSchedule(schedule)
      }, delay)
    }
  }

  /**
   * Stop a job
   */
  private stopJob(job: ScheduledJob): void {
    if (job.cronTask) {
      job.cronTask.stop()
      job.cronTask = null
    }
    if (job.intervalTimer) {
      clearInterval(job.intervalTimer)
      clearTimeout(job.intervalTimer)
      job.intervalTimer = null
    }
    if (job.oneTimeTimer) {
      clearTimeout(job.oneTimeTimer)
      job.oneTimeTimer = null
    }
  }

  /**
   * Execute a schedule
   */
  private async executeSchedule(schedule: Schedule): Promise<ScheduleExecution> {
    console.log(`⏰ Executing schedule: ${schedule.name}`)

    // Get the latest execution number
    const latestExecution = await this.repo.getLatestExecution(schedule.id)
    const executionNumber = (latestExecution?.executionNumber || 0) + 1

    // Create execution record
    const execution = await this.repo.createExecution(
      schedule.id,
      schedule.orgId,
      new Date(),
      executionNumber
    )

    // Create activity ID for tracking
    const activityId = randomUUID()

    // Start execution
    await this.repo.startExecution(execution.id, activityId)

    try {
      // Run the execution handler if set
      if (this.executionHandler) {
        const result = await this.executionHandler({
          schedule,
          execution,
          activityId,
        })

        if (result.success) {
          await this.handleExecutionSuccess(schedule, execution, result.summary)
        } else {
          await this.handleExecutionFailure(schedule, execution, {
            code: 'EXECUTION_FAILED',
            message: result.error || 'Unknown error',
            retryable: true,
          })
        }
      } else {
        // No handler set, simulate success
        console.log(`⏰ No execution handler set, marking as succeeded`)
        await this.handleExecutionSuccess(schedule, execution, 'No handler configured')
      }
    } catch (error: any) {
      console.error(`⏰ Execution error for ${schedule.id}:`, error)
      await this.handleExecutionFailure(schedule, execution, {
        code: 'EXECUTION_ERROR',
        message: error.message || 'Execution failed with exception',
        retryable: this.isRetryableError(error),
      })
    }

    // Get updated execution
    const updatedExecution = await this.repo.getExecutionById(execution.id)
    return updatedExecution!
  }

  /**
   * Handle successful execution
   */
  private async handleExecutionSuccess(
    schedule: Schedule,
    execution: ScheduleExecution,
    summary?: string
  ): Promise<void> {
    await this.repo.succeedExecution(execution.id, { summary })
    await this.repo.recordSuccess(schedule.id)

    // Update next run time
    const nextRunAt = this.calculateNextRun(schedule)
    if (nextRunAt) {
      await this.repo.updateNextRun(schedule.id, nextRunAt)
    } else if (schedule.scheduleType === 'one_time') {
      // Mark one-time schedule as completed
      await this.repo.markCompleted(schedule.id)
      this.unregisterSchedule(schedule.id)
    }

    console.log(`⏰ Schedule ${schedule.name} executed successfully`)
  }

  /**
   * Handle failed execution
   */
  private async handleExecutionFailure(
    schedule: Schedule,
    execution: ScheduleExecution,
    error: { code: string; message: string; retryable: boolean }
  ): Promise<void> {
    const retryConfig = schedule.retryConfig || {
      maxRetries: 3,
      retryDelayMs: 60000,
      backoffMultiplier: 2,
      maxRetryDelayMs: 3600000,
    }

    const currentAttempt = execution.retryAttempt + 1
    const shouldRetry = error.retryable && currentAttempt < retryConfig.maxRetries

    let nextRetryAt: Date | undefined
    if (shouldRetry) {
      const delay = Math.min(
        retryConfig.retryDelayMs * Math.pow(retryConfig.backoffMultiplier, currentAttempt - 1),
        retryConfig.maxRetryDelayMs
      )
      nextRetryAt = new Date(Date.now() + delay)
    }

    await this.repo.failExecution(execution.id, error, shouldRetry, nextRetryAt)
    const result = await this.repo.recordFailure(schedule.id, retryConfig.maxRetries)

    if (result.markedAsFailed) {
      console.log(`⏰ Schedule ${schedule.name} marked as failed after ${schedule.consecutiveFailures + 1} consecutive failures`)
      this.unregisterSchedule(schedule.id)
      // TODO: Send notification
    } else if (!shouldRetry) {
      // Update next run time for next scheduled execution
      const nextRunAt = this.calculateNextRun(schedule)
      if (nextRunAt) {
        await this.repo.updateNextRun(schedule.id, nextRunAt)
      }
    }

    console.log(`⏰ Schedule ${schedule.name} execution failed: ${error.message}`)
  }

  /**
   * Retry a failed execution
   */
  private async retryExecution(execution: ScheduleExecution): Promise<void> {
    const scheduleData = await this.repo.getByIdForOrg(execution.scheduleId, execution.orgId)
    if (!scheduleData || scheduleData.status !== 'active') {
      // Skip retry if schedule is no longer active
      await this.repo.cancelExecution(execution.id)
      return
    }

    console.log(`⏰ Retrying execution ${execution.id} (attempt ${execution.retryAttempt + 1})`)

    // Mark as running again
    await this.repo.startExecution(execution.id, execution.activityId || randomUUID())

    try {
      if (this.executionHandler) {
        const result = await this.executionHandler({
          schedule: scheduleData,
          execution,
          activityId: execution.activityId || randomUUID(),
        })

        if (result.success) {
          await this.handleExecutionSuccess(scheduleData, execution, result.summary)
        } else {
          await this.handleExecutionFailure(scheduleData, execution, {
            code: 'RETRY_FAILED',
            message: result.error || 'Retry failed',
            retryable: true,
          })
        }
      } else {
        await this.handleExecutionSuccess(scheduleData, execution, 'Retry succeeded (no handler)')
      }
    } catch (error: any) {
      await this.handleExecutionFailure(scheduleData, execution, {
        code: 'RETRY_ERROR',
        message: error.message || 'Retry failed with exception',
        retryable: this.isRetryableError(error),
      })
    }
  }

  /**
   * Calculate next run time for a schedule
   */
  private calculateNextRun(schedule: Schedule): Date | null {
    const now = new Date()

    switch (schedule.scheduleType) {
      case 'cron':
        try {
          const cronParser = require('cron-parser')
          const interval = cronParser.parseExpression(schedule.cronExpression!, {
            currentDate: now,
            tz: schedule.timezone || 'UTC',
          })
          return interval.next().toDate()
        } catch {
          return null
        }

      case 'interval':
        const multipliers: Record<string, number> = {
          minutes: 60 * 1000,
          hours: 60 * 60 * 1000,
          days: 24 * 60 * 60 * 1000,
          weeks: 7 * 24 * 60 * 60 * 1000,
        }
        const intervalMs = schedule.intervalValue! * (multipliers[schedule.intervalUnit!] || 0)
        return new Date(now.getTime() + intervalMs)

      case 'one_time':
        return null // No next run for one-time

      default:
        return null
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true
    }
    // Timeout errors are retryable
    if (error.message?.includes('timeout')) {
      return true
    }
    // Rate limit errors are retryable
    if (error.status === 429) {
      return true
    }
    return false
  }
}
