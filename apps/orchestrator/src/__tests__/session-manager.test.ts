import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { SessionManager, AgentSession, SSEEvent } from '../services/session-manager'

describe('SessionManager', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = SessionManager.createForTesting()
  })

  describe('Session Registration', () => {
    it('should register a new session with correct properties', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      const session = manager.registerSession(sessionId, agentUrl)

      expect(session.sessionId).toBe(sessionId)
      expect(session.agentUrl).toBe(agentUrl)
      expect(session.isActive).toBe(true)
      expect(session.eventEmitter).toBeInstanceOf(EventEmitter)
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.lastActivity).toBeInstanceOf(Date)
    })

    it('should return existing session if already registered', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      const session1 = manager.registerSession(sessionId, agentUrl)
      const originalCreatedAt = session1.createdAt

      // Wait a bit to ensure timestamps would differ
      const session2 = manager.registerSession(sessionId, agentUrl)

      expect(session2).toBe(session1)
      expect(session2.createdAt).toBe(originalCreatedAt)
    })

    it('should update lastActivity when session already exists', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      const session1 = manager.registerSession(sessionId, agentUrl)
      const originalLastActivity = session1.lastActivity

      // Manually set lastActivity to the past
      session1.lastActivity = new Date(Date.now() - 10000)
      const oldLastActivity = session1.lastActivity

      manager.registerSession(sessionId, agentUrl)

      expect(session1.lastActivity.getTime()).toBeGreaterThan(oldLastActivity.getTime())
    })

    it('should store session in internal map', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      manager.registerSession(sessionId, agentUrl)

      expect(manager.getSessionIds()).toContain(sessionId)
    })
  })

  describe('Session Retrieval', () => {
    it('should return session by ID', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      manager.registerSession(sessionId, agentUrl)
      const session = manager.getSession(sessionId)

      expect(session).toBeDefined()
      expect(session?.sessionId).toBe(sessionId)
    })

    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('non-existent-session')

      expect(session).toBeUndefined()
    })

    it('should update lastActivity on getSession', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      const session = manager.registerSession(sessionId, agentUrl)

      // Set lastActivity to the past
      const pastTime = new Date(Date.now() - 10000)
      session.lastActivity = pastTime

      manager.getSession(sessionId)

      expect(session.lastActivity.getTime()).toBeGreaterThan(pastTime.getTime())
    })
  })

  describe('Session Deactivation', () => {
    it('should mark session as inactive', () => {
      const sessionId = 'test-session-123'
      const agentUrl = 'http://localhost:8000'

      const session = manager.registerSession(sessionId, agentUrl)
      expect(session.isActive).toBe(true)

      manager.deactivateSession(sessionId)

      expect(session.isActive).toBe(false)
    })

    it('should not throw for non-existent session', () => {
      expect(() => manager.deactivateSession('non-existent')).not.toThrow()
    })
  })

  describe('Active Session Count', () => {
    it('should return 0 for no sessions', () => {
      expect(manager.getActiveSessionCount()).toBe(0)
    })

    it('should return correct count of active sessions', () => {
      manager.registerSession('session-1', 'http://localhost:8000')
      manager.registerSession('session-2', 'http://localhost:8001')
      manager.registerSession('session-3', 'http://localhost:8002')

      expect(manager.getActiveSessionCount()).toBe(3)
    })

    it('should exclude deactivated sessions from count', () => {
      manager.registerSession('session-1', 'http://localhost:8000')
      manager.registerSession('session-2', 'http://localhost:8001')

      manager.deactivateSession('session-1')

      expect(manager.getActiveSessionCount()).toBe(1)
    })
  })

  describe('Session Cleanup', () => {
    it('should remove sessions older than 30 minutes', () => {
      const sessionId = 'old-session'
      const session = manager.registerSession(sessionId, 'http://localhost:8000')

      // Set lastActivity to 31 minutes ago
      session.lastActivity = new Date(Date.now() - 31 * 60 * 1000)

      manager.cleanup()

      expect(manager.getSession(sessionId)).toBeUndefined()
      expect(manager.getSessionIds()).not.toContain(sessionId)
    })

    it('should keep sessions newer than 30 minutes', () => {
      const sessionId = 'new-session'
      const session = manager.registerSession(sessionId, 'http://localhost:8000')

      // Set lastActivity to 29 minutes ago
      session.lastActivity = new Date(Date.now() - 29 * 60 * 1000)

      manager.cleanup()

      expect(manager.getSession(sessionId)).toBeDefined()
    })

    it('should remove all event listeners from cleaned up sessions', () => {
      const sessionId = 'old-session'
      const session = manager.registerSession(sessionId, 'http://localhost:8000')

      // Add a listener
      const listener = vi.fn()
      session.eventEmitter.on('event', listener)
      expect(session.eventEmitter.listenerCount('event')).toBe(1)

      // Set lastActivity to 31 minutes ago
      session.lastActivity = new Date(Date.now() - 31 * 60 * 1000)

      manager.cleanup()

      // EventEmitter should have no listeners after cleanup
      expect(session.eventEmitter.listenerCount('event')).toBe(0)
    })
  })

  describe('Event Subscription', () => {
    it('should subscribe to session events', () => {
      const sessionId = 'test-session'
      const session = manager.registerSession(sessionId, 'http://localhost:8000')

      const callback = vi.fn()
      manager.subscribe(sessionId, callback)

      const testEvent: SSEEvent = { type: 'test', data: 'hello' }
      session.eventEmitter.emit('event', testEvent)

      expect(callback).toHaveBeenCalledWith(testEvent)
    })

    it('should return unsubscribe function', () => {
      const sessionId = 'test-session'
      const session = manager.registerSession(sessionId, 'http://localhost:8000')

      const callback = vi.fn()
      const unsubscribe = manager.subscribe(sessionId, callback)

      unsubscribe()

      const testEvent: SSEEvent = { type: 'test', data: 'hello' }
      session.eventEmitter.emit('event', testEvent)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should return no-op function for non-existent session', () => {
      const callback = vi.fn()
      const unsubscribe = manager.subscribe('non-existent', callback)

      expect(unsubscribe).toBeInstanceOf(Function)
      expect(() => unsubscribe()).not.toThrow()
    })

    it('should support multiple subscribers', () => {
      const sessionId = 'test-session'
      const session = manager.registerSession(sessionId, 'http://localhost:8000')

      const callback1 = vi.fn()
      const callback2 = vi.fn()

      manager.subscribe(sessionId, callback1)
      manager.subscribe(sessionId, callback2)

      const testEvent: SSEEvent = { type: 'test', data: 'hello' }
      session.eventEmitter.emit('event', testEvent)

      expect(callback1).toHaveBeenCalledWith(testEvent)
      expect(callback2).toHaveBeenCalledWith(testEvent)
    })
  })
})

describe('SessionManager Event Transformation', () => {
  let manager: SessionManager
  let mockSession: AgentSession

  beforeEach(() => {
    manager = SessionManager.createForTesting()
    mockSession = {
      sessionId: 'test-session-123',
      agentUrl: 'http://localhost:8000',
      eventEmitter: new EventEmitter(),
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
    }
  })

  describe('clarification_needed transformation', () => {
    it('should transform clarification_needed event with nested clarification object', () => {
      const inputEvent = {
        type: 'clarification_needed',
        clarificationId: 'clarif-123',
        questions: [
          { questionId: 'q1', question: 'What is your preference?', options: ['A', 'B'] }
        ],
        message: 'Please answer the following',
        agentId: 'agent-1',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('clarification_needed')
      expect(result.clarification).toBeDefined()
      expect(result.clarification.clarificationId).toBe('clarif-123')
      expect(result.clarification.questions).toEqual(inputEvent.questions)
      expect(result.clarification.message).toBe('Please answer the following')
      expect(result.clarification.agentUrl).toBe(mockSession.agentUrl)
      expect(result.clarification.sessionId).toBe(mockSession.sessionId)
    })

    it('should use event sessionId if provided', () => {
      const inputEvent = {
        type: 'clarification_needed',
        clarificationId: 'clarif-123',
        questions: [],
        sessionId: 'custom-session',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.clarification.sessionId).toBe('custom-session')
    })
  })

  describe('discovery_result transformation', () => {
    it('should transform discovery_result event', () => {
      const inputEvent = {
        type: 'discovery_result',
        items: [
          { id: 'item-1', name: 'Item 1' },
          { id: 'item-2', name: 'Item 2' },
        ],
        discoveryType: 'subreddits',
        discoveryId: 'disc-123',
        message: 'Found 2 items',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('discovery_result')
      expect(result.items).toEqual(inputEvent.items)
      expect(result.discoveryType).toBe('subreddits')
      expect(result.discoveryId).toBe('disc-123')
      expect(result.message).toBe('Found 2 items')
      expect(result.agentUrl).toBe(mockSession.agentUrl)
      expect(result.sessionId).toBe(mockSession.sessionId)
    })

    it('should handle snake_case field names', () => {
      const inputEvent = {
        type: 'discovery_result',
        items: [],
        discovery_type: 'channels',
        discovery_id: 'disc-456',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.discoveryType).toBe('channels')
      expect(result.discoveryId).toBe('disc-456')
    })
  })

  describe('selection_required transformation', () => {
    it('should transform selection_required event', () => {
      const inputEvent = {
        type: 'selection_required',
        items: [
          { id: 'item-1', name: 'Item 1' },
          { id: 'item-2', name: 'Item 2' },
        ],
        selectionId: 'sel-123',
        discoveryType: 'subreddits',
        minSelect: 1,
        maxSelect: 5,
        message: 'Select items',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('selection_required')
      expect(result.items).toEqual(inputEvent.items)
      expect(result.selectionId).toBe('sel-123')
      expect(result.discoveryType).toBe('subreddits')
      expect(result.minSelect).toBe(1)
      expect(result.maxSelect).toBe(5)
      expect(result.message).toBe('Select items')
      expect(result.agentUrl).toBe(mockSession.agentUrl)
      expect(result.sessionId).toBe(mockSession.sessionId)
    })

    it('should handle snake_case field names', () => {
      const inputEvent = {
        type: 'selection_required',
        items: [],
        selection_id: 'sel-789',
        discovery_type: 'hashtags',
        min_select: 2,
        max_select: 10,
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.selectionId).toBe('sel-789')
      expect(result.discoveryType).toBe('hashtags')
      expect(result.minSelect).toBe(2)
      expect(result.maxSelect).toBe(10)
    })
  })

  describe('preview_ready transformation', () => {
    it('should transform preview_ready event preserving all fields', () => {
      const inputEvent = {
        type: 'preview_ready',
        planId: 'plan-123',
        plan: {
          title: 'Search Plan',
          steps: ['Step 1', 'Step 2'],
        },
        customField: 'custom-value',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('preview_ready')
      expect(result.planId).toBe('plan-123')
      expect(result.plan).toEqual(inputEvent.plan)
      expect(result.customField).toBe('custom-value')
      expect(result.agentUrl).toBe(mockSession.agentUrl)
      expect(result.sessionId).toBe(mockSession.sessionId)
    })
  })

  describe('search_plan → preview_ready transformation (THE KEY BUG FIX)', () => {
    it('should transform search_plan to preview_ready with nested plan structure', () => {
      // Agent sends FLAT structure
      const inputEvent = {
        type: 'search_plan',
        planId: 'plan-123',
        userIntent: 'Find negative comments about product',
        searchKeywords: ['keyword1', 'keyword2'],
        subreddits: ['r/marketing', 'r/business'],
        message: 'Here is my search plan',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      // THE KEY ASSERTION - type MUST be transformed
      expect(result.type).toBe('preview_ready')
      // Frontend expects NESTED structure
      expect(result.plan).toBeDefined()
      expect(result.plan.title).toBe('Find negative comments about product')
      expect(result.plan.keywords).toEqual(['keyword1', 'keyword2'])
      expect(result.plan.targets).toEqual(['r/marketing', 'r/business'])
      expect(result.plan.planId).toBe('plan-123')
      expect(result.message).toBe('Here is my search plan')
    })

    it('should use message as title fallback if userIntent is missing', () => {
      const inputEvent = {
        type: 'search_plan',
        planId: 'plan-456',
        message: 'Fallback title from message',
        searchKeywords: ['test'],
        targets: ['target1', 'target2'], // Test targets field (alternative to subreddits)
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('preview_ready')
      expect(result.plan.title).toBe('Fallback title from message')
      expect(result.plan.keywords).toEqual(['test'])
      expect(result.plan.targets).toEqual(['target1', 'target2'])
      expect(result.plan.planId).toBe('plan-456')
    })

    it('should add agentUrl and sessionId to transformed event', () => {
      const inputEvent = {
        type: 'search_plan',
        planId: 'plan-123',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.agentUrl).toBe(mockSession.agentUrl)
      expect(result.sessionId).toBe(mockSession.sessionId)
    })

    it('should use event sessionId if provided', () => {
      const inputEvent = {
        type: 'search_plan',
        planId: 'plan-123',
        sessionId: 'event-session-id',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.sessionId).toBe('event-session-id')
    })

    it('should NOT retain original type in output (regression test for spread order bug)', () => {
      const inputEvent = {
        type: 'search_plan',  // Original type
        planId: 'plan-123',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      // This is the key regression test - the bug was that spread order
      // caused the original type to overwrite the new type
      expect(result.type).not.toBe('search_plan')
      expect(result.type).toBe('preview_ready')
    })
  })

  describe('State-based transformations', () => {
    it('should transform completed state with result to content event', () => {
      const inputEvent = {
        state: 'completed',
        result: 'Task completed successfully',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('Task completed successfully')
    })

    it('should transform completed state with object result to JSON content', () => {
      const inputEvent = {
        state: 'completed',
        result: { status: 'success', data: [1, 2, 3] },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe(JSON.stringify({ status: 'success', data: [1, 2, 3] }))
    })

    it('should transform completed state without result to done event', () => {
      const inputEvent = {
        state: 'completed',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('done')
      expect(result.state).toBe('completed')
    })

    it('should transform failed state to error event', () => {
      const inputEvent = {
        state: 'failed',
        error: 'Something went wrong',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('error')
      expect(result.error).toBe('Something went wrong')
    })

    it('should transform failed state with message fallback', () => {
      const inputEvent = {
        state: 'failed',
        message: 'Error message from agent',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('error')
      expect(result.error).toBe('Error message from agent')
    })

    it('should transform working state to progress event', () => {
      const inputEvent = {
        state: 'working',
        message: 'Processing request...',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('progress')
      expect(result.message).toBe('Processing request...')
      expect(result.state).toBe('working')
    })

    it('should use default message for working state without message', () => {
      const inputEvent = {
        state: 'working',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('progress')
      expect(result.message).toBe('Processing...')
    })
  })

  describe('Unknown event passthrough', () => {
    it('should pass through unknown event types with agentUrl and sessionId', () => {
      const inputEvent = {
        type: 'custom_event',
        customField: 'custom-value',
        nested: { data: true },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('custom_event')
      expect(result.customField).toBe('custom-value')
      expect(result.nested).toEqual({ data: true })
      expect(result.agentUrl).toBe(mockSession.agentUrl)
      expect(result.sessionId).toBe(mockSession.sessionId)
    })

    it('should handle event without type', () => {
      const inputEvent = {
        someData: 'value',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('unknown')
    })
  })

  describe('file_created event transformation', () => {
    it('should transform file_created event with all fields', () => {
      const inputEvent = {
        type: 'file_created',
        path: '/reports/analysis_2024.html',
        name: 'analysis_2024.html',
        format: 'html',
        size: 45678,
        summary: 'Comprehensive analysis of Reddit discussions',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('file_created')
      expect(result.path).toBe('/reports/analysis_2024.html')
      expect(result.name).toBe('analysis_2024.html')
      expect(result.format).toBe('html')
      expect(result.size).toBe(45678)
      expect(result.summary).toBe('Comprehensive analysis of Reddit discussions')
      expect(result.agentUrl).toBe(mockSession.agentUrl)
      expect(result.sessionId).toBe(mockSession.sessionId)
    })

    it('should transform file_saved event (alias) to file_created', () => {
      const inputEvent = {
        type: 'file_saved',
        path: '/exports/data.csv',
        filename: 'data.csv',  // Alternative field name
        format: 'csv',  // format field is used directly
        size: 12345,
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('file_created')
      expect(result.path).toBe('/exports/data.csv')
      expect(result.name).toBe('data.csv')
      expect(result.format).toBe('csv')
      expect(result.size).toBe(12345)
    })

    it('should handle file_created with minimal fields', () => {
      const inputEvent = {
        type: 'file_created',
        path: '/tmp/output.txt',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('file_created')
      expect(result.path).toBe('/tmp/output.txt')
      expect(result.name).toBeUndefined()
      // format falls back to event.type when event.format is not provided
      expect(result.format).toBe('file_created')
    })
  })

  describe('completed state with pixell-sdk message.parts format', () => {
    it('should extract content from message.parts array', () => {
      const inputEvent = {
        state: 'completed',
        message: {
          parts: [
            { text: 'Here is the analysis result:\n\n' },
            { text: '## Summary\nFound 42 relevant posts about the topic.' },
          ],
        },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('Here is the analysis result:\n\n## Summary\nFound 42 relevant posts about the topic.')
    })

    it('should handle single text part in message.parts', () => {
      const inputEvent = {
        state: 'completed',
        message: {
          parts: [
            { text: 'Analysis complete. Report saved to /reports/output.html' },
          ],
        },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('Analysis complete. Report saved to /reports/output.html')
    })

    it('should prefer event.result over message.parts if both present', () => {
      const inputEvent = {
        state: 'completed',
        result: 'Primary result content',
        message: {
          parts: [{ text: 'Secondary content from parts' }],
        },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('Primary result content')
    })

    it('should skip non-text parts in message.parts', () => {
      const inputEvent = {
        state: 'completed',
        message: {
          parts: [
            { text: 'Text part 1' },
            { type: 'image', url: 'http://example.com/img.png' },  // Non-text part
            { text: 'Text part 2' },
            { data: { key: 'value' } },  // Non-text part
          ],
        },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('Text part 1Text part 2')
    })

    it('should handle empty message.parts array', () => {
      const inputEvent = {
        state: 'completed',
        message: {
          parts: [],
        },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('done')
      expect(result.state).toBe('completed')
    })
  })

  describe('completed state with direct content field', () => {
    it('should extract content from event.content string', () => {
      const inputEvent = {
        state: 'completed',
        content: 'Direct content from agent response',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('Direct content from agent response')
    })

    it('should serialize event.content object to JSON', () => {
      const inputEvent = {
        state: 'completed',
        content: {
          summary: 'Analysis complete',
          findings: ['finding1', 'finding2'],
          score: 95,
        },
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      const parsed = JSON.parse(result.content)
      expect(parsed.summary).toBe('Analysis complete')
      expect(parsed.findings).toEqual(['finding1', 'finding2'])
      expect(parsed.score).toBe(95)
    })

    it('should prefer event.result over event.content', () => {
      const inputEvent = {
        state: 'completed',
        result: 'From result field',
        content: 'From content field',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('content')
      expect(result.content).toBe('From result field')
    })
  })

  describe('working state with progress metadata', () => {
    it('should transform working state to progress event with step and metadata', () => {
      const inputEvent = {
        state: 'working',
        message: 'Analyzing posts...',
        step: 'analysis_progress',
        progress: 45,
        total: 100,
        currentItem: 'Post #45',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('progress')
      expect(result.step).toBe('analysis_progress')
      expect(result.message).toBe('Analyzing posts...')
      expect(result.state).toBe('working')
      expect(result.metadata.progress).toBe(45)
      expect(result.metadata.total).toBe(100)
      expect(result.metadata.currentItem).toBe('Post #45')
    })

    it('should use "working" as default step if not provided', () => {
      const inputEvent = {
        state: 'working',
        message: 'Processing...',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('progress')
      expect(result.step).toBe('working')
    })

    it('should use "Processing..." as default message if not provided', () => {
      const inputEvent = {
        state: 'working',
      }

      const result = manager.transformEvent(inputEvent, mockSession)

      expect(result.type).toBe('progress')
      expect(result.message).toBe('Processing...')
    })
  })
})
