/**
 * Workflow Correlation E2E Tests
 *
 * Tests workflowId propagation across all layers:
 * - Orchestrator creates workflowId
 * - workflowId is passed to agent
 * - All SSE events include workflowId
 * - Message IDs are correctly correlated
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  TestAgent,
  createTestContext,
  collectSSEEvents,
  extractWorkflowId,
  extractSessionId,
  findEventByType,
  filterEventsByType,
  assertHasEventType,
  assertAllEventsHaveWorkflowId,
  sendA2AMessage,
  sendClarificationResponse,
  getUniquePort,
  type TestContext,
} from './test-utils'
import { WorkflowSessionStore } from '../../services/workflow-session'

describe('Workflow Correlation E2E', () => {
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

  describe('workflowId creation', () => {
    it('should create workflow with valid UUID workflowId', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'test-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-msg-1',
        responseMessageId: 'assistant-msg-1',
      })

      expect(workflow.workflowId).toBeDefined()
      expect(workflow.workflowId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('should initialize workflow in "initial" phase', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'test-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-msg-1',
        responseMessageId: 'assistant-msg-1',
      })

      expect(workflow.phase).toBe('initial')
      expect(workflow.activityStatus).toBe('pending')
    })

    it('should create unique workflowIds for different sessions', async () => {
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'session-1',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'session-2',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-2',
        responseMessageId: 'assistant-2',
      })

      expect(workflow1.workflowId).not.toBe(workflow2.workflowId)
    })
  })

  describe('workflowId in agent communication', () => {
    it('should pass workflowId to agent in message/stream request', async () => {
      // Create workflow first
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'test-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-msg-1',
        responseMessageId: 'assistant-msg-1',
      })

      // Send message with workflowId
      const response = await sendA2AMessage(ctx.agent.url, 'Test message', {
        sessionId: 'test-session',
        workflowId: workflow.workflowId,
        planMode: true,
      })

      expect(response.ok).toBe(true)

      // Agent should acknowledge the workflowId in events
      const events = await collectSSEEvents(response)
      expect(events.length).toBeGreaterThan(0)
    })

    it('should include workflowId in clarification_needed events', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'clarif-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-msg-1',
        responseMessageId: 'assistant-msg-1',
      })

      const response = await sendA2AMessage(ctx.agent.url, 'Analyze reddit posts', {
        sessionId: 'clarif-session',
        workflowId: workflow.workflowId,
        planMode: true,
      })

      const events = await collectSSEEvents(response)

      // Find clarification_needed event
      const clarificationEvents = filterEventsByType(events, 'clarification_needed')

      // The test agent returns clarification in status-update format
      const inputRequiredEvents = events.filter(
        (e) =>
          e.data?.result?.status?.state === 'input-required' &&
          e.data?.result?.status?.message?.parts?.some(
            (p: any) => p.data?.type === 'clarification_needed'
          )
      )

      expect(inputRequiredEvents.length).toBeGreaterThan(0)

      // Extract clarification data
      const clarificationPart = inputRequiredEvents[0].data.result.status.message.parts.find(
        (p: any) => p.data?.type === 'clarification_needed'
      )

      expect(clarificationPart.data.workflowId).toBe(workflow.workflowId)
    })
  })

  describe('message ID correlation', () => {
    it('should preserve initialMessageId through workflow lifecycle', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'msg-correlation-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'original-user-message-id',
        responseMessageId: 'original-assistant-message-id',
      })

      // Update phase multiple times
      await ctx.store.updatePhase(workflow.workflowId, 'clarification')
      await ctx.store.updatePhase(workflow.workflowId, 'discovery')
      await ctx.store.updatePhase(workflow.workflowId, 'selection')

      // Verify message IDs preserved
      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.initialMessageId).toBe('original-user-message-id')
      expect(updated?.responseMessageId).toBe('original-assistant-message-id')
    })

    it('should preserve responseMessageId for content delivery', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'response-msg-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-msg',
        responseMessageId: 'assistant-response-target',
      })

      // Complete the workflow
      await ctx.store.updatePhase(workflow.workflowId, 'executing')
      await ctx.store.updatePhase(workflow.workflowId, 'completed')

      const completed = await ctx.store.get(workflow.workflowId)
      expect(completed?.responseMessageId).toBe('assistant-response-target')
    })
  })

  describe('workflow lookup by identifiers', () => {
    it('should find workflow by workflowId', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'lookup-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const found = await ctx.store.get(workflow.workflowId)

      expect(found).toBeDefined()
      expect(found?.workflowId).toBe(workflow.workflowId)
    })

    it('should find workflow by sessionId', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'unique-session-for-lookup',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const found = await ctx.store.getBySessionId('unique-session-for-lookup')

      expect(found).toBeDefined()
      expect(found?.workflowId).toBe(workflow.workflowId)
    })

    it('should return null for non-existent workflowId', async () => {
      const found = await ctx.store.get('non-existent-workflow-id')
      expect(found).toBeNull()
    })

    it('should return null for non-existent sessionId', async () => {
      const found = await ctx.store.getBySessionId('non-existent-session-id')
      expect(found).toBeNull()
    })
  })

  describe('multiple workflow isolation', () => {
    it('should not cross-contaminate workflows with similar sessions', async () => {
      // Create two workflows
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'user-a-session',
        agentId: 'agent-1',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-a-msg',
        responseMessageId: 'assistant-a-msg',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'user-b-session',
        agentId: 'agent-1',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-b-msg',
        responseMessageId: 'assistant-b-msg',
      })

      // Update only workflow1
      await ctx.store.updatePhase(workflow1.workflowId, 'clarification', {
        clarification: { clarificationId: 'clarif-a' } as any,
      })

      // Verify workflow2 unchanged
      const w2 = await ctx.store.get(workflow2.workflowId)
      expect(w2?.phase).toBe('initial')
      expect(w2?.phaseData.clarification).toBeUndefined()

      // Verify workflow1 updated
      const w1 = await ctx.store.get(workflow1.workflowId)
      expect(w1?.phase).toBe('clarification')
      expect(w1?.phaseData.clarification?.clarificationId).toBe('clarif-a')
    })

    it('should track multiple active workflows correctly', async () => {
      // Create three workflows
      const workflow1 = await ctx.store.createWorkflow({
        sessionId: 'multi-1',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u1',
        responseMessageId: 'a1',
      })

      const workflow2 = await ctx.store.createWorkflow({
        sessionId: 'multi-2',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u2',
        responseMessageId: 'a2',
      })

      const workflow3 = await ctx.store.createWorkflow({
        sessionId: 'multi-3',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'u3',
        responseMessageId: 'a3',
      })

      // Update each to different states
      await ctx.store.updatePhase(workflow1.workflowId, 'executing')
      await ctx.store.complete(workflow2.workflowId)
      await ctx.store.error(workflow3.workflowId, 'Test error')

      // Get active workflows
      const active = await ctx.store.getActiveWorkflows()
      const activeIds = active.map((w) => w.workflowId)

      // Only workflow1 should be active (running status)
      expect(activeIds).toContain(workflow1.workflowId)
      expect(activeIds).not.toContain(workflow2.workflowId)
      expect(activeIds).not.toContain(workflow3.workflowId)
    })
  })

  describe('agent URL tracking', () => {
    it('should track agentUrl in workflow', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'agent-url-session',
        agentId: 'test-agent',
        agentUrl: 'http://localhost:9999',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const found = await ctx.store.get(workflow.workflowId)
      expect(found?.agentUrl).toBe('http://localhost:9999')
    })

    it('should allow agentUrl to be undefined', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'no-url-session',
        agentId: 'test-agent',
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      const found = await ctx.store.get(workflow.workflowId)
      expect(found?.agentUrl).toBeUndefined()
    })
  })

  describe('event sequence tracking', () => {
    it('should increment eventSequence with each added event', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'event-seq-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      expect(workflow.eventSequence).toBe(0)

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

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.eventSequence).toBe(2)
      expect(updated?.bufferedEvents).toHaveLength(2)
      expect(updated?.bufferedEvents[0].sequence).toBe(0)
      expect(updated?.bufferedEvents[1].sequence).toBe(1)
    })

    it('should include workflowId in each buffered event', async () => {
      const workflow = await ctx.store.createWorkflow({
        sessionId: 'event-wfid-session',
        agentId: 'test-agent',
        agentUrl: ctx.agent.url,
        initialMessageId: 'user-1',
        responseMessageId: 'assistant-1',
      })

      await ctx.store.addEvent(workflow.workflowId, {
        type: 'test-event',
        timestamp: new Date().toISOString(),
        data: { test: true },
      })

      const updated = await ctx.store.get(workflow.workflowId)
      expect(updated?.bufferedEvents[0].workflowId).toBe(workflow.workflowId)
    })
  })
})
