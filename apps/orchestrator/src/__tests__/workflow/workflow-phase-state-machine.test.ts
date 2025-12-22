/**
 * Workflow Phase State Machine E2E Tests
 *
 * Tests phase transitions and state machine behavior:
 * - Valid phase transitions
 * - Phase history recording
 * - Phase data preservation
 * - Activity status updates based on phase
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  TestAgent,
  createTestContext,
  collectSSEEvents,
  sendA2AMessage,
  sendClarificationResponse,
  sendSelectionResponse,
  sendPlanApproval,
  waitForPhase,
  assertPhaseHistory,
  getUniquePort,
  type TestContext,
} from './test-utils'
import { WorkflowSessionStore } from '../../services/workflow-session'
import type { WorkflowPhase, WorkflowPhaseData } from '@pixell/protocols'

describe('Workflow Phase State Machine E2E', () => {
  let ctx: TestContext
  let port: number

  beforeAll(async () => {
    port = getUniquePort()
    ctx = await createTestContext({
      port,
      scenario: 'full_plan_mode',
      delayMs: 50,
    })
  }, 30000)

  afterAll(async () => {
    await ctx.cleanup()
  })

  beforeEach(async () => {
    await ctx.agent.reset()
  })

  describe('valid phase transitions', () => {
    const validTransitions: Array<[WorkflowPhase, WorkflowPhase]> = [
      ['initial', 'clarification'],
      ['initial', 'executing'],
      ['initial', 'error'],
      ['clarification', 'discovery'],
      ['clarification', 'clarification'], // Multiple rounds
      ['clarification', 'executing'],
      ['clarification', 'error'],
      ['discovery', 'selection'],
      ['discovery', 'error'],
      ['selection', 'preview'],
      ['selection', 'clarification'],
      ['selection', 'error'],
      ['preview', 'executing'],
      ['preview', 'clarification'],
      ['preview', 'error'],
      ['executing', 'completed'],
      ['executing', 'error'],
    ]

    it.each(validTransitions)(
      'should allow transition from %s to %s',
      async (from, to) => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: `transition-${from}-${to}`,
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        // First transition to 'from' phase if not 'initial'
        if (from !== 'initial') {
          await ctx.store.updatePhase(workflow.workflowId, from)
        }

        // Now transition to 'to' phase
        const updated = await ctx.store.updatePhase(workflow.workflowId, to)

        expect(updated?.phase).toBe(to)
      }
    )
  })

  describe('phase history recording', () => {
    it('should record initial phase in history', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'history-initial',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.phaseHistory).toHaveLength(1)
      expect(workflow.phaseHistory[0].phase).toBe('initial')
      expect(workflow.phaseHistory[0].timestamp).toBeDefined()
      expect(workflow.phaseHistory[0].previousPhase).toBeUndefined()
    })

    it('should record all phase transitions with previousPhase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'history-multi',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(workflow.workflowId, 'clarification')
      await ctx.store.updatePhase(workflow.workflowId, 'discovery')
      await ctx.store.updatePhase(workflow.workflowId, 'selection')

      const updated = await ctx.store.get(workflow.workflowId)

      expect(updated?.phaseHistory).toHaveLength(4)
      expect(updated?.phaseHistory[0].phase).toBe('initial')
      expect(updated?.phaseHistory[1].phase).toBe('clarification')
      expect(updated?.phaseHistory[1].previousPhase).toBe('initial')
      expect(updated?.phaseHistory[2].phase).toBe('discovery')
      expect(updated?.phaseHistory[2].previousPhase).toBe('clarification')
      expect(updated?.phaseHistory[3].phase).toBe('selection')
      expect(updated?.phaseHistory[3].previousPhase).toBe('discovery')
    })

    it('should include transition reason when provided', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'history-reason',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(
        workflow.workflowId,
        'error',
        undefined,
        'Agent connection lost after 30 seconds'
      )

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.phaseHistory[1].reason).toBe('Agent connection lost after 30 seconds')
    })

    it('should record timestamps for each transition', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'history-timestamps',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const beforeTransition = new Date().toISOString()
      await new Promise((r) => setTimeout(r, 10))

      await ctx.store.updatePhase(workflow.workflowId, 'clarification')

      await new Promise((r) => setTimeout(r, 10))
      const afterTransition = new Date().toISOString()

      const updated = await ctx.store.get(workflow.workflowId)
      const transitionTimestamp = updated?.phaseHistory[1].timestamp

      expect(transitionTimestamp).toBeDefined()
      expect(transitionTimestamp! >= beforeTransition).toBe(true)
      expect(transitionTimestamp! <= afterTransition).toBe(true)
    })
  })

  describe('phase data preservation', () => {
    it('should store clarification data in phaseData', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'data-clarification',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const clarificationData: Partial<WorkflowPhaseData> = {
        clarification: {
          type: 'clarification_needed',
          clarificationId: 'test-clarif-123',
          agentId: 'test-agent',
          questions: [
            {
              questionId: 'q1',
              questionType: 'single_choice',
              question: 'What topic?',
              allowFreeText: false,
              options: [
                { id: 'opt1', label: 'Option 1' },
                { id: 'opt2', label: 'Option 2' },
              ],
            },
          ],
          timeoutMs: 300000,
        },
      }

      await ctx.store.updatePhase(workflow.workflowId, 'clarification', clarificationData)

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.phaseData.clarification?.clarificationId).toBe('test-clarif-123')
      expect(updated?.phaseData.clarification?.questions).toHaveLength(1)
    })

    it('should preserve data from multiple phases', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'data-multi-phase',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      // Add clarification data
      await ctx.store.updatePhase(workflow.workflowId, 'clarification', {
        clarification: {
          clarificationId: 'clarif-1',
          questions: [],
        } as any,
      })

      // Add discovery data
      await ctx.store.updatePhase(workflow.workflowId, 'discovery', {
        discovery: {
          discoveryId: 'disc-1',
          items: [{ id: 'item-1', name: 'Item 1' }],
        } as any,
      })

      // Add selection data
      await ctx.store.updatePhase(workflow.workflowId, 'selection', {
        selection: {
          selectionId: 'sel-1',
          selectedIds: ['item-1'],
        } as any,
      })

      // Add preview data
      await ctx.store.updatePhase(workflow.workflowId, 'preview', {
        preview: {
          planId: 'plan-1',
          title: 'Test Plan',
        } as any,
      })

      const updated = await ctx.store.get(workflow.workflowId)

      // All phase data should be preserved
      expect(updated?.phaseData.clarification?.clarificationId).toBe('clarif-1')
      expect(updated?.phaseData.discovery?.discoveryId).toBe('disc-1')
      expect(updated?.phaseData.selection?.selectionId).toBe('sel-1')
      expect(updated?.phaseData.preview?.planId).toBe('plan-1')
    })

    it('should allow updating phase data without changing phase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'data-update-same-phase',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(workflow.workflowId, 'clarification', {
        clarification: { clarificationId: 'first' } as any,
      })

      // Update with new clarification (same phase)
      await ctx.store.updatePhase(workflow.workflowId, 'clarification', {
        clarification: { clarificationId: 'second' } as any,
      })

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.phaseData.clarification?.clarificationId).toBe('second')
    })
  })

  describe('activity status updates', () => {
    it('should set status to "pending" on creation', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'status-pending',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.activityStatus).toBe('pending')
    })

    it('should set status to "running" when entering executing phase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'status-running',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(workflow.workflowId, 'executing')

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('running')
    })

    it('should set status to "completed" when entering completed phase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'status-completed',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(workflow.workflowId, 'executing')
      await ctx.store.updatePhase(workflow.workflowId, 'completed')

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('completed')
      expect(updated?.completedAt).toBeDefined()
    })

    it('should set status to "error" when entering error phase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'status-error',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(workflow.workflowId, 'error')

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('error')
    })

    it('should keep "pending" status during clarification phases', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'status-clarification',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updatePhase(workflow.workflowId, 'clarification')
      let updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('pending')

      await ctx.store.updatePhase(workflow.workflowId, 'discovery')
      updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('pending')

      await ctx.store.updatePhase(workflow.workflowId, 'selection')
      updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('pending')

      await ctx.store.updatePhase(workflow.workflowId, 'preview')
      updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('pending')
    })
  })

  describe('complete workflow flow', () => {
    it('should transition through all phases correctly', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'full-flow',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      // Initial -> Clarification
      await ctx.store.updatePhase(workflow.workflowId, 'clarification', {
        clarification: { clarificationId: 'c1' } as any,
      })

      // Clarification -> Discovery
      await ctx.store.updatePhase(workflow.workflowId, 'discovery', {
        discovery: { discoveryId: 'd1' } as any,
      })

      // Discovery -> Selection
      await ctx.store.updatePhase(workflow.workflowId, 'selection', {
        selection: { selectionId: 's1' } as any,
      })

      // Selection -> Preview
      await ctx.store.updatePhase(workflow.workflowId, 'preview', {
        preview: { planId: 'p1' } as any,
      })

      // Preview -> Executing
      await ctx.store.updatePhase(workflow.workflowId, 'executing')

      // Executing -> Completed
      await ctx.store.updatePhase(workflow.workflowId, 'completed')

      const final = await ctx.store.get(workflow.workflowId)

      assertPhaseHistory(final!, [
        'initial',
        'clarification',
        'discovery',
        'selection',
        'preview',
        'executing',
        'completed',
      ])

      expect(final?.activityStatus).toBe('completed')
      expect(final?.completedAt).toBeDefined()
    })
  })

  describe('progress tracking', () => {
    it('should initialize progress with zero current', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'progress-init',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.progress.current).toBe(0)
    })

    it('should update progress values', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'progress-update',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updateProgress(workflow.workflowId, {
        current: 5,
        total: 10,
        message: 'Step 5 of 10',
        percentage: 50,
      })

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.progress.current).toBe(5)
      expect(updated?.progress.total).toBe(10)
      expect(updated?.progress.message).toBe('Step 5 of 10')
      expect(updated?.progress.percentage).toBe(50)
    })

    it('should preserve previous progress values when partially updating', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'progress-preserve',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.updateProgress(workflow.workflowId, {
        current: 3,
        total: 10,
      })

      await ctx.store.updateProgress(workflow.workflowId, {
        message: 'Processing...',
      })

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.progress.current).toBe(3)
      expect(updated?.progress.total).toBe(10)
      expect(updated?.progress.message).toBe('Processing...')
    })
  })

  describe('error handling', () => {
    it('should store error message when erroring workflow', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'error-message',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.error(workflow.workflowId, 'Connection timeout after 30 seconds')

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.phase).toBe('error')
      expect(updated?.activityStatus).toBe('error')
      expect(updated?.error).toBe('Connection timeout after 30 seconds')
    })

    it('should allow transition to error from any phase', async () => {
      const phases: WorkflowPhase[] = [
        'initial',
        'clarification',
        'discovery',
        'selection',
        'preview',
        'executing',
      ]

      for (const phase of phases) {
        const workflow = await ctx.store.createWorkflow({
          sessionId: `error-from-${phase}`,
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        if (phase !== 'initial') {
          await ctx.store.updatePhase(workflow.workflowId, phase)
        }

        await ctx.store.error(workflow.workflowId, `Error from ${phase}`)

        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.phase).toBe('error')
        expect(updated?.error).toBe(`Error from ${phase}`)
      }
    })
  })

  describe('timestamp tracking', () => {
    it('should set startedAt on creation', async () => {
      const before = new Date().toISOString()

      const workflow = await ctx.store.createWorkflow({
        sessionId: 'timestamp-started',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const after = new Date().toISOString()

      expect(workflow.startedAt).toBeDefined()
      expect(workflow.startedAt >= before).toBe(true)
      expect(workflow.startedAt <= after).toBe(true)
    })

    it('should update updatedAt on phase transitions', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'timestamp-updated',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const initialUpdatedAt = workflow.updatedAt

      await new Promise((r) => setTimeout(r, 10))
      await ctx.store.updatePhase(workflow.workflowId, 'clarification')

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.updatedAt).not.toBe(initialUpdatedAt)
      expect(updated?.updatedAt > initialUpdatedAt).toBe(true)
    })

    it('should set completedAt only when entering completed phase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'timestamp-completed',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      // Not completed yet
      expect(workflow.completedAt).toBeUndefined()

      await ctx.store.updatePhase(workflow.workflowId, 'executing')
      let updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.completedAt).toBeUndefined()

      // Now complete
      await ctx.store.updatePhase(workflow.workflowId, 'completed')
      updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.completedAt).toBeDefined()
    })
  })
})
