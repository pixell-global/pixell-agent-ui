/**
 * Unit Tests for WorkflowSessionStore
 *
 * Tests the centralized workflow state management without external dependencies.
 * Covers all methods: createWorkflow, updatePhase, updateProgress, addEvent, complete, error
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowSessionStore, getWorkflowSessionStore } from '../../services/workflow-session'
import type { WorkflowPhase, WorkflowPhaseData } from '@pixell/protocols'

describe('WorkflowSessionStore', () => {
  let store: WorkflowSessionStore

  beforeEach(() => {
    // Create fresh store for each test (in-memory mode)
    store = new WorkflowSessionStore({ ttlSeconds: 300 })
  })

  describe('createWorkflow', () => {
    it('should create a workflow with unique UUID workflowId', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        agentUrl: 'http://localhost:8000',
        initialMessageId: 'user-msg-1',
        responseMessageId: 'assistant-msg-1',
      })

      expect(workflow.workflowId).toBeDefined()
      expect(workflow.workflowId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('should initialize workflow in "initial" phase', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.phase).toBe('initial')
    })

    it('should initialize with "pending" activityStatus', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.activityStatus).toBe('pending')
    })

    it('should record initial phase in phaseHistory', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.phaseHistory).toHaveLength(1)
      expect(workflow.phaseHistory[0].phase).toBe('initial')
      expect(workflow.phaseHistory[0].timestamp).toBeDefined()
    })

    it('should store all provided parameters', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'test-session-123',
        agentId: 'my-agent',
        agentUrl: 'http://example.com:9999',
        initialMessageId: 'user-message-xyz',
        responseMessageId: 'assistant-response-abc',
      })

      expect(workflow.sessionId).toBe('test-session-123')
      expect(workflow.agentId).toBe('my-agent')
      expect(workflow.agentUrl).toBe('http://example.com:9999')
      expect(workflow.initialMessageId).toBe('user-message-xyz')
      expect(workflow.responseMessageId).toBe('assistant-response-abc')
    })

    it('should initialize with empty phaseData', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.phaseData).toEqual({})
    })

    it('should initialize with zero eventSequence', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.eventSequence).toBe(0)
    })

    it('should initialize with empty bufferedEvents', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.bufferedEvents).toEqual([])
    })

    it('should set startedAt and updatedAt timestamps', async () => {
      const before = new Date().toISOString()
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })
      const after = new Date().toISOString()

      expect(workflow.startedAt).toBeDefined()
      expect(workflow.updatedAt).toBeDefined()
      expect(workflow.startedAt >= before).toBe(true)
      expect(workflow.startedAt <= after).toBe(true)
    })

    it('should create unique workflowIds for multiple workflows', async () => {
      const workflow1 = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const workflow2 = await store.createWorkflow({
        sessionId: 'session-2',
        agentId: 'test-agent',
        initialMessageId: 'user-2',
        responseMessageId: 'assistant-2',
      })

      expect(workflow1.workflowId).not.toBe(workflow2.workflowId)
    })
  })

  describe('get', () => {
    it('should retrieve stored workflow by workflowId', async () => {
      const created = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const retrieved = await store.get(created.workflowId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.workflowId).toBe(created.workflowId)
      expect(retrieved?.sessionId).toBe('session-1')
    })

    it('should return null for non-existent workflowId', async () => {
      const result = await store.get('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('getBySessionId', () => {
    it('should retrieve workflow by sessionId', async () => {
      const created = await store.createWorkflow({
        sessionId: 'unique-session-xyz',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const retrieved = await store.getBySessionId('unique-session-xyz')

      expect(retrieved).toBeDefined()
      expect(retrieved?.workflowId).toBe(created.workflowId)
    })

    it('should return null for non-existent sessionId', async () => {
      const result = await store.getBySessionId('non-existent-session')
      expect(result).toBeNull()
    })
  })

  describe('updatePhase', () => {
    it('should update workflow phase', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const updated = await store.updatePhase(workflow.workflowId, 'clarification')

      expect(updated?.phase).toBe('clarification')
    })

    it('should record phase transition in history', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updatePhase(workflow.workflowId, 'clarification')

      const updated = await store.get(workflow.workflowId)
      expect(updated?.phaseHistory).toHaveLength(2)
      expect(updated?.phaseHistory[1].phase).toBe('clarification')
      expect(updated?.phaseHistory[1].previousPhase).toBe('initial')
    })

    it('should include timestamp in phase transition', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const before = new Date().toISOString()
      await store.updatePhase(workflow.workflowId, 'clarification')
      const after = new Date().toISOString()

      const updated = await store.get(workflow.workflowId)
      const transitionTimestamp = updated?.phaseHistory[1].timestamp

      expect(transitionTimestamp).toBeDefined()
      expect(transitionTimestamp! >= before).toBe(true)
      expect(transitionTimestamp! <= after).toBe(true)
    })

    it('should include reason in phase transition when provided', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updatePhase(workflow.workflowId, 'error', undefined, 'Connection timeout')

      const updated = await store.get(workflow.workflowId)
      expect(updated?.phaseHistory[1].reason).toBe('Connection timeout')
    })

    it('should store phase data when provided', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const clarificationData: Partial<WorkflowPhaseData> = {
        clarification: {
          type: 'clarification_needed',
          clarificationId: 'clarif-123',
          agentId: 'test-agent',
          questions: [{ questionId: 'q1', questionType: 'free_text', question: 'What topic?', allowFreeText: true }],
          timeoutMs: 300000,
        },
      }

      await store.updatePhase(workflow.workflowId, 'clarification', clarificationData)

      const updated = await store.get(workflow.workflowId)
      expect(updated?.phaseData.clarification).toEqual(clarificationData.clarification)
    })

    it('should preserve existing phase data when adding new data', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      // Add clarification data
      await store.updatePhase(workflow.workflowId, 'clarification', {
        clarification: { clarificationId: 'c1' } as any,
      })

      // Add selection data
      await store.updatePhase(workflow.workflowId, 'selection', {
        selection: { selectionId: 's1' } as any,
      })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.phaseData.clarification).toBeDefined()
      expect(updated?.phaseData.selection).toBeDefined()
    })

    it('should return null for non-existent workflow', async () => {
      const result = await store.updatePhase('non-existent', 'clarification')
      expect(result).toBeNull()
    })

    it('should update updatedAt timestamp', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const originalUpdatedAt = workflow.updatedAt
      await new Promise(r => setTimeout(r, 10)) // Small delay
      await store.updatePhase(workflow.workflowId, 'clarification')

      const updated = await store.get(workflow.workflowId)
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt)
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
          const workflow = await store.createWorkflow({
            sessionId: `session-${from}-${to}`,
            agentId: 'test-agent',
            initialMessageId: 'user-1',
            responseMessageId: 'assistant-1',
          })

          // First transition to 'from' phase if not 'initial'
          if (from !== 'initial') {
            await store.updatePhase(workflow.workflowId, from)
          }

          // Now transition to 'to' phase
          const updated = await store.updatePhase(workflow.workflowId, to)

          expect(updated?.phase).toBe(to)
        }
      )
    })

    describe('activityStatus updates', () => {
      it('should set activityStatus to "running" when entering executing phase', async () => {
        const workflow = await store.createWorkflow({
          sessionId: 'session-1',
          agentId: 'test-agent',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await store.updatePhase(workflow.workflowId, 'executing')

        const updated = await store.get(workflow.workflowId)
        expect(updated?.activityStatus).toBe('running')
      })

      it('should set activityStatus to "completed" when entering completed phase', async () => {
        const workflow = await store.createWorkflow({
          sessionId: 'session-1',
          agentId: 'test-agent',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await store.updatePhase(workflow.workflowId, 'executing')
        await store.updatePhase(workflow.workflowId, 'completed')

        const updated = await store.get(workflow.workflowId)
        expect(updated?.activityStatus).toBe('completed')
      })

      it('should set activityStatus to "error" when entering error phase', async () => {
        const workflow = await store.createWorkflow({
          sessionId: 'session-1',
          agentId: 'test-agent',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await store.updatePhase(workflow.workflowId, 'error')

        const updated = await store.get(workflow.workflowId)
        expect(updated?.activityStatus).toBe('error')
      })

      it('should set completedAt when entering completed phase', async () => {
        const workflow = await store.createWorkflow({
          sessionId: 'session-1',
          agentId: 'test-agent',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await store.updatePhase(workflow.workflowId, 'completed')

        const updated = await store.get(workflow.workflowId)
        expect(updated?.completedAt).toBeDefined()
      })
    })
  })

  describe('updateProgress', () => {
    it('should update progress current value', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updateProgress(workflow.workflowId, { current: 5 })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.progress.current).toBe(5)
    })

    it('should update progress total value', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updateProgress(workflow.workflowId, { total: 10 })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.progress.total).toBe(10)
    })

    it('should update progress message', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updateProgress(workflow.workflowId, { message: 'Processing step 3 of 10' })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.progress.message).toBe('Processing step 3 of 10')
    })

    it('should update progress percentage', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updateProgress(workflow.workflowId, { percentage: 75 })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.progress.percentage).toBe(75)
    })

    it('should preserve existing progress values when updating', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updateProgress(workflow.workflowId, { current: 5, total: 10 })
      await store.updateProgress(workflow.workflowId, { message: 'Step 5' })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.progress.current).toBe(5)
      expect(updated?.progress.total).toBe(10)
      expect(updated?.progress.message).toBe('Step 5')
    })

    it('should return null for non-existent workflow', async () => {
      const result = await store.updateProgress('non-existent', { current: 5 })
      expect(result).toBeNull()
    })
  })

  describe('addEvent', () => {
    it('should add event to bufferedEvents', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.addEvent(workflow.workflowId, {
        type: 'status-update',
        timestamp: new Date().toISOString(),
        data: { message: 'Processing...' },
      })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.bufferedEvents).toHaveLength(1)
      expect(updated?.bufferedEvents[0].type).toBe('status-update')
    })

    it('should assign sequential sequence numbers', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.addEvent(workflow.workflowId, {
        type: 'event-1',
        timestamp: new Date().toISOString(),
        data: {},
      })

      await store.addEvent(workflow.workflowId, {
        type: 'event-2',
        timestamp: new Date().toISOString(),
        data: {},
      })

      await store.addEvent(workflow.workflowId, {
        type: 'event-3',
        timestamp: new Date().toISOString(),
        data: {},
      })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.bufferedEvents[0].sequence).toBe(0)
      expect(updated?.bufferedEvents[1].sequence).toBe(1)
      expect(updated?.bufferedEvents[2].sequence).toBe(2)
      expect(updated?.eventSequence).toBe(3)
    })

    it('should include workflowId in event', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.addEvent(workflow.workflowId, {
        type: 'test-event',
        timestamp: new Date().toISOString(),
        data: {},
      })

      const updated = await store.get(workflow.workflowId)
      expect(updated?.bufferedEvents[0].workflowId).toBe(workflow.workflowId)
    })

    it('should limit bufferedEvents to 100 entries', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      // Add 110 events
      for (let i = 0; i < 110; i++) {
        await store.addEvent(workflow.workflowId, {
          type: `event-${i}`,
          timestamp: new Date().toISOString(),
          data: { index: i },
        })
      }

      const updated = await store.get(workflow.workflowId)
      expect(updated?.bufferedEvents).toHaveLength(100)
      // Should keep the last 100 events
      expect(updated?.bufferedEvents[0].type).toBe('event-10')
      expect(updated?.bufferedEvents[99].type).toBe('event-109')
    })

    it('should return null for non-existent workflow', async () => {
      const result = await store.addEvent('non-existent', {
        type: 'test',
        timestamp: new Date().toISOString(),
        data: {},
      })
      expect(result).toBeNull()
    })
  })

  describe('complete', () => {
    it('should transition workflow to completed phase', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.complete(workflow.workflowId)

      const updated = await store.get(workflow.workflowId)
      expect(updated?.phase).toBe('completed')
    })

    it('should set activityStatus to "completed"', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.complete(workflow.workflowId)

      const updated = await store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('completed')
    })

    it('should set completedAt timestamp', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const before = new Date().toISOString()
      await store.complete(workflow.workflowId)
      const after = new Date().toISOString()

      const updated = await store.get(workflow.workflowId)
      expect(updated?.completedAt).toBeDefined()
      expect(updated?.completedAt! >= before).toBe(true)
      expect(updated?.completedAt! <= after).toBe(true)
    })
  })

  describe('error', () => {
    it('should transition workflow to error phase', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.error(workflow.workflowId, 'Something went wrong')

      const updated = await store.get(workflow.workflowId)
      expect(updated?.phase).toBe('error')
    })

    it('should set activityStatus to "error"', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.error(workflow.workflowId, 'Something went wrong')

      const updated = await store.get(workflow.workflowId)
      expect(updated?.activityStatus).toBe('error')
    })

    it('should store error message', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.error(workflow.workflowId, 'Connection timeout after 30 seconds')

      const updated = await store.get(workflow.workflowId)
      expect(updated?.error).toBe('Connection timeout after 30 seconds')
    })
  })

  describe('delete', () => {
    it('should remove workflow from store', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.delete(workflow.workflowId)

      const retrieved = await store.get(workflow.workflowId)
      expect(retrieved).toBeNull()
    })
  })

  describe('getActiveWorkflows', () => {
    it('should return workflows with pending status', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const activeWorkflows = await store.getActiveWorkflows()
      const workflowIds = activeWorkflows.map(w => w.workflowId)

      expect(workflowIds).toContain(workflow.workflowId)
    })

    it('should return workflows with running status', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.updatePhase(workflow.workflowId, 'executing')

      const activeWorkflows = await store.getActiveWorkflows()
      const workflowIds = activeWorkflows.map(w => w.workflowId)

      expect(workflowIds).toContain(workflow.workflowId)
    })

    it('should NOT return completed workflows', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.complete(workflow.workflowId)

      const activeWorkflows = await store.getActiveWorkflows()
      const workflowIds = activeWorkflows.map(w => w.workflowId)

      expect(workflowIds).not.toContain(workflow.workflowId)
    })

    it('should NOT return errored workflows', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await store.error(workflow.workflowId, 'Test error')

      const activeWorkflows = await store.getActiveWorkflows()
      const workflowIds = activeWorkflows.map(w => w.workflowId)

      expect(workflowIds).not.toContain(workflow.workflowId)
    })

    it('should return multiple active workflows', async () => {
      const workflow1 = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const workflow2 = await store.createWorkflow({
        sessionId: 'session-2',
        agentId: 'test-agent',
        initialMessageId: 'user-2',
        responseMessageId: 'assistant-2',
      })
      await store.updatePhase(workflow2.workflowId, 'executing')

      const activeWorkflows = await store.getActiveWorkflows()
      const workflowIds = activeWorkflows.map(w => w.workflowId)

      expect(workflowIds).toContain(workflow1.workflowId)
      expect(workflowIds).toContain(workflow2.workflowId)
    })
  })

  describe('message ID correlation', () => {
    it('should preserve initialMessageId through all phase transitions', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-message-original',
        responseMessageId: 'assistant-1',
      })

      // Go through all phases
      await store.updatePhase(workflow.workflowId, 'clarification')
      await store.updatePhase(workflow.workflowId, 'discovery')
      await store.updatePhase(workflow.workflowId, 'selection')
      await store.updatePhase(workflow.workflowId, 'preview')
      await store.updatePhase(workflow.workflowId, 'executing')
      await store.updatePhase(workflow.workflowId, 'completed')

      const final = await store.get(workflow.workflowId)
      expect(final?.initialMessageId).toBe('user-message-original')
    })

    it('should preserve responseMessageId through all phase transitions', async () => {
      const workflow = await store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-message-original',
      })

      // Go through all phases
      await store.updatePhase(workflow.workflowId, 'clarification')
      await store.updatePhase(workflow.workflowId, 'executing')
      await store.updatePhase(workflow.workflowId, 'completed')

      const final = await store.get(workflow.workflowId)
      expect(final?.responseMessageId).toBe('assistant-message-original')
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance from getWorkflowSessionStore', () => {
      const store1 = getWorkflowSessionStore()
      const store2 = getWorkflowSessionStore()

      expect(store1).toBe(store2)
    })
  })
})
