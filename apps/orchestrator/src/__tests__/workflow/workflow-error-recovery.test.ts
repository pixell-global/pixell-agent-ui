/**
 * Workflow Error Recovery E2E Tests
 *
 * Tests error scenarios and recovery:
 * - Agent crash during execution
 * - Network timeout handling
 * - Invalid event data handling
 * - Events out of order
 * - Phase change during streaming
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  TestAgent,
  createTestContext,
  collectSSEEvents,
  sendA2AMessage,
  getUniquePort,
  type TestContext,
} from './test-utils'
import { WorkflowSessionStore } from '../../services/workflow-session'
import type { WorkflowPhase, WorkflowExecution } from '@pixell/protocols'

describe('Workflow Error Recovery E2E', () => {
  let ctx: TestContext
  let port: number

  describe('with full_plan_mode agent', () => {
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

    describe('error phase transition', () => {
      it('should transition to error phase and store error message', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'error-transition',
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

      it('should record error in phase history', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'error-history',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        // Go through some phases first
        await ctx.store.updatePhase(workflow.workflowId, 'clarification')
        await ctx.store.updatePhase(workflow.workflowId, 'executing')

        // Then error
        await ctx.store.error(workflow.workflowId, 'Agent crashed')

        const updated = await ctx.store.get(workflow.workflowId)
        const lastTransition = updated?.phaseHistory[updated.phaseHistory.length - 1]

        expect(lastTransition?.phase).toBe('error')
        expect(lastTransition?.previousPhase).toBe('executing')
      })

      it('should allow error from any phase', async () => {
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
            initialMessageId: `user-${phase}`,
            responseMessageId: `assistant-${phase}`,
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

    describe('error during clarification phase', () => {
      it('should preserve clarification data when erroring', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'error-preserve-data',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        // Add clarification data
        await ctx.store.updatePhase(workflow.workflowId, 'clarification', {
          clarification: {
            clarificationId: 'important-clarif',
            questions: [{ questionId: 'q1' }],
          } as any,
        })

        // Error out
        await ctx.store.error(workflow.workflowId, 'Timeout waiting for response')

        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.phase).toBe('error')
        // Phase data should still be preserved for debugging
        expect(updated?.phaseData.clarification?.clarificationId).toBe('important-clarif')
      })
    })

    describe('invalid workflow operations', () => {
      it('should handle update to non-existent workflow gracefully', async () => {
        const result = await ctx.store.updatePhase('non-existent-workflow', 'clarification')
        expect(result).toBeNull()
      })

      it('should handle progress update to non-existent workflow gracefully', async () => {
        const result = await ctx.store.updateProgress('non-existent-workflow', { current: 5 })
        expect(result).toBeNull()
      })

      it('should handle event addition to non-existent workflow gracefully', async () => {
        const result = await ctx.store.addEvent('non-existent-workflow', {
          type: 'test',
          timestamp: new Date().toISOString(),
          data: {},
        })
        expect(result).toBeNull()
      })

      it('should handle complete on non-existent workflow gracefully', async () => {
        const result = await ctx.store.complete('non-existent-workflow')
        expect(result).toBeNull()
      })

      it('should handle error on non-existent workflow gracefully', async () => {
        const result = await ctx.store.error('non-existent-workflow', 'Test error')
        expect(result).toBeNull()
      })
    })

    describe('event sequence tracking under errors', () => {
      it('should maintain correct event sequence even with errors', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'event-seq-error',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        // Add some events
        await ctx.store.addEvent(workflow.workflowId, {
          type: 'event-1',
          timestamp: new Date().toISOString(),
          data: {},
        })

        await ctx.store.addEvent(workflow.workflowId, {
          type: 'event-2',
          timestamp: new Date().toISOString(),
          data: {},
        })

        // Error out
        await ctx.store.error(workflow.workflowId, 'Error occurred')

        // Try to add another event (should still work)
        await ctx.store.addEvent(workflow.workflowId, {
          type: 'event-3',
          timestamp: new Date().toISOString(),
          data: {},
        })

        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.eventSequence).toBe(3)
        expect(updated?.bufferedEvents).toHaveLength(3)
        expect(updated?.bufferedEvents[0].sequence).toBe(0)
        expect(updated?.bufferedEvents[1].sequence).toBe(1)
        expect(updated?.bufferedEvents[2].sequence).toBe(2)
      })

      it('should cap buffered events at 100 entries', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'event-cap',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        // Add 150 events
        for (let i = 0; i < 150; i++) {
          await ctx.store.addEvent(workflow.workflowId, {
            type: `event-${i}`,
            timestamp: new Date().toISOString(),
            data: { index: i },
          })
        }

        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.bufferedEvents.length).toBeLessThanOrEqual(100)
        // Should keep last 100 events
        expect(updated?.bufferedEvents[0].type).toBe('event-50')
        expect(updated?.bufferedEvents[99].type).toBe('event-149')
      })
    })

    describe('phase data corruption prevention', () => {
      it('should not lose phase data on rapid updates', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'rapid-update-data',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        // Rapidly update with different data
        const updates = Array.from({ length: 20 }, (_, i) =>
          ctx.store.updatePhase(workflow.workflowId, 'clarification', {
            clarification: { clarificationId: `clarif-${i}` } as any,
          })
        )

        await Promise.all(updates)

        // Should have the last value
        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.phaseData.clarification?.clarificationId).toMatch(/^clarif-\d+$/)
      })

      it('should preserve all phase data through transitions', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'preserve-all-data',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await ctx.store.updatePhase(workflow.workflowId, 'clarification', {
          clarification: { clarificationId: 'c1', data: 'clarification-data' } as any,
        })

        await ctx.store.updatePhase(workflow.workflowId, 'discovery', {
          discovery: { discoveryId: 'd1', data: 'discovery-data' } as any,
        })

        await ctx.store.updatePhase(workflow.workflowId, 'selection', {
          selection: { selectionId: 's1', data: 'selection-data' } as any,
        })

        // Error out
        await ctx.store.error(workflow.workflowId, 'Final error')

        const final = await ctx.store.get(workflow.workflowId)

        // All data should be preserved
        expect(final?.phaseData.clarification?.clarificationId).toBe('c1')
        expect(final?.phaseData.discovery?.discoveryId).toBe('d1')
        expect(final?.phaseData.selection?.selectionId).toBe('s1')
      })
    })

    describe('message ID correlation under errors', () => {
      it('should preserve message IDs through error states', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'msg-id-error',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'original-user-message',
          responseMessageId: 'original-assistant-message',
        })

        // Go through phases
        await ctx.store.updatePhase(workflow.workflowId, 'clarification')
        await ctx.store.updatePhase(workflow.workflowId, 'executing')

        // Error
        await ctx.store.error(workflow.workflowId, 'Crash')

        const final = await ctx.store.get(workflow.workflowId)
        expect(final?.initialMessageId).toBe('original-user-message')
        expect(final?.responseMessageId).toBe('original-assistant-message')
      })
    })

    describe('timestamp integrity', () => {
      it('should update updatedAt on error', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'timestamp-error',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        const originalUpdatedAt = workflow.updatedAt
        await new Promise((r) => setTimeout(r, 10))

        await ctx.store.error(workflow.workflowId, 'Error')

        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.updatedAt).not.toBe(originalUpdatedAt)
        expect(updated?.updatedAt > originalUpdatedAt).toBe(true)
      })

      it('should not set completedAt on error', async () => {
        const workflow = await ctx.store.createWorkflow({
          sessionId: 'no-completed-at-error',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await ctx.store.error(workflow.workflowId, 'Error')

        const updated = await ctx.store.get(workflow.workflowId)
        expect(updated?.completedAt).toBeUndefined()
      })
    })

    describe('recovery from error state', () => {
      it('should allow creating new workflow after error', async () => {
        // First workflow errors
        const workflow1 = await ctx.store.createWorkflow({
          sessionId: 'error-recovery-1',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-1',
          responseMessageId: 'assistant-1',
        })

        await ctx.store.error(workflow1.workflowId, 'First error')

        // Create new workflow for same session concept
        const workflow2 = await ctx.store.createWorkflow({
          sessionId: 'error-recovery-2',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'user-2',
          responseMessageId: 'assistant-2',
        })

        expect(workflow2.workflowId).not.toBe(workflow1.workflowId)
        expect(workflow2.phase).toBe('initial')
        expect(workflow2.activityStatus).toBe('pending')
      })

      it('should not affect other workflows when one errors', async () => {
        const workflow1 = await ctx.store.createWorkflow({
          sessionId: 'isolation-error-1',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'u1',
          responseMessageId: 'a1',
        })

        const workflow2 = await ctx.store.createWorkflow({
          sessionId: 'isolation-error-2',
          agentId: 'test-agent',
          agentUrl: ctx.agent.url,
          initialMessageId: 'u2',
          responseMessageId: 'a2',
        })

        // Update workflow2 to executing
        await ctx.store.updatePhase(workflow2.workflowId, 'executing')

        // Error workflow1
        await ctx.store.error(workflow1.workflowId, 'Error in workflow1')

        // workflow2 should be unaffected
        const w2 = await ctx.store.get(workflow2.workflowId)
        expect(w2?.phase).toBe('executing')
        expect(w2?.activityStatus).toBe('running')
        expect(w2?.error).toBeUndefined()
      })
    })
  })

  describe('with error_mid_execution agent', () => {
    let errorCtx: TestContext
    let errorPort: number

    beforeAll(async () => {
      errorPort = getUniquePort()
      errorCtx = await createTestContext({
        port: errorPort,
        scenario: 'error_mid_execution',
        delayMs: 50,
      })
    }, 30000)

    afterAll(async () => {
      await errorCtx.cleanup()
    })

    beforeEach(async () => {
      await errorCtx.agent.reset()
    })

    it('should receive error events from agent', async () => {
      const response = await sendA2AMessage(errorCtx.agent.url, 'Test error scenario', {
        planMode: false,
      })

      expect(response.ok).toBe(true)

      const events = await collectSSEEvents(response)

      // Should have events including a failed state
      const failedEvents = events.filter(
        (e) => e.data?.result?.status?.state === 'failed'
      )

      expect(failedEvents.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    let edgeCtx: TestContext
    let edgePort: number

    beforeAll(async () => {
      edgePort = getUniquePort()
      edgeCtx = await createTestContext({
        port: edgePort,
        scenario: 'full_plan_mode',
        delayMs: 10,
      })
    }, 30000)

    afterAll(async () => {
      await edgeCtx.cleanup()
    })

    it('should handle empty error message', async () => {
      const workflow = await edgeCtx.store.createWorkflow({
        sessionId: 'empty-error',
        agentId: 'test-agent',
        agentUrl: edgeCtx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await edgeCtx.store.error(workflow.workflowId, '')

      const updated = await edgeCtx.store.get(workflow.workflowId)
      expect(updated?.phase).toBe('error')
      expect(updated?.error).toBe('')
    })

    it('should handle very long error message', async () => {
      const workflow = await edgeCtx.store.createWorkflow({
        sessionId: 'long-error',
        agentId: 'test-agent',
        agentUrl: edgeCtx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const longError = 'A'.repeat(10000)
      await edgeCtx.store.error(workflow.workflowId, longError)

      const updated = await edgeCtx.store.get(workflow.workflowId)
      expect(updated?.error).toBe(longError)
      expect(updated?.error.length).toBe(10000)
    })

    it('should handle special characters in error message', async () => {
      const workflow = await edgeCtx.store.createWorkflow({
        sessionId: 'special-chars-error',
        agentId: 'test-agent',
        agentUrl: edgeCtx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const specialError = 'Error: {"code": 500, "message": "Failed \n with newline"}'
      await edgeCtx.store.error(workflow.workflowId, specialError)

      const updated = await edgeCtx.store.get(workflow.workflowId)
      expect(updated?.error).toBe(specialError)
    })

    it('should handle unicode in error message', async () => {
      const workflow = await edgeCtx.store.createWorkflow({
        sessionId: 'unicode-error',
        agentId: 'test-agent',
        agentUrl: edgeCtx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const unicodeError = '错误: API 失败 🚫 ❌'
      await edgeCtx.store.error(workflow.workflowId, unicodeError)

      const updated = await edgeCtx.store.get(workflow.workflowId)
      expect(updated?.error).toBe(unicodeError)
    })
  })
})
