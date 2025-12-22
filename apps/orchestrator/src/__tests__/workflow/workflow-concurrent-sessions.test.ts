/**
 * Workflow Concurrent Sessions E2E Tests
 *
 * Tests session isolation and concurrent workflow handling:
 * - Multiple simultaneous workflows
 * - Event isolation between sessions
 * - No state cross-contamination
 * - Rapid concurrent updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  TestAgent,
  createTestContext,
  collectSSEEvents,
  sendA2AMessage,
  sendClarificationResponse,
  getUniquePort,
  type TestContext,
} from './test-utils'
import { WorkflowSessionStore } from '../../services/workflow-session'
import type { WorkflowPhase } from '@pixell/protocols'

describe('Workflow Concurrent Sessions E2E', () => {
  let ctx: TestContext
  let port: number

  beforeAll(async () => {
    port = getUniquePort()
    ctx = await createTestContext({
      port,
      scenario: 'full_plan_mode',
      delayMs: 20,
    })
  }, 30000)

  afterAll(async () => {
    await ctx.cleanup()
  })

  beforeEach(async () => {
    await ctx.agent.reset()
    await ctx.store.clear()
  })

  describe('multiple concurrent workflows', () => {
    it('should maintain separate state for each workflow', async () => {
      // Create 5 concurrent workflows
      const workflows = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          ctx.store.createWorkflow({
            sessionId: `concurrent-session-${i}`,
            agentId: 'test-agent',
            agentUrl: ctx.agent.url,
            initialMessageId: `user-msg-${i}`,
            responseMessageId: `assistant-msg-${i}`,
          })
        )
      )

      // Each should have unique workflowId
      const workflowIds = workflows.map((w) => w.workflowId)
      const uniqueIds = new Set(workflowIds)
      expect(uniqueIds.size).toBe(5)

      // Each should start in initial phase
      for (const workflow of workflows) {
        expect(workflow.phase).toBe('initial')
        expect(workflow.activityStatus).toBe('pending')
      }
    })

    it('should isolate phase transitions between workflows', async () => {
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'isolate-1',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'isolate-2',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-2',
        responseMessageId: 'assistant-2',
      })

      // Update workflow1 to clarification
      await ctx.store.updatePhase(workflow1.workflowId, 'clarification')

      // Update workflow2 to executing
      await ctx.store.updatePhase(workflow2.workflowId, 'executing')

      // Verify each has correct independent state
      const w1 = await ctx.store.get(workflow1.workflowId)
      const w2 = await ctx.store.get(workflow2.workflowId)

      expect(w1?.phase).toBe('clarification')
      expect(w1?.activityStatus).toBe('pending')

      expect(w2?.phase).toBe('executing')
      expect(w2?.activityStatus).toBe('running')
    })

    it('should isolate phase data between workflows', async () => {
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'data-isolate-1',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'data-isolate-2',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-2',
        responseMessageId: 'assistant-2',
      })

      // Add clarification data to workflow1
      await ctx.store.updatePhase(workflow1.workflowId, 'clarification', {
        clarification: {
          clarificationId: 'clarif-for-w1',
          questions: [{ questionId: 'q1' }],
        } as any,
      })

      // Add different clarification data to workflow2
      await ctx.store.updatePhase(workflow2.workflowId, 'clarification', {
        clarification: {
          clarificationId: 'clarif-for-w2',
          questions: [{ questionId: 'q2' }],
        } as any,
      })

      const w1 = await ctx.store.get(workflow1.workflowId)
      const w2 = await ctx.store.get(workflow2.workflowId)

      expect(w1?.phaseData.clarification?.clarificationId).toBe('clarif-for-w1')
      expect(w2?.phaseData.clarification?.clarificationId).toBe('clarif-for-w2')
    })
  })

  describe('rapid concurrent updates', () => {
    it('should handle rapid sequential updates to different workflows', async () => {
      // Create 10 workflows
      const workflows = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          ctx.store.createWorkflow({
            sessionId: `rapid-${i}`,
            agentId: 'test-agent',
            agentUrl: ctx.agent.url,
            initialMessageId: `user-${i}`,
            responseMessageId: `assistant-${i}`,
          })
        )
      )

      // Rapidly update all workflows in parallel
      await Promise.all(
        workflows.map((w, i) => {
          // Each workflow gets a different phase based on index
          const phases: WorkflowPhase[] = [
            'clarification',
            'discovery',
            'selection',
            'preview',
            'executing',
          ]
          return ctx.store.updatePhase(w.workflowId, phases[i % phases.length])
        })
      )

      // Verify each has correct phase
      for (let i = 0; i < workflows.length; i++) {
        const phases: WorkflowPhase[] = [
          'clarification',
          'discovery',
          'selection',
          'preview',
          'executing',
        ]
        const expected = phases[i % phases.length]

        const w = await ctx.store.get(workflows[i].workflowId)
        expect(w?.phase).toBe(expected)
      }
    })

    it('should handle rapid progress updates without data loss', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'rapid-progress',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      // Rapid sequential progress updates
      for (let i = 0; i <= 100; i++) {
        await ctx.store.updateProgress(workflow.workflowId, {
          current: i,
          total: 100,
          percentage: i,
          message: `Step ${i} of 100`,
        })
      }

      const final = await ctx.store.get(workflow.workflowId)
      expect(final?.progress.current).toBe(100)
      expect(final?.progress.percentage).toBe(100)
      expect(final?.progress.message).toBe('Step 100 of 100')
    })

    it('should handle concurrent phase transitions without corruption', async () => {
      // Create workflows
      const workflows = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          ctx.store.createWorkflow({
            sessionId: `concurrent-transition-${i}`,
            agentId: 'test-agent',
            agentUrl: ctx.agent.url,
            initialMessageId: `user-${i}`,
            responseMessageId: `assistant-${i}`,
          })
        )
      )

      // Concurrently transition all workflows through multiple phases
      const transitionPromises = workflows.map(async (w) => {
        await ctx.store.updatePhase(w.workflowId, 'clarification')
        await ctx.store.updatePhase(w.workflowId, 'discovery')
        await ctx.store.updatePhase(w.workflowId, 'selection')
        await ctx.store.updatePhase(w.workflowId, 'preview')
        await ctx.store.updatePhase(w.workflowId, 'executing')
        await ctx.store.updatePhase(w.workflowId, 'completed')
      })

      await Promise.all(transitionPromises)

      // All should be completed with correct history
      for (const workflow of workflows) {
        const w = await ctx.store.get(workflow.workflowId)
        expect(w?.phase).toBe('completed')
        expect(w?.activityStatus).toBe('completed')
        expect(w?.phaseHistory).toHaveLength(7)
      }
    })
  })

  describe('active workflow queries', () => {
    it('should return only running/pending workflows', async () => {
      // Create workflows in different states
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'active-query-1',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u1',
        responseMessageId: 'a1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'active-query-2',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u2',
        responseMessageId: 'a2',
      })

      const workflow3 = await ctx.store.createWorkflow({
        sessionId: 'active-query-3',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u3',
        responseMessageId: 'a3',
      })

      const workflow4 = await ctx.store.createWorkflow({
        sessionId: 'active-query-4',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u4',
        responseMessageId: 'a4',
      })

      // Set different states
      await ctx.store.updatePhase(workflow1.workflowId, 'executing') // running
      await ctx.store.complete(workflow2.workflowId) // completed
      await ctx.store.error(workflow3.workflowId, 'Error') // error
      // workflow4 stays pending

      const active = await ctx.store.getActiveWorkflows()
      const activeIds = active.map((w) => w.workflowId)

      expect(activeIds).toContain(workflow1.workflowId) // running
      expect(activeIds).toContain(workflow4.workflowId) // pending
      expect(activeIds).not.toContain(workflow2.workflowId) // completed
      expect(activeIds).not.toContain(workflow3.workflowId) // error
    })

    it('should handle large number of concurrent active workflows', async () => {
      // Create 50 workflows
      const workflows = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          ctx.store.createWorkflow({
            sessionId: `large-concurrent-${i}`,
            agentId: 'test-agent',
            agentUrl: ctx.agent.url,
            initialMessageId: `user-${i}`,
            responseMessageId: `assistant-${i}`,
          })
        )
      )

      // Half stay pending, half go to executing
      await Promise.all(
        workflows.slice(25).map((w) => ctx.store.updatePhase(w.workflowId, 'executing'))
      )

      const active = await ctx.store.getActiveWorkflows()

      // All 50 should be active (25 pending + 25 running)
      expect(active.length).toBe(50)

      // Complete half
      await Promise.all(workflows.slice(0, 25).map((w) => ctx.store.complete(w.workflowId)))

      const activeAfter = await ctx.store.getActiveWorkflows()

      // Only 25 should be active now (the executing ones)
      expect(activeAfter.length).toBe(25)
    })
  })

  describe('session ID uniqueness', () => {
    it('should find correct workflow by sessionId', async () => {
      const workflows = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          ctx.store.createWorkflow({
            sessionId: `unique-session-${i}`,
            agentId: 'test-agent',
            agentUrl: ctx.agent.url,
            initialMessageId: `user-${i}`,
            responseMessageId: `assistant-${i}`,
          })
        )
      )

      // Find each by sessionId
      for (let i = 0; i < 10; i++) {
        const found = await ctx.store.getBySessionId(`unique-session-${i}`)
        expect(found).toBeDefined()
        expect(found?.workflowId).toBe(workflows[i].workflowId)
      }
    })

    it('should not return wrong workflow for similar sessionIds', async () => {
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'session-123',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u1',
        responseMessageId: 'a1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'session-1234',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u2',
        responseMessageId: 'a2',
      })

      const found1 = await ctx.store.getBySessionId('session-123')
      const found2 = await ctx.store.getBySessionId('session-1234')

      expect(found1?.workflowId).toBe(workflow1.workflowId)
      expect(found2?.workflowId).toBe(workflow2.workflowId)
      expect(found1?.workflowId).not.toBe(found2?.workflowId)
    })
  })

  describe('workflow deletion', () => {
    it('should delete workflow without affecting others', async () => {
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'delete-test-1',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u1',
        responseMessageId: 'a1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'delete-test-2',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u2',
        responseMessageId: 'a2',
      })

      // Delete workflow1
      await ctx.store.delete(workflow1.workflowId)

      // workflow1 should be gone
      const found1 = await ctx.store.get(workflow1.workflowId)
      expect(found1).toBeNull()

      // workflow2 should still exist
      const found2 = await ctx.store.get(workflow2.workflowId)
      expect(found2).toBeDefined()
      expect(found2?.workflowId).toBe(workflow2.workflowId)
    })

    it('should handle deletion during concurrent operations', async () => {
      const workflows = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          ctx.store.createWorkflow({
            sessionId: `concurrent-delete-${i}`,
            agentId: 'test-agent',
            agentUrl: ctx.agent.url,
            initialMessageId: `user-${i}`,
            responseMessageId: `assistant-${i}`,
          })
        )
      )

      // Concurrently update and delete
      await Promise.all([
        // Update half
        ...workflows.slice(0, 5).map((w) =>
          ctx.store.updatePhase(w.workflowId, 'clarification')
        ),
        // Delete other half
        ...workflows.slice(5).map((w) => ctx.store.delete(w.workflowId)),
      ])

      // First 5 should exist and be in clarification
      for (let i = 0; i < 5; i++) {
        const w = await ctx.store.get(workflows[i].workflowId)
        expect(w).toBeDefined()
        expect(w?.phase).toBe('clarification')
      }

      // Last 5 should be deleted
      for (let i = 5; i < 10; i++) {
        const w = await ctx.store.get(workflows[i].workflowId)
        expect(w).toBeNull()
      }
    })
  })

  describe('user workflow simulation', () => {
    it('should simulate multiple users with independent workflows', async () => {
      // Simulate 3 users starting workflows
      const userA = await ctx.store.createWorkflow({
        sessionId: 'user-a-session',
        agentId: 'reddit-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-a-msg',
        responseMessageId: 'assistant-a-msg',
      })

      const userB = await ctx.store.createWorkflow({
        sessionId: 'user-b-session',
        agentId: 'reddit-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-b-msg',
        responseMessageId: 'assistant-b-msg',
      })

      const userC = await ctx.store.createWorkflow({
        sessionId: 'user-c-session',
        agentId: 'tiktok-agent',
        agentUrl: 'http://localhost:9998',
        initialMessageId: 'user-c-msg',
        responseMessageId: 'assistant-c-msg',
      })

      // User A goes through clarification
      await ctx.store.updatePhase(userA.workflowId, 'clarification', {
        clarification: { clarificationId: 'clarif-a' } as any,
      })

      // User B goes directly to executing (no plan mode)
      await ctx.store.updatePhase(userB.workflowId, 'executing')

      // User C errors out
      await ctx.store.error(userC.workflowId, 'TikTok agent unavailable')

      // Verify each user's workflow state
      const wA = await ctx.store.get(userA.workflowId)
      const wB = await ctx.store.get(userB.workflowId)
      const wC = await ctx.store.get(userC.workflowId)

      expect(wA?.phase).toBe('clarification')
      expect(wA?.agentId).toBe('reddit-agent')
      expect(wA?.phaseData.clarification?.clarificationId).toBe('clarif-a')

      expect(wB?.phase).toBe('executing')
      expect(wB?.activityStatus).toBe('running')

      expect(wC?.phase).toBe('error')
      expect(wC?.error).toBe('TikTok agent unavailable')
      expect(wC?.agentUrl).toBe('http://localhost:9998')
    })
  })
})
