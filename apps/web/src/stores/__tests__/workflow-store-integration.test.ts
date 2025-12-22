/**
 * Workflow Store Integration Tests
 *
 * Comprehensive tests for the workflow-store Zustand store that manages
 * multi-phase agent workflow state. Tests all methods, selectors, and
 * edge cases for workflow correlation and phase state machine.
 */

import { renderHook, act } from '@testing-library/react'
import {
  useWorkflowStore,
  selectActiveWorkflow,
  selectWorkflowProgress,
  selectWorkflowPhase,
  selectWorkflowPhaseData,
  selectRunningWorkflows,
  selectResponseMessageId,
  type WorkflowPhase,
  type StartWorkflowParams,
} from '../workflow-store'

// Reset store before each test
function resetStore() {
  useWorkflowStore.setState({
    workflows: {},
    activeWorkflowId: null,
  })
}

describe('useWorkflowStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('initial state', () => {
    it('should have empty workflows object', () => {
      const { result } = renderHook(() => useWorkflowStore())
      expect(result.current.workflows).toEqual({})
    })

    it('should have null activeWorkflowId', () => {
      const { result } = renderHook(() => useWorkflowStore())
      expect(result.current.activeWorkflowId).toBeNull()
    })
  })

  describe('startWorkflow', () => {
    const createParams = (overrides?: Partial<StartWorkflowParams>): StartWorkflowParams => ({
      workflowId: 'workflow-123',
      sessionId: 'session-456',
      agentId: 'test-agent',
      agentUrl: 'http://localhost:8000',
      initialMessageId: 'user-msg-1',
      responseMessageId: 'assistant-msg-1',
      ...overrides,
    })

    it('should create workflow with provided workflowId', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams({ workflowId: 'test-workflow-id' })

      act(() => {
        result.current.startWorkflow(params)
      })

      expect(result.current.workflows['test-workflow-id']).toBeDefined()
    })

    it('should initialize workflow in "initial" phase', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.phase).toBe('initial')
    })

    it('should set activityStatus to "pending"', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.activityStatus).toBe('pending')
    })

    it('should record initial phase in phaseHistory', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.phaseHistory).toHaveLength(1)
      expect(workflow.phaseHistory[0].phase).toBe('initial')
      expect(workflow.phaseHistory[0].timestamp).toBeDefined()
    })

    it('should store all provided parameters correctly', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams({
        sessionId: 'my-session',
        agentId: 'my-agent',
        agentUrl: 'http://agent.example.com',
        initialMessageId: 'initial-msg',
        responseMessageId: 'response-msg',
      })

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.sessionId).toBe('my-session')
      expect(workflow.agentId).toBe('my-agent')
      expect(workflow.agentUrl).toBe('http://agent.example.com')
      expect(workflow.initialMessageId).toBe('initial-msg')
      expect(workflow.responseMessageId).toBe('response-msg')
    })

    it('should initialize with empty phaseData', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.phaseData).toEqual({})
    })

    it('should initialize progress with zero current', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.progress.current).toBe(0)
    })

    it('should initialize eventSequence at zero', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      act(() => {
        result.current.startWorkflow(params)
      })

      const workflow = result.current.workflows['workflow-123']
      expect(workflow.eventSequence).toBe(0)
    })

    it('should set startedAt and updatedAt timestamps', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()
      const before = new Date().toISOString()

      act(() => {
        result.current.startWorkflow(params)
      })

      const after = new Date().toISOString()
      const workflow = result.current.workflows['workflow-123']

      expect(workflow.startedAt).toBeDefined()
      expect(workflow.updatedAt).toBeDefined()
      expect(workflow.startedAt >= before).toBe(true)
      expect(workflow.startedAt <= after).toBe(true)
    })

    it('should set activeWorkflowId to new workflow', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams({ workflowId: 'new-active-workflow' })

      act(() => {
        result.current.startWorkflow(params)
      })

      expect(result.current.activeWorkflowId).toBe('new-active-workflow')
    })

    it('should return the created workflow', () => {
      const { result } = renderHook(() => useWorkflowStore())
      const params = createParams()

      let returnedWorkflow: any
      act(() => {
        returnedWorkflow = result.current.startWorkflow(params)
      })

      expect(returnedWorkflow.workflowId).toBe('workflow-123')
      expect(returnedWorkflow.phase).toBe('initial')
    })

    it('should allow multiple workflows with unique IDs', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow(createParams({ workflowId: 'workflow-1' }))
        result.current.startWorkflow(createParams({ workflowId: 'workflow-2' }))
        result.current.startWorkflow(createParams({ workflowId: 'workflow-3' }))
      })

      expect(Object.keys(result.current.workflows)).toHaveLength(3)
      expect(result.current.workflows['workflow-1']).toBeDefined()
      expect(result.current.workflows['workflow-2']).toBeDefined()
      expect(result.current.workflows['workflow-3']).toBeDefined()
    })
  })

  describe('updatePhase', () => {
    const setupWorkflow = () => {
      const { result } = renderHook(() => useWorkflowStore())
      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })
      return result
    }

    it('should update workflow phase', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updatePhase('test-workflow', 'clarification')
      })

      expect(result.current.workflows['test-workflow'].phase).toBe('clarification')
    })

    it('should record phase transition in history', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updatePhase('test-workflow', 'clarification')
      })

      const workflow = result.current.workflows['test-workflow']
      expect(workflow.phaseHistory).toHaveLength(2)
      expect(workflow.phaseHistory[1].phase).toBe('clarification')
      expect(workflow.phaseHistory[1].previousPhase).toBe('initial')
    })

    it('should include timestamp in phase transition', () => {
      const result = setupWorkflow()
      const before = new Date().toISOString()

      act(() => {
        result.current.updatePhase('test-workflow', 'clarification')
      })

      const after = new Date().toISOString()
      const workflow = result.current.workflows['test-workflow']
      const timestamp = workflow.phaseHistory[1].timestamp

      expect(timestamp).toBeDefined()
      expect(timestamp >= before).toBe(true)
      expect(timestamp <= after).toBe(true)
    })

    it('should include reason when provided', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updatePhase('test-workflow', 'error', undefined, 'Agent timeout')
      })

      const workflow = result.current.workflows['test-workflow']
      expect(workflow.phaseHistory[1].reason).toBe('Agent timeout')
    })

    it('should store phase data when provided', () => {
      const result = setupWorkflow()

      const clarificationData = {
        clarification: {
          type: 'clarification_needed' as const,
          clarificationId: 'clarif-123',
          agentId: 'agent-1',
          questions: [{ questionId: 'q1', questionType: 'free_text' as const, question: 'What topic?' }],
          timeoutMs: 300000,
        },
      }

      act(() => {
        result.current.updatePhase('test-workflow', 'clarification', clarificationData)
      })

      const workflow = result.current.workflows['test-workflow']
      expect(workflow.phaseData.clarification).toEqual(clarificationData.clarification)
    })

    it('should preserve existing phase data when adding new data', () => {
      const result = setupWorkflow()

      // Add clarification data
      act(() => {
        result.current.updatePhase('test-workflow', 'clarification', {
          clarification: { clarificationId: 'c1' } as any,
        })
      })

      // Add selection data
      act(() => {
        result.current.updatePhase('test-workflow', 'selection', {
          selection: { selectionId: 's1' } as any,
        })
      })

      const workflow = result.current.workflows['test-workflow']
      expect(workflow.phaseData.clarification).toBeDefined()
      expect(workflow.phaseData.selection).toBeDefined()
    })

    it('should not crash for non-existent workflow', () => {
      const result = setupWorkflow()

      // This should not throw
      act(() => {
        result.current.updatePhase('non-existent', 'clarification')
      })

      expect(result.current.workflows['test-workflow'].phase).toBe('initial')
    })

    it('should update updatedAt timestamp', async () => {
      const result = setupWorkflow()
      const originalUpdatedAt = result.current.workflows['test-workflow'].updatedAt

      // Small delay to ensure timestamp difference
      await new Promise(r => setTimeout(r, 10))

      act(() => {
        result.current.updatePhase('test-workflow', 'clarification')
      })

      expect(result.current.workflows['test-workflow'].updatedAt).not.toBe(originalUpdatedAt)
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

      it.each(validTransitions)('should allow transition from %s to %s', (from, to) => {
        const result = setupWorkflow()

        // First transition to 'from' phase if not 'initial'
        if (from !== 'initial') {
          act(() => {
            result.current.updatePhase('test-workflow', from)
          })
        }

        // Now transition to 'to' phase
        act(() => {
          result.current.updatePhase('test-workflow', to)
        })

        expect(result.current.workflows['test-workflow'].phase).toBe(to)
      })
    })

    describe('activityStatus updates', () => {
      it('should set activityStatus to "running" when entering executing phase', () => {
        const result = setupWorkflow()

        act(() => {
          result.current.updatePhase('test-workflow', 'executing')
        })

        expect(result.current.workflows['test-workflow'].activityStatus).toBe('running')
      })

      it('should set activityStatus to "completed" when entering completed phase', () => {
        const result = setupWorkflow()

        act(() => {
          result.current.updatePhase('test-workflow', 'executing')
        })
        act(() => {
          result.current.updatePhase('test-workflow', 'completed')
        })

        expect(result.current.workflows['test-workflow'].activityStatus).toBe('completed')
      })

      it('should set activityStatus to "error" when entering error phase', () => {
        const result = setupWorkflow()

        act(() => {
          result.current.updatePhase('test-workflow', 'error')
        })

        expect(result.current.workflows['test-workflow'].activityStatus).toBe('error')
      })

      it('should set completedAt when entering completed phase', () => {
        const result = setupWorkflow()

        act(() => {
          result.current.updatePhase('test-workflow', 'completed')
        })

        expect(result.current.workflows['test-workflow'].completedAt).toBeDefined()
      })

      it('should NOT set completedAt for error phase', () => {
        const result = setupWorkflow()

        act(() => {
          result.current.updatePhase('test-workflow', 'error')
        })

        expect(result.current.workflows['test-workflow'].completedAt).toBeUndefined()
      })
    })
  })

  describe('updateProgress', () => {
    const setupWorkflow = () => {
      const { result } = renderHook(() => useWorkflowStore())
      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })
      return result
    }

    it('should update progress current value', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updateProgress('test-workflow', { current: 5 })
      })

      expect(result.current.workflows['test-workflow'].progress.current).toBe(5)
    })

    it('should update progress total value', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updateProgress('test-workflow', { total: 10 })
      })

      expect(result.current.workflows['test-workflow'].progress.total).toBe(10)
    })

    it('should update progress message', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updateProgress('test-workflow', { message: 'Processing step 3 of 10' })
      })

      expect(result.current.workflows['test-workflow'].progress.message).toBe('Processing step 3 of 10')
    })

    it('should update progress percentage', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updateProgress('test-workflow', { percentage: 75 })
      })

      expect(result.current.workflows['test-workflow'].progress.percentage).toBe(75)
    })

    it('should preserve existing progress values when updating', () => {
      const result = setupWorkflow()

      act(() => {
        result.current.updateProgress('test-workflow', { current: 5, total: 10 })
      })
      act(() => {
        result.current.updateProgress('test-workflow', { message: 'Step 5' })
      })

      const progress = result.current.workflows['test-workflow'].progress
      expect(progress.current).toBe(5)
      expect(progress.total).toBe(10)
      expect(progress.message).toBe('Step 5')
    })

    it('should not crash for non-existent workflow', () => {
      const result = setupWorkflow()

      // This should not throw
      act(() => {
        result.current.updateProgress('non-existent', { current: 5 })
      })

      // Original workflow unchanged
      expect(result.current.workflows['test-workflow'].progress.current).toBe(0)
    })
  })

  describe('completeWorkflow', () => {
    it('should transition workflow to completed phase', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })

      act(() => {
        result.current.completeWorkflow('test-workflow')
      })

      expect(result.current.workflows['test-workflow'].phase).toBe('completed')
      expect(result.current.workflows['test-workflow'].activityStatus).toBe('completed')
    })
  })

  describe('errorWorkflow', () => {
    it('should transition workflow to error phase and store error message', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })

      act(() => {
        result.current.errorWorkflow('test-workflow', 'Connection timeout')
      })

      expect(result.current.workflows['test-workflow'].phase).toBe('error')
      expect(result.current.workflows['test-workflow'].activityStatus).toBe('error')
      expect(result.current.workflows['test-workflow'].error).toBe('Connection timeout')
    })
  })

  describe('clearWorkflow', () => {
    it('should remove workflow from store', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })

      act(() => {
        result.current.clearWorkflow('test-workflow')
      })

      expect(result.current.workflows['test-workflow']).toBeUndefined()
    })

    it('should clear activeWorkflowId if cleared workflow was active', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })

      expect(result.current.activeWorkflowId).toBe('test-workflow')

      act(() => {
        result.current.clearWorkflow('test-workflow')
      })

      expect(result.current.activeWorkflowId).toBeNull()
    })

    it('should NOT clear activeWorkflowId if different workflow cleared', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'workflow-1',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })
      act(() => {
        result.current.startWorkflow({
          workflowId: 'workflow-2',
          sessionId: 'session-2',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-2',
          responseMessageId: 'assistant-2',
        })
      })

      // workflow-2 is now active
      expect(result.current.activeWorkflowId).toBe('workflow-2')

      // Clear workflow-1
      act(() => {
        result.current.clearWorkflow('workflow-1')
      })

      // workflow-2 should still be active
      expect(result.current.activeWorkflowId).toBe('workflow-2')
    })
  })

  describe('setActiveWorkflow', () => {
    it('should set activeWorkflowId', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'workflow-1',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })
      act(() => {
        result.current.startWorkflow({
          workflowId: 'workflow-2',
          sessionId: 'session-2',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-2',
          responseMessageId: 'assistant-2',
        })
      })

      act(() => {
        result.current.setActiveWorkflow('workflow-1')
      })

      expect(result.current.activeWorkflowId).toBe('workflow-1')
    })

    it('should allow setting to null', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
      })

      act(() => {
        result.current.setActiveWorkflow(null)
      })

      expect(result.current.activeWorkflowId).toBeNull()
    })
  })

  describe('query methods', () => {
    const setupMultipleWorkflows = () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'workflow-1',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-msg-1',
          responseMessageId: 'assistant-msg-1',
        })
        result.current.startWorkflow({
          workflowId: 'workflow-2',
          sessionId: 'session-2',
          agentId: 'agent-2',
          agentUrl: 'http://localhost:9000',
          initialMessageId: 'user-msg-2',
          responseMessageId: 'assistant-msg-2',
        })
      })

      return result
    }

    describe('getWorkflow', () => {
      it('should return workflow by ID', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflow('workflow-1')

        expect(workflow).toBeDefined()
        expect(workflow?.workflowId).toBe('workflow-1')
      })

      it('should return undefined for non-existent ID', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflow('non-existent')

        expect(workflow).toBeUndefined()
      })
    })

    describe('getActiveWorkflow', () => {
      it('should return active workflow', () => {
        const result = setupMultipleWorkflows()

        // workflow-2 is active (last started)
        const workflow = result.current.getActiveWorkflow()

        expect(workflow).toBeDefined()
        expect(workflow?.workflowId).toBe('workflow-2')
      })

      it('should return undefined when no active workflow', () => {
        const { result } = renderHook(() => useWorkflowStore())

        const workflow = result.current.getActiveWorkflow()

        expect(workflow).toBeUndefined()
      })
    })

    describe('getWorkflowByMessageId', () => {
      it('should find workflow by initialMessageId', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflowByMessageId('user-msg-1')

        expect(workflow).toBeDefined()
        expect(workflow?.workflowId).toBe('workflow-1')
      })

      it('should find workflow by responseMessageId', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflowByMessageId('assistant-msg-2')

        expect(workflow).toBeDefined()
        expect(workflow?.workflowId).toBe('workflow-2')
      })

      it('should return undefined for non-existent messageId', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflowByMessageId('non-existent')

        expect(workflow).toBeUndefined()
      })
    })

    describe('getWorkflowBySessionId', () => {
      it('should find workflow by sessionId', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflowBySessionId('session-1')

        expect(workflow).toBeDefined()
        expect(workflow?.workflowId).toBe('workflow-1')
      })

      it('should return undefined for non-existent sessionId', () => {
        const result = setupMultipleWorkflows()

        const workflow = result.current.getWorkflowBySessionId('non-existent')

        expect(workflow).toBeUndefined()
      })
    })

    describe('getRunningWorkflows', () => {
      it('should return workflows with pending status', () => {
        const result = setupMultipleWorkflows()

        const running = result.current.getRunningWorkflows()

        expect(running).toHaveLength(2)
      })

      it('should return workflows with running status', () => {
        const result = setupMultipleWorkflows()

        act(() => {
          result.current.updatePhase('workflow-1', 'executing')
        })

        const running = result.current.getRunningWorkflows()
        const runningIds = running.map(w => w.workflowId)

        expect(runningIds).toContain('workflow-1')
      })

      it('should NOT return completed workflows', () => {
        const result = setupMultipleWorkflows()

        act(() => {
          result.current.completeWorkflow('workflow-1')
        })

        const running = result.current.getRunningWorkflows()
        const runningIds = running.map(w => w.workflowId)

        expect(runningIds).not.toContain('workflow-1')
        expect(runningIds).toContain('workflow-2')
      })

      it('should NOT return errored workflows', () => {
        const result = setupMultipleWorkflows()

        act(() => {
          result.current.errorWorkflow('workflow-1', 'Test error')
        })

        const running = result.current.getRunningWorkflows()
        const runningIds = running.map(w => w.workflowId)

        expect(runningIds).not.toContain('workflow-1')
      })
    })
  })

  describe('message ID correlation', () => {
    it('should preserve initialMessageId through all phase transitions', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'original-user-message',
          responseMessageId: 'assistant-1',
        })
      })

      // Go through all phases
      const phases: WorkflowPhase[] = ['clarification', 'discovery', 'selection', 'preview', 'executing', 'completed']
      phases.forEach(phase => {
        act(() => {
          result.current.updatePhase('test-workflow', phase)
        })
      })

      expect(result.current.workflows['test-workflow'].initialMessageId).toBe('original-user-message')
    })

    it('should preserve responseMessageId through all phase transitions', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'test-workflow',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'original-assistant-message',
        })
      })

      // Go through phases
      act(() => {
        result.current.updatePhase('test-workflow', 'clarification')
        result.current.updatePhase('test-workflow', 'executing')
        result.current.updatePhase('test-workflow', 'completed')
      })

      expect(result.current.workflows['test-workflow'].responseMessageId).toBe('original-assistant-message')
    })
  })

  describe('concurrent workflow handling', () => {
    it('should handle multiple workflows concurrently without state cross-contamination', () => {
      const { result } = renderHook(() => useWorkflowStore())

      // Start 3 workflows
      act(() => {
        result.current.startWorkflow({
          workflowId: 'user-a-workflow',
          sessionId: 'session-a',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-a-msg',
          responseMessageId: 'assistant-a-msg',
        })
        result.current.startWorkflow({
          workflowId: 'user-b-workflow',
          sessionId: 'session-b',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-b-msg',
          responseMessageId: 'assistant-b-msg',
        })
        result.current.startWorkflow({
          workflowId: 'user-c-workflow',
          sessionId: 'session-c',
          agentId: 'agent-2',
          agentUrl: 'http://localhost:9000',
          initialMessageId: 'user-c-msg',
          responseMessageId: 'assistant-c-msg',
        })
      })

      // Update each to different phases
      act(() => {
        result.current.updatePhase('user-a-workflow', 'clarification', {
          clarification: { clarificationId: 'clarif-a' } as any,
        })
        result.current.updatePhase('user-b-workflow', 'executing')
        result.current.updatePhase('user-c-workflow', 'error', undefined, 'Agent crashed')
      })

      // Verify each workflow has correct independent state
      const workflowA = result.current.workflows['user-a-workflow']
      const workflowB = result.current.workflows['user-b-workflow']
      const workflowC = result.current.workflows['user-c-workflow']

      expect(workflowA.phase).toBe('clarification')
      expect(workflowA.phaseData.clarification?.clarificationId).toBe('clarif-a')
      expect(workflowA.sessionId).toBe('session-a')

      expect(workflowB.phase).toBe('executing')
      expect(workflowB.activityStatus).toBe('running')
      expect(workflowB.sessionId).toBe('session-b')

      expect(workflowC.phase).toBe('error')
      expect(workflowC.activityStatus).toBe('error')
      expect(workflowC.phaseHistory[1].reason).toBe('Agent crashed')
      expect(workflowC.sessionId).toBe('session-c')
    })

    it('should correctly track running workflows across different states', () => {
      const { result } = renderHook(() => useWorkflowStore())

      act(() => {
        result.current.startWorkflow({
          workflowId: 'workflow-1',
          sessionId: 'session-1',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })
        result.current.startWorkflow({
          workflowId: 'workflow-2',
          sessionId: 'session-2',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-2',
          responseMessageId: 'assistant-2',
        })
        result.current.startWorkflow({
          workflowId: 'workflow-3',
          sessionId: 'session-3',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-3',
          responseMessageId: 'assistant-3',
        })
        result.current.startWorkflow({
          workflowId: 'workflow-4',
          sessionId: 'session-4',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-4',
          responseMessageId: 'assistant-4',
        })
      })

      // Set different states
      act(() => {
        result.current.updatePhase('workflow-1', 'executing') // running
        result.current.completeWorkflow('workflow-2') // completed
        result.current.errorWorkflow('workflow-3', 'Error') // error
        // workflow-4 stays pending
      })

      const running = result.current.getRunningWorkflows()
      const runningIds = running.map(w => w.workflowId)

      expect(running).toHaveLength(2)
      expect(runningIds).toContain('workflow-1')
      expect(runningIds).toContain('workflow-4')
      expect(runningIds).not.toContain('workflow-2')
      expect(runningIds).not.toContain('workflow-3')
    })
  })
})

describe('Workflow Store Selectors', () => {
  beforeEach(() => {
    resetStore()
  })

  const setupWorkflow = () => {
    const { result } = renderHook(() => useWorkflowStore())
    act(() => {
      result.current.startWorkflow({
        workflowId: 'test-workflow',
        sessionId: 'session-1',
        agentId: 'agent-1',
        agentUrl: 'http://localhost:8000',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })
    })
    return result.current
  }

  describe('selectActiveWorkflow', () => {
    it('should return active workflow', () => {
      setupWorkflow()

      const state = useWorkflowStore.getState()
      const workflow = selectActiveWorkflow(state)

      expect(workflow).toBeDefined()
      expect(workflow?.workflowId).toBe('test-workflow')
    })

    it('should return undefined when no active workflow', () => {
      const state = useWorkflowStore.getState()
      const workflow = selectActiveWorkflow(state)

      expect(workflow).toBeUndefined()
    })
  })

  describe('selectWorkflowProgress', () => {
    it('should return progress for workflow', () => {
      const store = setupWorkflow()

      act(() => {
        store.updateProgress('test-workflow', { current: 5, total: 10 })
      })

      const state = useWorkflowStore.getState()
      const progress = selectWorkflowProgress('test-workflow')(state)

      expect(progress?.current).toBe(5)
      expect(progress?.total).toBe(10)
    })

    it('should return undefined for non-existent workflow', () => {
      const state = useWorkflowStore.getState()
      const progress = selectWorkflowProgress('non-existent')(state)

      expect(progress).toBeUndefined()
    })
  })

  describe('selectWorkflowPhase', () => {
    it('should return phase for workflow', () => {
      const store = setupWorkflow()

      act(() => {
        store.updatePhase('test-workflow', 'clarification')
      })

      const state = useWorkflowStore.getState()
      const phase = selectWorkflowPhase('test-workflow')(state)

      expect(phase).toBe('clarification')
    })

    it('should return undefined for non-existent workflow', () => {
      const state = useWorkflowStore.getState()
      const phase = selectWorkflowPhase('non-existent')(state)

      expect(phase).toBeUndefined()
    })
  })

  describe('selectWorkflowPhaseData', () => {
    it('should return phase data for workflow', () => {
      const store = setupWorkflow()

      act(() => {
        store.updatePhase('test-workflow', 'clarification', {
          clarification: { clarificationId: 'test-clarif' } as any,
        })
      })

      const state = useWorkflowStore.getState()
      const phaseData = selectWorkflowPhaseData('test-workflow')(state)

      expect(phaseData?.clarification?.clarificationId).toBe('test-clarif')
    })
  })

  describe('selectRunningWorkflows', () => {
    it('should return only running/pending workflows', () => {
      const store = setupWorkflow()

      act(() => {
        store.startWorkflow({
          workflowId: 'workflow-2',
          sessionId: 'session-2',
          agentId: 'agent-1',
          agentUrl: 'http://localhost:8000',
          initialMessageId: 'user-2',
          responseMessageId: 'assistant-2',
        })
        store.completeWorkflow('test-workflow')
      })

      const state = useWorkflowStore.getState()
      const running = selectRunningWorkflows(state)

      expect(running).toHaveLength(1)
      expect(running[0].workflowId).toBe('workflow-2')
    })
  })

  describe('selectResponseMessageId', () => {
    it('should return responseMessageId for workflow', () => {
      setupWorkflow()

      const state = useWorkflowStore.getState()
      const messageId = selectResponseMessageId('test-workflow')(state)

      expect(messageId).toBe('assistant-1')
    })

    it('should return undefined for non-existent workflow', () => {
      const state = useWorkflowStore.getState()
      const messageId = selectResponseMessageId('non-existent')(state)

      expect(messageId).toBeUndefined()
    })
  })
})

describe('Full Workflow Integration Scenario', () => {
  beforeEach(() => {
    resetStore()
  })

  it('should simulate complete multi-phase agent workflow', () => {
    const { result } = renderHook(() => useWorkflowStore())

    // 1. User sends message, workflow starts
    act(() => {
      result.current.startWorkflow({
        workflowId: 'reddit-analysis-workflow',
        sessionId: 'user-session-123',
        agentId: 'reddit-agent',
        agentUrl: 'http://localhost:8000',
        initialMessageId: 'user-message-abc',
        responseMessageId: 'assistant-message-xyz',
      })
    })

    expect(result.current.workflows['reddit-analysis-workflow'].phase).toBe('initial')
    expect(result.current.activeWorkflowId).toBe('reddit-analysis-workflow')

    // 2. Agent requests clarification
    act(() => {
      result.current.updatePhase('reddit-analysis-workflow', 'clarification', {
        clarification: {
          type: 'clarification_needed',
          clarificationId: 'clarif-001',
          agentId: 'reddit-agent',
          questions: [
            {
              questionId: 'q-topic',
              questionType: 'single_choice',
              question: 'What topic are you interested in?',
              options: [
                { id: 'tech', label: 'Technology' },
                { id: 'gaming', label: 'Gaming' },
              ],
            },
          ],
          timeoutMs: 300000,
        },
      })
    })

    expect(result.current.workflows['reddit-analysis-workflow'].phase).toBe('clarification')
    expect(result.current.workflows['reddit-analysis-workflow'].phaseData.clarification).toBeDefined()

    // 3. User responds, agent proceeds to discovery
    act(() => {
      result.current.updatePhase('reddit-analysis-workflow', 'discovery', {
        discovery: {
          discoveryId: 'disc-001',
          items: [
            { id: 'sub-1', name: 'r/technology' },
            { id: 'sub-2', name: 'r/programming' },
          ],
        },
      })
    })

    expect(result.current.workflows['reddit-analysis-workflow'].phase).toBe('discovery')

    // 4. Agent requests selection
    act(() => {
      result.current.updatePhase('reddit-analysis-workflow', 'selection', {
        selection: {
          selectionId: 'sel-001',
          items: [
            { id: 'sub-1', name: 'r/technology' },
            { id: 'sub-2', name: 'r/programming' },
          ],
        },
      })
    })

    expect(result.current.workflows['reddit-analysis-workflow'].phase).toBe('selection')

    // 5. User selects, agent shows preview
    act(() => {
      result.current.updatePhase('reddit-analysis-workflow', 'preview', {
        preview: {
          type: 'search_plan',
          planId: 'plan-001',
          agentId: 'reddit-agent',
          userIntent: 'Analyze technology discussions',
          searchKeywords: ['AI', 'machine learning'],
          message: 'Ready to analyze selected subreddits',
        },
      })
    })

    expect(result.current.workflows['reddit-analysis-workflow'].phase).toBe('preview')

    // 6. User approves, agent starts executing
    act(() => {
      result.current.updatePhase('reddit-analysis-workflow', 'executing')
    })

    expect(result.current.workflows['reddit-analysis-workflow'].phase).toBe('executing')
    expect(result.current.workflows['reddit-analysis-workflow'].activityStatus).toBe('running')

    // 7. Progress updates during execution
    act(() => {
      result.current.updateProgress('reddit-analysis-workflow', {
        current: 25,
        total: 100,
        message: 'Fetching posts...',
        percentage: 25,
      })
    })

    act(() => {
      result.current.updateProgress('reddit-analysis-workflow', {
        current: 75,
        message: 'Analyzing sentiment...',
        percentage: 75,
      })
    })

    // 8. Execution completes
    act(() => {
      result.current.completeWorkflow('reddit-analysis-workflow')
    })

    const finalWorkflow = result.current.workflows['reddit-analysis-workflow']

    expect(finalWorkflow.phase).toBe('completed')
    expect(finalWorkflow.activityStatus).toBe('completed')
    expect(finalWorkflow.completedAt).toBeDefined()

    // Verify all message correlations preserved
    expect(finalWorkflow.initialMessageId).toBe('user-message-abc')
    expect(finalWorkflow.responseMessageId).toBe('assistant-message-xyz')

    // Verify complete phase history
    expect(finalWorkflow.phaseHistory).toHaveLength(7)
    const phases = finalWorkflow.phaseHistory.map(h => h.phase)
    expect(phases).toEqual([
      'initial',
      'clarification',
      'discovery',
      'selection',
      'preview',
      'executing',
      'completed',
    ])

    // Verify all phase data preserved
    expect(finalWorkflow.phaseData.clarification).toBeDefined()
    expect(finalWorkflow.phaseData.discovery).toBeDefined()
    expect(finalWorkflow.phaseData.selection).toBeDefined()
    expect(finalWorkflow.phaseData.preview).toBeDefined()
  })

  it('should handle workflow error recovery scenario', () => {
    const { result } = renderHook(() => useWorkflowStore())

    // Start workflow
    act(() => {
      result.current.startWorkflow({
        workflowId: 'error-test-workflow',
        sessionId: 'session-1',
        agentId: 'test-agent',
        agentUrl: 'http://localhost:8000',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })
    })

    // Progress to executing phase
    act(() => {
      result.current.updatePhase('error-test-workflow', 'clarification')
      result.current.updatePhase('error-test-workflow', 'executing')
    })

    // Error occurs during execution
    act(() => {
      result.current.errorWorkflow('error-test-workflow', 'Agent connection lost after 30 seconds')
    })

    const erroredWorkflow = result.current.workflows['error-test-workflow']

    expect(erroredWorkflow.phase).toBe('error')
    expect(erroredWorkflow.activityStatus).toBe('error')
    expect(erroredWorkflow.error).toBe('Agent connection lost after 30 seconds')

    // Verify error is in phase history
    const lastTransition = erroredWorkflow.phaseHistory[erroredWorkflow.phaseHistory.length - 1]
    expect(lastTransition.phase).toBe('error')
    expect(lastTransition.previousPhase).toBe('executing')
  })
})
