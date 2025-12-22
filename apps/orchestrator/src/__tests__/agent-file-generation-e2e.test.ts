/**
 * End-to-End Tests for Agent File Generation Flow
 *
 * These tests simulate realistic pixell-sdk agent scenarios including:
 * 1. Agent sends progress events during analysis
 * 2. Agent creates and saves files (HTML reports, CSV exports)
 * 3. Agent sends file_created events to notify frontend
 * 4. Agent completes with summary content
 *
 * Tests the complete flow from SSE events through SessionManager transformation
 * to verify proper handling of file_created, content, and progress events.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { SessionManager, SSEEvent } from '../services/session-manager'

// Helper to create SSE formatted data
function sseEvent(id: number, eventType: string, data: object): string {
  return `id: ${id}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
}

// Create SSE response body from events
function createSSEBody(events: Array<{ id: number; event: string; data: object }>): string {
  return events.map(e => sseEvent(e.id, e.event, e.data)).join('')
}

/**
 * Realistic mock agent responses simulating pixell-sdk agent behavior
 */
const mockAgentScenarios = {
  /**
   * Scenario 1: Reddit Analysis Agent
   * - Searches Reddit for posts
   * - Analyzes content
   * - Generates HTML report
   * - Saves report to storage
   * - Returns summary with file link
   */
  redditAnalysis: {
    description: 'Reddit analysis agent that generates HTML report',
    events: [
      // Progress: Starting analysis
      {
        id: 1,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'search_start',
          message: 'Starting Reddit search...',
          metadata: { query: 'TypeScript best practices' },
        },
      },
      // Progress: Searching subreddits
      {
        id: 2,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'search_progress',
          message: 'Searching r/typescript...',
          metadata: { subreddit: 'r/typescript', progress: 1, total: 3 },
        },
      },
      {
        id: 3,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'search_progress',
          message: 'Searching r/programming...',
          metadata: { subreddit: 'r/programming', progress: 2, total: 3 },
        },
      },
      {
        id: 4,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'search_progress',
          message: 'Searching r/webdev...',
          metadata: { subreddit: 'r/webdev', progress: 3, total: 3 },
        },
      },
      // Progress: Found posts
      {
        id: 5,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'search_complete',
          message: 'Found 47 relevant posts',
          metadata: { totalPosts: 47 },
        },
      },
      // Progress: Analyzing
      {
        id: 6,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'analysis_start',
          message: 'Analyzing post content and sentiment...',
        },
      },
      {
        id: 7,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'analysis_progress',
          message: 'Analyzed 25 of 47 posts...',
          metadata: { analyzed: 25, total: 47 },
        },
      },
      {
        id: 8,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'analysis_complete',
          message: 'Analysis complete',
          metadata: { analyzed: 47, sentiment: { positive: 32, neutral: 10, negative: 5 } },
        },
      },
      // Progress: Generating report
      {
        id: 9,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'report_generation',
          message: 'Generating HTML report...',
        },
      },
      // File created event - THE KEY EVENT WE'RE TESTING
      {
        id: 10,
        event: 'file_created',
        data: {
          type: 'file_created',
          path: '/reports/typescript_analysis_20241216.html',
          name: 'typescript_analysis_20241216.html',
          format: 'html',
          size: 125678,
          summary: 'Comprehensive analysis of 47 Reddit posts about TypeScript best practices',
        },
      },
      // Completed with summary
      {
        id: 11,
        event: 'task-complete',
        data: {
          state: 'completed',
          message: {
            parts: [
              {
                text: '## Analysis Complete\n\nI analyzed **47 posts** across 3 subreddits about TypeScript best practices.\n\n### Key Findings:\n- 68% positive sentiment\n- Top topics: type safety, generics, interfaces\n- Most discussed: strict mode benefits\n\n📄 **Full report saved:** typescript_analysis_20241216.html',
              },
            ],
          },
        },
      },
    ],
  },

  /**
   * Scenario 2: Data Export Agent
   * - Processes data
   * - Creates multiple output files (CSV + JSON)
   * - Returns summary with file links
   */
  dataExport: {
    description: 'Data export agent that generates CSV and JSON files',
    events: [
      {
        id: 1,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'data_processing',
          message: 'Processing data records...',
          metadata: { records: 1500 },
        },
      },
      {
        id: 2,
        event: 'status-update',
        data: {
          state: 'working',
          type: 'progress',
          step: 'data_validation',
          message: 'Validating data integrity...',
          metadata: { valid: 1485, invalid: 15 },
        },
      },
      // First file: CSV export
      {
        id: 3,
        event: 'file_saved',  // Using alias to test both event types
        data: {
          type: 'file_saved',
          path: '/exports/user_data_20241216.csv',
          filename: 'user_data_20241216.csv',  // Alternative field name (for 'name')
          format: 'csv',  // format is the standard field name
          size: 234567,
          summary: 'User engagement data export (1485 records)',
        },
      },
      // Second file: JSON export
      {
        id: 4,
        event: 'file_created',
        data: {
          type: 'file_created',
          path: '/exports/user_data_20241216.json',
          name: 'user_data_20241216.json',
          format: 'json',
          size: 456789,
          summary: 'Structured JSON export with metadata',
        },
      },
      // Completed
      {
        id: 5,
        event: 'task-complete',
        data: {
          state: 'completed',
          content: 'Data export complete. Generated 2 files:\n- user_data_20241216.csv (229 KB)\n- user_data_20241216.json (446 KB)',
        },
      },
    ],
  },

  /**
   * Scenario 3: Plan Mode with File Generation
   * - Clarification → Discovery → Selection → Preview → Execution with file output
   */
  planModeWithFileOutput: {
    description: 'Full plan mode flow ending with file generation',
    clarificationEvents: [
      {
        id: 1,
        event: 'status-update',
        data: { state: 'working', message: 'Understanding your request...' },
      },
      {
        id: 2,
        event: 'clarification_needed',
        data: {
          type: 'clarification_needed',
          clarificationId: 'clarif-analysis-001',
          questions: [
            {
              questionId: 'time_range',
              question: 'What time range should I analyze?',
              options: ['Last 24 hours', 'Last week', 'Last month', 'All time'],
            },
            {
              questionId: 'depth',
              question: 'How detailed should the analysis be?',
              options: ['Quick summary', 'Standard', 'Comprehensive'],
            },
          ],
          message: 'Before I start, I need a few clarifications.',
        },
      },
    ],
    executionEvents: [
      {
        id: 1,
        event: 'status-update',
        data: { state: 'working', message: 'Executing analysis plan...', step: 'execution_start' },
      },
      {
        id: 2,
        event: 'status-update',
        data: { state: 'working', message: 'Collecting data...', step: 'data_collection' },
      },
      {
        id: 3,
        event: 'status-update',
        data: { state: 'working', message: 'Running analysis...', step: 'analysis' },
      },
      {
        id: 4,
        event: 'file_created',
        data: {
          type: 'file_created',
          path: '/reports/comprehensive_analysis.html',
          name: 'comprehensive_analysis.html',
          format: 'html',
          size: 567890,
          summary: 'Comprehensive analysis report based on your selected criteria',
        },
      },
      {
        id: 5,
        event: 'task-complete',
        data: {
          state: 'completed',
          result: '# Analysis Report Generated\n\nI\'ve completed the comprehensive analysis you requested.\n\n📄 **Report saved:** comprehensive_analysis.html\n\nThe report includes:\n- Trend analysis\n- Sentiment breakdown\n- Key insights\n- Recommendations',
        },
      },
    ],
  },
}

describe('Agent File Generation E2E Tests', () => {
  let manager: SessionManager
  let server: ReturnType<typeof setupServer>
  let receivedEvents: SSEEvent[]

  beforeAll(() => {
    // Setup MSW server with handlers
    server = setupServer(
      // Reddit analysis agent endpoint
      http.post('http://agent.test/reddit/analyze', async () => {
        return new HttpResponse(
          createSSEBody(mockAgentScenarios.redditAnalysis.events),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        )
      }),

      // Data export agent endpoint
      http.post('http://agent.test/data/export', async () => {
        return new HttpResponse(
          createSSEBody(mockAgentScenarios.dataExport.events),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        )
      }),

      // Plan mode respond endpoint
      http.post('http://agent.test/respond', async () => {
        return new HttpResponse(
          createSSEBody(mockAgentScenarios.planModeWithFileOutput.executionEvents),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        )
      })
    )
    server.listen({ onUnhandledRequest: 'bypass' })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    manager = SessionManager.createForTesting()
    receivedEvents = []
    server.resetHandlers()
  })

  describe('Reddit Analysis Agent - HTML Report Generation', () => {
    it('should handle full analysis flow with file_created event', async () => {
      const sessionId = 'reddit-session-001'
      const agentUrl = 'http://agent.test/reddit'
      const session = manager.registerSession(sessionId, agentUrl)

      // Subscribe to events
      manager.subscribe(sessionId, (event) => {
        receivedEvents.push(event)
      })

      // Simulate processing events through SessionManager
      for (const event of mockAgentScenarios.redditAnalysis.events) {
        const transformed = manager.transformEvent(event.data, session)
        session.eventEmitter.emit('event', transformed)
      }

      // Verify progress events
      const progressEvents = receivedEvents.filter(e => e.type === 'progress')
      expect(progressEvents.length).toBeGreaterThanOrEqual(5)

      // Verify search progress events have metadata
      // Note: the working state transformation nests the original metadata under metadata.metadata
      const searchProgressEvents = progressEvents.filter(e => e.step === 'search_progress')
      expect(searchProgressEvents.length).toBe(3)
      expect(searchProgressEvents[0].metadata?.metadata?.subreddit).toBe('r/typescript')

      // Verify file_created event
      const fileCreatedEvents = receivedEvents.filter(e => e.type === 'file_created')
      expect(fileCreatedEvents.length).toBe(1)

      const fileEvent = fileCreatedEvents[0]
      expect(fileEvent.path).toBe('/reports/typescript_analysis_20241216.html')
      expect(fileEvent.name).toBe('typescript_analysis_20241216.html')
      expect(fileEvent.format).toBe('html')
      expect(fileEvent.size).toBe(125678)
      expect(fileEvent.summary).toContain('47 Reddit posts')

      // Verify content event from completion
      const contentEvents = receivedEvents.filter(e => e.type === 'content')
      expect(contentEvents.length).toBe(1)

      const contentEvent = contentEvents[0]
      expect(contentEvent.content).toContain('## Analysis Complete')
      expect(contentEvent.content).toContain('**47 posts**')
      expect(contentEvent.content).toContain('typescript_analysis_20241216.html')
    })

    it('should extract content from message.parts format (pixell-sdk)', async () => {
      const sessionId = 'pixell-sdk-session'
      const session = manager.registerSession(sessionId, 'http://agent.test')

      // Simulate pixell-sdk completion event with message.parts
      const completedEvent = mockAgentScenarios.redditAnalysis.events.find(
        e => e.data.state === 'completed'
      )!

      const transformed = manager.transformEvent(completedEvent.data, session)

      expect(transformed.type).toBe('content')
      expect(transformed.content).toContain('## Analysis Complete')
      expect(transformed.content).toContain('68% positive sentiment')
    })
  })

  describe('Data Export Agent - Multiple File Outputs', () => {
    it('should handle multiple file_created and file_saved events', async () => {
      const sessionId = 'export-session-001'
      const session = manager.registerSession(sessionId, 'http://agent.test/data')

      // Process all events
      for (const event of mockAgentScenarios.dataExport.events) {
        const transformed = manager.transformEvent(event.data, session)
        receivedEvents.push(transformed)
      }

      // Verify both file events (one file_saved, one file_created)
      const fileEvents = receivedEvents.filter(e => e.type === 'file_created')
      expect(fileEvents.length).toBe(2)

      // First file: CSV (from file_saved alias)
      const csvFile = fileEvents[0]
      expect(csvFile.path).toBe('/exports/user_data_20241216.csv')
      expect(csvFile.name).toBe('user_data_20241216.csv')
      expect(csvFile.format).toBe('csv')

      // Second file: JSON
      const jsonFile = fileEvents[1]
      expect(jsonFile.path).toBe('/exports/user_data_20241216.json')
      expect(jsonFile.name).toBe('user_data_20241216.json')
      expect(jsonFile.format).toBe('json')

      // Verify content event from direct content field
      const contentEvents = receivedEvents.filter(e => e.type === 'content')
      expect(contentEvents.length).toBe(1)
      expect(contentEvents[0].content).toContain('Data export complete')
      expect(contentEvents[0].content).toContain('user_data_20241216.csv')
      expect(contentEvents[0].content).toContain('user_data_20241216.json')
    })

    it('should handle file_saved alias with alternative field names', async () => {
      const session = manager.registerSession('alias-test', 'http://agent.test')

      const fileSavedEvent = {
        type: 'file_saved',
        path: '/test/output.xlsx',
        filename: 'output.xlsx',  // Alternative for 'name'
        format: 'xlsx',  // format is the standard field
        size: 99999,
      }

      const transformed = manager.transformEvent(fileSavedEvent, session)

      expect(transformed.type).toBe('file_created')
      expect(transformed.path).toBe('/test/output.xlsx')
      expect(transformed.name).toBe('output.xlsx')
      expect(transformed.format).toBe('xlsx')
    })
  })

  describe('Plan Mode with File Output', () => {
    it('should handle clarification → execution → file output flow', async () => {
      const sessionId = 'plan-mode-session'
      const session = manager.registerSession(sessionId, 'http://agent.test')

      // Phase 1: Clarification
      for (const event of mockAgentScenarios.planModeWithFileOutput.clarificationEvents) {
        const transformed = manager.transformEvent(event.data, session)
        receivedEvents.push(transformed)
      }

      const clarificationEvent = receivedEvents.find(e => e.type === 'clarification_needed')
      expect(clarificationEvent).toBeDefined()
      expect(clarificationEvent?.clarification.clarificationId).toBe('clarif-analysis-001')
      expect(clarificationEvent?.clarification.questions.length).toBe(2)

      // Phase 2: After user responds, execution with file output
      receivedEvents = []
      for (const event of mockAgentScenarios.planModeWithFileOutput.executionEvents) {
        const transformed = manager.transformEvent(event.data, session)
        receivedEvents.push(transformed)
      }

      // Verify execution progress
      const progressEvents = receivedEvents.filter(e => e.type === 'progress')
      expect(progressEvents.length).toBeGreaterThanOrEqual(2)

      // Verify file output
      const fileEvent = receivedEvents.find(e => e.type === 'file_created')
      expect(fileEvent).toBeDefined()
      expect(fileEvent?.path).toBe('/reports/comprehensive_analysis.html')
      expect(fileEvent?.format).toBe('html')

      // Verify final content from result field
      const contentEvent = receivedEvents.find(e => e.type === 'content')
      expect(contentEvent).toBeDefined()
      expect(contentEvent?.content).toContain('# Analysis Report Generated')
      expect(contentEvent?.content).toContain('comprehensive_analysis.html')
    })
  })

  describe('Event Ordering and Consistency', () => {
    it('should preserve event order for proper UI rendering', async () => {
      const session = manager.registerSession('order-test', 'http://agent.test')
      const eventOrder: string[] = []

      for (const event of mockAgentScenarios.redditAnalysis.events) {
        const transformed = manager.transformEvent(event.data, session)
        eventOrder.push(transformed.type)
      }

      // Verify logical order: progress events → file_created → content
      const fileCreatedIndex = eventOrder.indexOf('file_created')
      const contentIndex = eventOrder.findIndex((e, i) => e === 'content' && i > fileCreatedIndex)

      // file_created should come before final content
      expect(fileCreatedIndex).toBeLessThan(contentIndex)

      // Progress events should come before file_created
      const firstProgressIndex = eventOrder.indexOf('progress')
      expect(firstProgressIndex).toBeLessThan(fileCreatedIndex)
    })

    it('should include agentUrl and sessionId in all file_created events', async () => {
      const sessionId = 'metadata-test'
      const agentUrl = 'http://custom-agent.test'
      const session = manager.registerSession(sessionId, agentUrl)

      const fileEvent = {
        type: 'file_created',
        path: '/test/file.txt',
        name: 'file.txt',
      }

      const transformed = manager.transformEvent(fileEvent, session)

      expect(transformed.agentUrl).toBe(agentUrl)
      expect(transformed.sessionId).toBe(sessionId)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle file_created with minimal required fields', async () => {
      const session = manager.registerSession('minimal-test', 'http://agent.test')

      const minimalFileEvent = {
        type: 'file_created',
        path: '/minimal/path.txt',
      }

      const transformed = manager.transformEvent(minimalFileEvent, session)

      expect(transformed.type).toBe('file_created')
      expect(transformed.path).toBe('/minimal/path.txt')
      // name should be undefined when not provided
      expect(transformed.name).toBeUndefined()
      // format falls back to event.type when not provided
      expect(transformed.format).toBe('file_created')
      expect(transformed.size).toBeUndefined()
    })

    it('should handle completion without any content fields gracefully', async () => {
      const session = manager.registerSession('empty-complete', 'http://agent.test')

      const emptyCompleted = {
        state: 'completed',
        // No result, no message.parts, no content
      }

      const transformed = manager.transformEvent(emptyCompleted, session)

      expect(transformed.type).toBe('done')
      expect(transformed.state).toBe('completed')
    })

    it('should handle mixed event formats in single stream', async () => {
      const session = manager.registerSession('mixed-test', 'http://agent.test')

      // Mix of different event formats
      const mixedEvents = [
        { state: 'working', message: 'Progress 1' },  // State-based
        { type: 'file_created', path: '/file.txt' },  // Type-based
        { state: 'completed', result: 'Done' },  // State-based completion
      ]

      const results = mixedEvents.map(e => manager.transformEvent(e, session))

      expect(results[0].type).toBe('progress')
      expect(results[1].type).toBe('file_created')
      expect(results[2].type).toBe('content')
    })
  })
})

describe('Content Extraction Priority Tests', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = SessionManager.createForTesting()
  })

  it('should use priority: result > message.parts > content', async () => {
    const session = manager.registerSession('priority-test', 'http://agent.test')

    // Event with all three content sources
    const eventWithAll = {
      state: 'completed',
      result: 'Priority 1: result field',
      message: { parts: [{ text: 'Priority 2: message.parts' }] },
      content: 'Priority 3: content field',
    }

    const transformed = manager.transformEvent(eventWithAll, session)

    expect(transformed.type).toBe('content')
    expect(transformed.content).toBe('Priority 1: result field')
  })

  it('should use message.parts when result is missing', async () => {
    const session = manager.registerSession('priority-test-2', 'http://agent.test')

    const eventWithoutResult = {
      state: 'completed',
      message: { parts: [{ text: 'From message.parts' }] },
      content: 'From content field',
    }

    const transformed = manager.transformEvent(eventWithoutResult, session)

    expect(transformed.type).toBe('content')
    expect(transformed.content).toBe('From message.parts')
  })

  it('should use content field as last resort', async () => {
    const session = manager.registerSession('priority-test-3', 'http://agent.test')

    const eventOnlyContent = {
      state: 'completed',
      content: 'Only content field available',
    }

    const transformed = manager.transformEvent(eventOnlyContent, session)

    expect(transformed.type).toBe('content')
    expect(transformed.content).toBe('Only content field available')
  })
})
