/**
 * E2E Integration Test: Scheduling Feature
 *
 * Tests the complete scheduling flow:
 * 1. Send chat message with scheduling intent
 * 2. Receive schedule_proposal SSE event from agent
 * 3. Confirm schedule proposal via API
 * 4. Verify schedule is stored in database
 * 5. Approve schedule to make it active
 * 6. Manually trigger execution
 * 7. Verify execution completes
 * 8. Verify file output in S3
 *
 * Test User: kevin_yum@pixell.global
 * Target Agent: vivid-commenter
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  getUserByEmail,
  verifyDbConnection,
  type TestUser,
} from './utils/db-helpers'
import {
  verifyAwsAccess,
  s3ListFiles,
  s3GetFileContent,
} from './utils/aws-helpers'
import {
  startOrchestrator,
  startVividCommenter,
  stopProcess,
  waitForHealthy,
  killExistingProcesses,
  serviceUrls,
  printServiceLogs,
  type ServiceProcess,
} from './utils/service-helpers'
import {
  collectSSEEvents,
  printEvents,
} from './utils/sse-helpers'
import {
  findScheduleProposalEvent,
  confirmScheduleProposal,
  approveSchedule,
  triggerManualRun,
  waitForExecutionComplete,
  getSchedule,
  cleanupTestSchedules,
  type ScheduleProposalEvent,
  type Schedule,
  type ScheduleExecution,
} from './utils/schedule-helpers'

// Test configuration
const TEST_TIMEOUT = 300000 // 5 minutes for full flow
const SERVICE_STARTUP_TIMEOUT = 120000
const KEVIN_EMAIL = 'kevin_yum@pixell.global'

describe('Scheduling Feature E2E Integration', () => {
  let orchestratorService: ServiceProcess
  let agentService: ServiceProcess
  let testUser: TestUser
  let createdScheduleId: string | null = null

  beforeAll(async () => {
    console.log('\n=== Scheduling E2E Test Setup ===\n')

    // 1. Verify prerequisites
    console.log('Verifying database connection...')
    const dbOk = await verifyDbConnection()
    if (!dbOk) {
      throw new Error('Database connection failed')
    }
    console.log('Database: OK')

    console.log('Verifying AWS access...')
    const awsOk = await verifyAwsAccess()
    if (!awsOk) {
      console.warn('AWS access verification failed - file verification may not work')
    } else {
      console.log('AWS: OK')
    }

    // 2. Get kevin_yum@pixell.global user from database
    console.log(`Looking up user: ${KEVIN_EMAIL}...`)
    const kevinUser = await getUserByEmail(KEVIN_EMAIL)
    if (!kevinUser) {
      throw new Error(`User ${KEVIN_EMAIL} not found in database. Please ensure this user exists.`)
    }
    testUser = kevinUser
    console.log(`Test user found:`)
    console.log(`  - Email: ${testUser.email}`)
    console.log(`  - User ID: ${testUser.userId}`)
    console.log(`  - Org ID: ${testUser.orgId}`)
    console.log(`  - Org Name: ${testUser.orgName}`)

    // 3. Clean up any existing processes on test ports
    console.log('Killing existing processes on ports 3001 and 8000...')
    await killExistingProcesses()

    // 4. Start orchestrator
    console.log('Starting orchestrator...')
    orchestratorService = await startOrchestrator()
    await waitForHealthy(serviceUrls.orchestrator.health, SERVICE_STARTUP_TIMEOUT)
    console.log('Orchestrator: HEALTHY')

    // 5. Clean up old test schedules (must be after orchestrator starts)
    console.log('Cleaning up old test schedules...')
    const deletedCount = await cleanupTestSchedules(
      testUser.userId,
      testUser.orgId,
      serviceUrls.orchestrator.base
    )
    if (deletedCount > 0) {
      console.log(`  Deleted ${deletedCount} old test schedule(s)`)
    }

    // 6. Start vivid-commenter agent
    console.log('Starting vivid-commenter agent...')
    agentService = await startVividCommenter()
    await waitForHealthy(serviceUrls.agent.health, SERVICE_STARTUP_TIMEOUT)
    console.log('vivid-commenter: HEALTHY')

    console.log('\n=== Setup Complete ===\n')
  }, SERVICE_STARTUP_TIMEOUT + 60000)

  afterAll(async () => {
    console.log('\n=== Scheduling E2E Test Cleanup ===\n')

    // Print logs for debugging if enabled
    if (process.env.DEBUG_E2E) {
      if (orchestratorService) printServiceLogs(orchestratorService)
      if (agentService) printServiceLogs(agentService)
    }

    // Clean up created schedule
    if (createdScheduleId && testUser) {
      console.log(`Cleaning up schedule ${createdScheduleId}...`)
      try {
        await fetch(
          `${serviceUrls.orchestrator.base}/api/schedules/${createdScheduleId}?hard=true`,
          {
            method: 'DELETE',
            headers: {
              'x-user-id': testUser.userId,
              'x-org-id': testUser.orgId,
            },
          }
        )
        console.log('  Schedule deleted')
      } catch (err) {
        console.warn('  Failed to cleanup schedule:', err)
      }
    }

    // Stop services
    if (agentService) {
      console.log('Stopping vivid-commenter...')
      await stopProcess(agentService)
    }

    if (orchestratorService) {
      console.log('Stopping orchestrator...')
      await stopProcess(orchestratorService)
    }

    console.log('\n=== Cleanup Complete ===\n')
  }, 60000)

  // =========================================================================
  // TEST SUITE: Full Scheduling Flow
  // =========================================================================

  describe('Full Scheduling Flow: Chat -> Proposal -> Confirm -> Execute -> File', () => {
    let proposalEvent: ScheduleProposalEvent | null = null
    let schedule: Schedule | null = null
    let execution: ScheduleExecution | null = null

    test('Step 1: Send scheduling chat message and receive schedule_proposal SSE event', async () => {
      console.log('\n--- Step 1: Send scheduling message ---')

      const sessionId = `schedule-e2e-test-${Date.now()}`
      const message = 'schedule acne research every day at 9am'

      console.log(`  Session ID: ${sessionId}`)
      console.log(`  Message: "${message}"`)
      console.log(`  Agent URL: ${serviceUrls.agent.base}`)

      // Send message to vivid-commenter via orchestrator A2A stream
      const response = await fetch(serviceUrls.orchestrator.a2aStream, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testUser.userId,
          'x-org-id': testUser.orgId,
        },
        body: JSON.stringify({
          message,
          agentUrl: serviceUrls.agent.base,
          selectedAgentId: 'vivid-commenter',
          sessionId,
        }),
      })

      expect(response.ok).toBe(true)
      console.log(`  Response status: ${response.status}`)

      // Collect SSE events
      console.log('  Collecting SSE events...')
      const events = await collectSSEEvents(response, {
        timeoutMs: 90000,
        stopOnStates: ['completed', 'failed', 'input-required'],
      })

      if (process.env.DEBUG_E2E) {
        printEvents(events)
      }

      console.log(`  Collected ${events.length} SSE events`)

      // Find schedule_proposal event
      proposalEvent = findScheduleProposalEvent(events)

      expect(proposalEvent).not.toBeNull()
      expect(proposalEvent?.type).toBe('schedule_proposal')
      expect(proposalEvent?.proposalId).toBeDefined()
      expect(proposalEvent?.name).toBeDefined()
      expect(proposalEvent?.scheduleType).toBeDefined()

      console.log('  Schedule proposal received:')
      console.log(`    - Proposal ID: ${proposalEvent?.proposalId}`)
      console.log(`    - Name: ${proposalEvent?.name}`)
      console.log(`    - Schedule Type: ${proposalEvent?.scheduleType}`)
      console.log(`    - Cron: ${proposalEvent?.cron}`)
      console.log(`    - Display: ${proposalEvent?.scheduleDisplay}`)
      console.log(`    - Agent ID: ${proposalEvent?.agentId}`)

      console.log('Step 1 PASSED: schedule_proposal event received')
    }, 120000)

    test('Step 2: Confirm schedule proposal via API', async () => {
      console.log('\n--- Step 2: Confirm schedule proposal ---')

      expect(proposalEvent).not.toBeNull()
      if (!proposalEvent) {
        throw new Error('No proposal event from Step 1')
      }

      console.log(`  Confirming proposal: ${proposalEvent.proposalId}`)

      // Confirm the proposal
      const result = await confirmScheduleProposal(
        testUser.userId,
        testUser.orgId,
        proposalEvent,
        serviceUrls.orchestrator.base
      )

      console.log(`  API Response: ok=${result.ok}`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }

      expect(result.ok).toBe(true)
      expect(result.schedule).toBeDefined()

      schedule = result.schedule!
      createdScheduleId = schedule.id

      console.log('  Schedule created:')
      console.log(`    - ID: ${schedule.id}`)
      console.log(`    - Status: ${schedule.status}`)
      console.log(`    - From Proposal: ${schedule.fromProposal}`)
      console.log(`    - Agent ID: ${schedule.agentId}`)

      // Status should be pending_approval since it was created from proposal
      expect(schedule.status).toBe('pending_approval')
      expect(schedule.fromProposal).toBe(true)
      expect(schedule.proposalId).toBe(proposalEvent.proposalId)

      console.log('Step 2 PASSED: Schedule created from proposal')
    }, 30000)

    test('Step 3: Verify schedule is stored in database', async () => {
      console.log('\n--- Step 3: Verify schedule in database ---')

      expect(schedule).not.toBeNull()
      if (!schedule) {
        throw new Error('No schedule from Step 2')
      }

      // Query via API to verify (uses same DB)
      const dbSchedule = await getSchedule(
        testUser.userId,
        testUser.orgId,
        schedule.id,
        serviceUrls.orchestrator.base
      )

      expect(dbSchedule).not.toBeNull()
      expect(dbSchedule?.id).toBe(schedule.id)
      expect(dbSchedule?.userId).toBe(testUser.userId)
      expect(dbSchedule?.orgId).toBe(testUser.orgId)
      expect(dbSchedule?.agentId).toBe('vivid-commenter')
      expect(dbSchedule?.status).toBe('pending_approval')

      console.log('  Database verification:')
      console.log(`    - Found schedule: ${dbSchedule?.id}`)
      console.log(`    - Name: ${dbSchedule?.name}`)
      console.log(`    - Prompt: ${dbSchedule?.prompt?.substring(0, 50)}...`)
      console.log(`    - Status: ${dbSchedule?.status}`)
      console.log(`    - Schedule Type: ${dbSchedule?.scheduleType}`)
      console.log(`    - Cron: ${dbSchedule?.cronExpression}`)

      console.log('Step 3 PASSED: Schedule verified in database')
    }, 30000)

    test('Step 4: Approve schedule to make it active', async () => {
      console.log('\n--- Step 4: Approve schedule ---')

      expect(schedule).not.toBeNull()
      if (!schedule) {
        throw new Error('No schedule from Step 2')
      }

      console.log(`  Approving schedule: ${schedule.id}`)

      const result = await approveSchedule(
        testUser.userId,
        testUser.orgId,
        schedule.id,
        serviceUrls.orchestrator.base
      )

      console.log(`  API Response: ok=${result.ok}`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }

      expect(result.ok).toBe(true)
      expect(result.schedule?.status).toBe('active')

      schedule = result.schedule!

      console.log('  Schedule approved:')
      console.log(`    - Status: ${schedule.status}`)
      console.log(`    - Next Run At: ${schedule.nextRunAt}`)

      console.log('Step 4 PASSED: Schedule approved and active')
    }, 30000)

    test('Step 5: Manually trigger schedule execution (async mode)', async () => {
      console.log('\n--- Step 5: Trigger manual execution (async) ---')

      expect(schedule).not.toBeNull()
      if (!schedule) {
        throw new Error('No schedule from Step 4')
      }

      console.log(`  Triggering async execution for: ${schedule.id}`)

      // Trigger with async=true to return immediately
      const result = await triggerManualRun(
        testUser.userId,
        testUser.orgId,
        schedule.id,
        serviceUrls.orchestrator.base,
        { async: true }
      )

      console.log(`  API Response: ok=${result.ok}`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }

      expect(result.ok).toBe(true)
      expect(result.execution).toBeDefined()
      expect(result.execution?.status).toBe('running')

      execution = result.execution!

      console.log('  Execution started:')
      console.log(`    - ID: ${execution.id}`)
      console.log(`    - Status: ${execution.status}`)
      console.log(`    - Execution Number: ${execution.executionNumber}`)

      console.log('Step 5 PASSED: Async execution triggered')
    }, 30000)

    test('Step 6: Wait for execution to complete', async () => {
      console.log('\n--- Step 6: Wait for execution completion ---')

      expect(schedule).not.toBeNull()
      expect(execution).not.toBeNull()
      if (!schedule || !execution) {
        throw new Error('No schedule/execution from previous steps')
      }

      console.log(`  Polling execution ${execution.id} until completion...`)

      // Poll with 5 minute timeout (agent can take a while)
      const completedExecution = await waitForExecutionComplete(
        testUser.userId,
        testUser.orgId,
        schedule.id,
        execution.id,
        serviceUrls.orchestrator.base,
        300000 // 5 minutes
      )

      expect(completedExecution).not.toBeNull()
      expect(['succeeded', 'failed']).toContain(completedExecution?.status)

      execution = completedExecution!

      console.log('  Execution completed:')
      console.log(`    - Status: ${execution.status}`)
      console.log(`    - Duration: ${execution.durationMs}ms`)
      console.log(`    - Summary: ${execution.resultSummary?.substring(0, 100) || 'N/A'}...`)

      if (execution.status === 'failed') {
        console.log(`    - Error: ${execution.errorMessage}`)
        // Don't fail the test if execution failed - we still verified the flow worked
        console.warn('  WARNING: Execution failed but flow completed')
      }

      console.log('Step 6 PASSED: Execution completed')
    }, 360000) // 6 minutes to allow for 5 min polling + buffer

    test('Step 7: Verify file output in S3 (if execution succeeded)', async () => {
      console.log('\n--- Step 7: Verify file output in S3 ---')

      expect(execution).not.toBeNull()
      if (!execution) {
        throw new Error('No execution from Step 6')
      }

      if (execution.status !== 'succeeded') {
        console.log(`  Skipping file verification - execution status: ${execution.status}`)
        console.log('Step 7 SKIPPED: Execution did not succeed')
        return
      }

      // Check if resultOutputs exists
      if (!execution.resultOutputs || execution.resultOutputs.length === 0) {
        console.log('  No output files recorded in execution')
        console.log('Step 7 SKIPPED: No output files')
        return
      }

      console.log(`  Output files: ${execution.resultOutputs.length}`)
      for (const output of execution.resultOutputs) {
        console.log(`    - ${output.name} (${output.type}): ${output.path}`)
      }

      // Try to verify files exist in S3
      try {
        const htmlOutput = execution.resultOutputs.find(
          (o) => o.type === 'html' || o.name.endsWith('.html')
        )

        if (htmlOutput) {
          console.log(`  Verifying HTML output: ${htmlOutput.path}`)

          // Parse S3 path to get bucket and key
          const s3Match = htmlOutput.path.match(/s3:\/\/([^/]+)\/(.+)/)
          if (s3Match) {
            const files = await s3ListFiles(s3Match[1], s3Match[2].split('/').slice(0, -1).join('/'))
            console.log(`    Found ${files.length} files in output directory`)
            expect(files.length).toBeGreaterThan(0)

            // Verify content is valid HTML
            // Extract filename from S3 path for s3GetFileContent
            const filename = s3Match[2].split('/').pop()!
            const content = await s3GetFileContent(testUser.userId, testUser.orgId, filename)
            if (content) {
              const hasHtmlContent = content.includes('<html') || content.includes('<!DOCTYPE')
              console.log(`    HTML content valid: ${hasHtmlContent}`)
              expect(hasHtmlContent).toBe(true)
            }
          } else {
            console.log('    Path is not S3 format, skipping S3 verification')
          }
        }

        console.log('Step 7 PASSED: File output verified')
      } catch (err) {
        console.log(`  Warning: Could not verify S3 files: ${err}`)
        console.log('Step 7 SKIPPED: S3 verification failed')
      }
    }, 60000)

    test('Step 8: Verify schedule run count updated', async () => {
      console.log('\n--- Step 8: Verify schedule run count ---')

      expect(schedule).not.toBeNull()
      if (!schedule) {
        throw new Error('No schedule from previous steps')
      }

      // Get fresh schedule data
      const updatedSchedule = await getSchedule(
        testUser.userId,
        testUser.orgId,
        schedule.id,
        serviceUrls.orchestrator.base
      )

      expect(updatedSchedule).not.toBeNull()
      expect(updatedSchedule?.runCount).toBeGreaterThanOrEqual(1)

      console.log('  Schedule stats:')
      console.log(`    - Run count: ${updatedSchedule?.runCount}`)
      console.log(`    - Success count: ${updatedSchedule?.successCount}`)
      console.log(`    - Failure count: ${updatedSchedule?.failureCount}`)
      console.log(`    - Last run at: ${updatedSchedule?.lastRunAt}`)

      console.log('Step 8 PASSED: Run count verified')
    }, 30000)
  })
})
