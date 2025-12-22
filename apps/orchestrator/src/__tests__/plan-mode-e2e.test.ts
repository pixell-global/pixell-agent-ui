/**
 * End-to-End Tests for Plan Mode Flow
 *
 * These tests simulate the complete plan mode workflow:
 * 1. Initial message → clarification_needed
 * 2. Clarification response → discovery_result + selection_required
 * 3. Selection response → search_plan (transformed to preview_ready)
 * 4. Preview approval → execution
 *
 * Uses MSW to mock the agent's SSE responses.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { SessionManager, SSEEvent } from '../services/session-manager'

// Helper to create SSE formatted data
function sseEvent(id: number, eventType: string, data: object): string {
  return `id: ${id}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
}

// Mock agent responses
const mockAgentResponses = {
  clarification: {
    events: [
      { id: 1, event: 'status-update', data: { state: 'working', message: 'Analyzing your request...' } },
      { id: 2, event: 'status-update', data: { state: 'working', message: 'Preparing questions...' } },
      {
        id: 3,
        event: 'clarification_needed',
        data: {
          state: 'input-required',
          type: 'clarification_needed',
          clarificationId: 'clarif-test-123',
          agentId: 'test-agent',
          questions: [
            {
              questionId: 'time_range',
              question: 'What time range?',
              options: ['day', 'week', 'month'],
            },
            {
              questionId: 'post_type',
              question: 'What type of posts?',
              options: ['popular', 'new', 'top'],
            },
          ],
          message: 'Please answer these questions to help me understand your request.',
        },
      },
    ],
  },

  discovery: {
    events: [
      { id: 1, event: 'status-update', data: { state: 'working', message: 'Discovering subreddits...' } },
      { id: 2, event: 'status-update', data: { state: 'working', message: 'Filtering results...' } },
      {
        id: 3,
        event: 'discovery_result',
        data: {
          state: 'working',
          type: 'discovery_result',
          discoveryId: 'disc-test-456',
          discoveryType: 'subreddits',
          items: [
            { id: 'subreddit-1', name: 'r/test1', description: 'Test subreddit 1', subscribers: 100000 },
            { id: 'subreddit-2', name: 'r/test2', description: 'Test subreddit 2', subscribers: 50000 },
            { id: 'subreddit-3', name: 'r/test3', description: 'Test subreddit 3', subscribers: 25000 },
          ],
          message: 'Found 3 relevant subreddits',
        },
      },
      {
        id: 4,
        event: 'selection_required',
        data: {
          state: 'input-required',
          type: 'selection_required',
          selectionId: 'sel-test-789',
          discoveryType: 'subreddits',
          items: [
            { id: 'subreddit-1', name: 'r/test1', description: 'Test subreddit 1', subscribers: 100000 },
            { id: 'subreddit-2', name: 'r/test2', description: 'Test subreddit 2', subscribers: 50000 },
            { id: 'subreddit-3', name: 'r/test3', description: 'Test subreddit 3', subscribers: 25000 },
          ],
          minSelect: 1,
          maxSelect: 10,
          message: 'Select the subreddits you want to monitor',
        },
      },
    ],
  },

  // This is the key test case - agent sends search_plan (FLAT structure) which must be
  // transformed to preview_ready (NESTED structure) for the frontend
  searchPlan: {
    events: [
      { id: 1, event: 'status-update', data: { state: 'working', message: 'Preparing search plan...' } },
      {
        id: 2,
        event: 'search_plan',  // NOTE: This is search_plan, NOT preview_ready
        data: {
          state: 'input-required',
          type: 'search_plan',  // The bug was that this type was not being transformed
          // Agent sends FLAT structure (matching pixell-sdk SearchPlanPreview.to_dict())
          planId: 'plan-test-abc',
          userIntent: 'Search Plan for TypeScript Best Practices',
          searchKeywords: ['TypeScript', 'best practices', 'tips'],
          subreddits: ['r/test1', 'r/test2'],
          hashtags: [],
          estimatedResults: 50,
          message: 'Review and approve this search plan',
        },
      },
    ],
  },

  execution: {
    events: [
      { id: 1, event: 'status-update', data: { state: 'working', message: 'Executing search...' } },
      { id: 2, event: 'status-update', data: { state: 'working', message: 'Analyzing posts...' } },
      { id: 3, event: 'status-update', data: { state: 'working', message: 'Generating report...' } },
      {
        id: 4,
        event: 'task-status',
        data: {
          state: 'completed',
          result: {
            summary: 'Found 42 relevant posts about TypeScript best practices',
            topPosts: [
              { title: 'Top 10 TypeScript Tips', score: 1500 },
              { title: 'TypeScript Do and Donts', score: 1200 },
            ],
          },
        },
      },
    ],
  },
}

// Create SSE response body from events
function createSSEBody(events: Array<{ id: number; event: string; data: object }>): string {
  return events.map(e => sseEvent(e.id, e.event, e.data)).join('')
}

// Setup MSW server
const handlers = [
  // Initial message handler - returns clarification questions
  http.post('http://mock-agent:8000/', async ({ request }) => {
    const body = await request.json() as { params?: { sessionId?: string } }
    const sessionId = body.params?.sessionId || 'unknown-session'

    return new HttpResponse(createSSEBody(mockAgentResponses.clarification.events), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }),

  // Respond handler - returns different responses based on payload
  http.post('http://mock-agent:8000/respond', async ({ request }) => {
    const body = await request.json() as {
      clarificationId?: string
      answers?: Record<string, string>
      selectionId?: string
      selectedIds?: string[]
      planId?: string
      approved?: boolean
    }

    let responseEvents: Array<{ id: number; event: string; data: object }>

    if (body.clarificationId && body.answers) {
      // Clarification response → discovery + selection
      responseEvents = mockAgentResponses.discovery.events
    } else if (body.selectionId && body.selectedIds) {
      // Selection response → search plan (to be transformed to preview_ready)
      responseEvents = mockAgentResponses.searchPlan.events
    } else if (body.planId && body.approved !== undefined) {
      // Plan approval → execution
      responseEvents = mockAgentResponses.execution.events
    } else {
      responseEvents = [{ id: 1, event: 'error', data: { state: 'failed', error: 'Unknown request type' } }]
    }

    return new HttpResponse(createSSEBody(responseEvents), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }),
]

const server = setupServer(...handlers)

describe('Plan Mode E2E Flow', () => {
  let manager: SessionManager

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    manager = SessionManager.createForTesting()
    server.resetHandlers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Full Plan Mode Workflow', () => {
    it('should complete the full plan mode workflow with correct event transformations', async () => {
      const sessionId = 'e2e-test-session'
      const agentUrl = 'http://mock-agent:8000'

      // Register session
      const session = manager.registerSession(sessionId, agentUrl)
      expect(session.sessionId).toBe(sessionId)
      expect(session.isActive).toBe(true)

      // Collect all events emitted during the workflow
      const allEvents: SSEEvent[] = []
      const subscriber = (event: SSEEvent) => {
        allEvents.push(event)
      }

      // Phase 1: Send clarification response
      const unsubscribe1 = manager.subscribe(sessionId, subscriber)

      await manager.forwardResponse(sessionId, {
        sessionId,
        clarificationId: 'clarif-test-123',
        answers: {
          time_range: 'day',
          post_type: 'popular',
        },
      })

      unsubscribe1()

      // Verify clarification response events
      // Note: working state events are transformed to 'progress' type
      expect(allEvents.some(e => e.type === 'progress')).toBe(true)
      expect(allEvents.some(e => e.type === 'discovery_result')).toBe(true)
      expect(allEvents.some(e => e.type === 'selection_required')).toBe(true)

      const discoveryEvent = allEvents.find(e => e.type === 'discovery_result')
      expect(discoveryEvent?.items).toHaveLength(3)
      expect(discoveryEvent?.discoveryType).toBe('subreddits')
      expect(discoveryEvent?.sessionId).toBe(sessionId)
      expect(discoveryEvent?.agentUrl).toBe(agentUrl)

      const selectionEvent = allEvents.find(e => e.type === 'selection_required')
      expect(selectionEvent?.selectionId).toBe('sel-test-789')
      expect(selectionEvent?.minSelect).toBe(1)
      expect(selectionEvent?.maxSelect).toBe(10)

      // Clear events for next phase
      allEvents.length = 0

      // Phase 2: Send selection response → should receive search_plan transformed to preview_ready
      const unsubscribe2 = manager.subscribe(sessionId, subscriber)

      await manager.forwardResponse(sessionId, {
        sessionId,
        selectionId: 'sel-test-789',
        selectedIds: ['subreddit-1', 'subreddit-2'],
      })

      unsubscribe2()

      // THE KEY ASSERTION - search_plan must be transformed to preview_ready
      console.log('Events after selection:', allEvents.map(e => e.type))

      // Note: working state events are transformed to 'progress' type
      expect(allEvents.some(e => e.type === 'progress')).toBe(true)
      expect(allEvents.some(e => e.type === 'preview_ready')).toBe(true)

      // Ensure search_plan was NOT passed through (it should be transformed)
      expect(allEvents.every(e => e.type !== 'search_plan')).toBe(true)

      const previewEvent = allEvents.find(e => e.type === 'preview_ready')
      expect(previewEvent).toBeDefined()
      // Verify NESTED structure created by transformation
      expect(previewEvent?.plan).toBeDefined()
      expect(previewEvent?.plan?.planId).toBe('plan-test-abc')
      expect(previewEvent?.plan?.title).toBe('Search Plan for TypeScript Best Practices')
      expect(previewEvent?.plan?.keywords).toEqual(['TypeScript', 'best practices', 'tips'])
      expect(previewEvent?.plan?.targets).toEqual(['r/test1', 'r/test2'])
      expect(previewEvent?.message).toBe('Review and approve this search plan')
      expect(previewEvent?.sessionId).toBe(sessionId)
      expect(previewEvent?.agentUrl).toBe(agentUrl)

      // Clear events for next phase
      allEvents.length = 0

      // Phase 3: Approve plan → execution
      const unsubscribe3 = manager.subscribe(sessionId, subscriber)

      await manager.forwardResponse(sessionId, {
        sessionId,
        planId: 'plan-test-abc',
        approved: true,
      })

      unsubscribe3()

      // Verify execution events
      // Note: working state events are transformed to 'progress' type
      expect(allEvents.some(e => e.type === 'progress')).toBe(true)
      expect(allEvents.some(e => e.type === 'content' || e.type === 'done')).toBe(true)
    })

    it('should maintain session state across multiple forwardResponse calls', async () => {
      const sessionId = 'session-state-test'
      const agentUrl = 'http://mock-agent:8000'

      manager.registerSession(sessionId, agentUrl)

      // First call
      await manager.forwardResponse(sessionId, {
        sessionId,
        clarificationId: 'test',
        answers: { q1: 'a1' },
      })

      // Session should still be active
      const session = manager.getSession(sessionId)
      expect(session).toBeDefined()
      expect(session?.isActive).toBe(true)

      // Second call
      await manager.forwardResponse(sessionId, {
        sessionId,
        selectionId: 'test',
        selectedIds: ['item1'],
      })

      // Session should still be the same
      const sessionAfter = manager.getSession(sessionId)
      expect(sessionAfter).toBe(session)
      expect(sessionAfter?.sessionId).toBe(sessionId)
    })
  })

  describe('search_plan to preview_ready Transformation (Regression Tests)', () => {
    it('should transform search_plan event type to preview_ready', async () => {
      const sessionId = 'transform-test-session'
      const agentUrl = 'http://mock-agent:8000'

      manager.registerSession(sessionId, agentUrl)

      const events: SSEEvent[] = []
      const unsubscribe = manager.subscribe(sessionId, (event) => {
        events.push(event)
      })

      // Send selection response which triggers search_plan
      await manager.forwardResponse(sessionId, {
        sessionId,
        selectionId: 'sel-test',
        selectedIds: ['item1', 'item2'],
      })

      unsubscribe()

      // Find the preview event
      const previewEvents = events.filter(e => e.type === 'preview_ready')
      const searchPlanEvents = events.filter(e => e.type === 'search_plan')

      // Key assertions
      expect(previewEvents.length).toBe(1)
      expect(searchPlanEvents.length).toBe(0)  // No search_plan should leak through
    })

    it('should preserve all plan data when transforming search_plan to preview_ready', async () => {
      const sessionId = 'preserve-data-test'
      const agentUrl = 'http://mock-agent:8000'

      manager.registerSession(sessionId, agentUrl)

      const events: SSEEvent[] = []
      const unsubscribe = manager.subscribe(sessionId, (event) => {
        events.push(event)
      })

      await manager.forwardResponse(sessionId, {
        sessionId,
        selectionId: 'sel-test',
        selectedIds: ['item1'],
      })

      unsubscribe()

      const previewEvent = events.find(e => e.type === 'preview_ready')

      expect(previewEvent).toBeDefined()
      // Verify NESTED structure: planId is inside plan object, not at root
      expect(previewEvent?.plan).toBeDefined()
      expect(previewEvent?.plan.planId).toBe('plan-test-abc')
      expect(previewEvent?.plan.title).toBe('Search Plan for TypeScript Best Practices')
      // searchKeywords → keywords, subreddits → targets
      expect(previewEvent?.plan.keywords).toEqual(['TypeScript', 'best practices', 'tips'])
      expect(previewEvent?.plan.targets).toEqual(['r/test1', 'r/test2'])
    })

    it('should include session metadata in transformed event', async () => {
      const sessionId = 'metadata-test-session'
      const agentUrl = 'http://mock-agent:8000'

      manager.registerSession(sessionId, agentUrl)

      const events: SSEEvent[] = []
      const unsubscribe = manager.subscribe(sessionId, (event) => {
        events.push(event)
      })

      await manager.forwardResponse(sessionId, {
        sessionId,
        selectionId: 'sel-test',
        selectedIds: ['item1'],
      })

      unsubscribe()

      const previewEvent = events.find(e => e.type === 'preview_ready')

      expect(previewEvent?.agentUrl).toBe(agentUrl)
      expect(previewEvent?.sessionId).toBe(sessionId)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for non-existent session', async () => {
      await expect(
        manager.forwardResponse('non-existent-session', {
          clarificationId: 'test',
          answers: {},
        })
      ).rejects.toThrow('Session not found: non-existent-session')
    })

    it('should emit error event on agent failure', async () => {
      // Override handler to return 500
      server.use(
        http.post('http://mock-agent:8000/respond', () => {
          return new HttpResponse('Internal Server Error', { status: 500 })
        })
      )

      const sessionId = 'error-test-session'
      manager.registerSession(sessionId, 'http://mock-agent:8000')

      const events: SSEEvent[] = []
      manager.subscribe(sessionId, (event) => {
        events.push(event)
      })

      await expect(
        manager.forwardResponse(sessionId, {
          clarificationId: 'test',
          answers: {},
        })
      ).rejects.toThrow('Agent response failed: 500')

      // Error event should have been emitted
      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
    })
  })

  describe('Session Lifecycle', () => {
    it('should handle multiple concurrent sessions', async () => {
      const session1Id = 'concurrent-session-1'
      const session2Id = 'concurrent-session-2'
      const agentUrl = 'http://mock-agent:8000'

      manager.registerSession(session1Id, agentUrl)
      manager.registerSession(session2Id, agentUrl)

      expect(manager.getActiveSessionCount()).toBe(2)
      expect(manager.getSessionIds()).toContain(session1Id)
      expect(manager.getSessionIds()).toContain(session2Id)

      // Events should be isolated to their respective sessions
      const session1Events: SSEEvent[] = []
      const session2Events: SSEEvent[] = []

      const unsub1 = manager.subscribe(session1Id, e => session1Events.push(e))
      const unsub2 = manager.subscribe(session2Id, e => session2Events.push(e))

      // Forward to session 1 only
      await manager.forwardResponse(session1Id, {
        sessionId: session1Id,
        clarificationId: 'test',
        answers: { q1: 'a1' },
      })

      unsub1()
      unsub2()

      // Session 1 should have events, session 2 should not
      expect(session1Events.length).toBeGreaterThan(0)
      expect(session2Events.length).toBe(0)
    })
  })
})
