/**
 * Chat Store Tests
 *
 * Tests for the chat-store Zustand store that manages chat messages and conversation context.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatStore } from '../chat-store'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useChatStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    act(() => {
      useChatStore.setState({
        messages: [],
        streamingMessageId: null,
        isLoading: false,
        currentConversationId: null,
        isNewConversation: true,
        selectedFiles: [],
        pendingAttachments: [],
        agentHealth: null,
        settings: {
          showThinking: 'always',
          streamingEnabled: true,
          markdownEnabled: true,
          codeHighlightEnabled: true,
          autoScrollEnabled: true,
        },
      })
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useChatStore())

      expect(result.current.messages).toEqual([])
      expect(result.current.streamingMessageId).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.currentConversationId).toBeNull()
      expect(result.current.isNewConversation).toBe(true)
    })
  })

  describe('conversation context', () => {
    describe('setConversationId', () => {
      it('should set conversation id and mark as not new', () => {
        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.setConversationId('conv-123')
        })

        expect(result.current.currentConversationId).toBe('conv-123')
        expect(result.current.isNewConversation).toBe(false)
      })

      it('should mark as new conversation when id is null', () => {
        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.setConversationId('conv-123')
        })
        act(() => {
          result.current.setConversationId(null)
        })

        expect(result.current.currentConversationId).toBeNull()
        expect(result.current.isNewConversation).toBe(true)
      })
    })

    describe('setIsNewConversation', () => {
      it('should set isNewConversation flag', () => {
        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.setIsNewConversation(false)
        })

        expect(result.current.isNewConversation).toBe(false)

        act(() => {
          result.current.setIsNewConversation(true)
        })

        expect(result.current.isNewConversation).toBe(true)
      })
    })

    describe('loadConversation', () => {
      it('should load conversation and messages from API', async () => {
        const mockMessages = [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2024-01-01' },
          { id: 'msg-2', role: 'assistant', content: 'Hi there!', createdAt: '2024-01-01' },
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'conv-123',
            messages: mockMessages,
          }),
        })

        const { result } = renderHook(() => useChatStore())

        await act(async () => {
          await result.current.loadConversation('conv-123')
        })

        expect(result.current.currentConversationId).toBe('conv-123')
        expect(result.current.isNewConversation).toBe(false)
        expect(result.current.messages).toHaveLength(2)
        expect(result.current.isLoading).toBe(false)
      })

      it('should handle load error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
        })

        const { result } = renderHook(() => useChatStore())

        await act(async () => {
          await result.current.loadConversation('conv-invalid')
        })

        expect(result.current.messages).toHaveLength(0)
        expect(result.current.isLoading).toBe(false)
      })

      it('should clear existing messages before loading', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'conv-new',
            messages: [{ id: 'new-msg', role: 'user', content: 'New' }],
          }),
        })

        const { result } = renderHook(() => useChatStore())

        // Add existing message
        act(() => {
          result.current.addMessage({
            id: 'old-msg',
            role: 'user',
            content: 'Old',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        await act(async () => {
          await result.current.loadConversation('conv-new')
        })

        expect(result.current.messages).toHaveLength(1)
        expect(result.current.messages[0].id).toBe('new-msg')
      })
    })

    describe('saveMessage', () => {
      it('should save message to API', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ needsTitleGeneration: false }),
        })

        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.setConversationId('conv-123')
        })

        await act(async () => {
          await result.current.saveMessage({
            id: 'msg-1',
            role: 'user',
            content: 'Test message',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/conversations/conv-123/messages',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test message'),
          })
        )
      })

      it('should trigger title generation when needed', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ needsTitleGeneration: true }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })

        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.setConversationId('conv-123')
        })

        await act(async () => {
          await result.current.saveMessage({
            id: 'msg-3',
            role: 'assistant',
            content: 'Third message',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        // Check title generation was called
        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/conversations/conv-123/generate-title',
            expect.objectContaining({ method: 'POST' })
          )
        })
      })

      it('should not save without conversation id', async () => {
        const { result } = renderHook(() => useChatStore())

        await act(async () => {
          await result.current.saveMessage({
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        expect(mockFetch).not.toHaveBeenCalled()
      })
    })
  })

  describe('message actions', () => {
    describe('addMessage', () => {
      it('should add message to messages array', () => {
        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.addMessage({
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        expect(result.current.messages).toHaveLength(1)
        expect(result.current.messages[0].content).toBe('Hello')
      })
    })

    describe('updateMessage', () => {
      it('should update message by id', () => {
        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.addMessage({
            id: 'msg-1',
            role: 'user',
            content: 'Original',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        act(() => {
          result.current.updateMessage('msg-1', { content: 'Updated' })
        })

        expect(result.current.messages[0].content).toBe('Updated')
      })
    })

    describe('clearMessages', () => {
      it('should clear all messages and reset conversation state', () => {
        const { result } = renderHook(() => useChatStore())

        act(() => {
          result.current.setConversationId('conv-123')
          result.current.addMessage({
            id: 'msg-1',
            role: 'user',
            content: 'Test',
            messageType: 'text',
            createdAt: '2024-01-01',
          })
        })

        act(() => {
          result.current.clearMessages()
        })

        expect(result.current.messages).toHaveLength(0)
        expect(result.current.currentConversationId).toBeNull()
        expect(result.current.isNewConversation).toBe(true)
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('getRecentHistory', () => {
    it('should return recent message history', () => {
      const { result } = renderHook(() => useChatStore())

      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          role: 'user',
          content: 'Question 1',
          messageType: 'text',
          createdAt: '2024-01-01',
        })
        result.current.addMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Answer 1',
          messageType: 'text',
          createdAt: '2024-01-01',
        })
        result.current.addMessage({
          id: 'msg-3',
          role: 'user',
          content: 'Question 2',
          messageType: 'text',
          createdAt: '2024-01-01',
        })
      })

      const history = result.current.getRecentHistory(2)

      expect(history).toHaveLength(2)
      expect(history[0].role).toBe('assistant')
      expect(history[1].role).toBe('user')
    })

    it('should exclude streaming messages', () => {
      const { result } = renderHook(() => useChatStore())

      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          role: 'user',
          content: 'Question',
          messageType: 'text',
          createdAt: '2024-01-01',
        })
        result.current.addMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Streaming...',
          messageType: 'text',
          streaming: true,
          createdAt: '2024-01-01',
        })
      })

      const history = result.current.getRecentHistory()

      expect(history).toHaveLength(1)
      expect(history[0].role).toBe('user')
    })
  })
})

describe('Chat Store selectors', () => {
  it('selectMessages should return messages', async () => {
    const { selectMessages } = await import('../chat-store')
    const state = {
      messages: [{ id: 'msg-1', content: 'Test' }],
    }

    expect(selectMessages(state as any)).toEqual([{ id: 'msg-1', content: 'Test' }])
  })

  it('selectCurrentConversationId should return conversation id', async () => {
    const { selectCurrentConversationId } = await import('../chat-store')
    const state = {
      currentConversationId: 'conv-123',
    }

    expect(selectCurrentConversationId(state as any)).toBe('conv-123')
  })

  it('selectIsNewConversation should return isNewConversation', async () => {
    const { selectIsNewConversation } = await import('../chat-store')
    const state = {
      isNewConversation: true,
    }

    expect(selectIsNewConversation(state as any)).toBe(true)
  })

  it('selectStreamingMessage should return streaming message', async () => {
    const { selectStreamingMessage } = await import('../chat-store')
    const state = {
      messages: [
        { id: 'msg-1', content: 'Done' },
        { id: 'msg-2', content: 'Streaming...', streaming: true },
      ],
      streamingMessageId: 'msg-2',
    }

    const streamingMsg = selectStreamingMessage(state as any)
    expect(streamingMsg?.id).toBe('msg-2')
    expect(streamingMsg?.content).toBe('Streaming...')
  })

  it('selectStreamingMessage should return null when no streaming', async () => {
    const { selectStreamingMessage } = await import('../chat-store')
    const state = {
      messages: [{ id: 'msg-1', content: 'Done' }],
      streamingMessageId: null,
    }

    expect(selectStreamingMessage(state as any)).toBeNull()
  })
})

/**
 * Tests for handleStreamingChunk - file_created event
 *
 * These tests verify that agent-generated file outputs are properly handled
 * and added to message outputs for rendering FileOutputCard components.
 */
describe('handleStreamingChunk - file_created events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state with a streaming message
    act(() => {
      useChatStore.setState({
        messages: [
          {
            id: 'streaming-msg',
            role: 'assistant',
            content: '',
            messageType: 'text',
            streaming: true,
            createdAt: new Date().toISOString(),
          },
        ],
        streamingMessageId: 'streaming-msg',
        isLoading: true,
        currentConversationId: 'conv-123',
        isNewConversation: false,
        selectedFiles: [],
        pendingAttachments: [],
        agentHealth: null,
        settings: {
          showThinking: 'always',
          streamingEnabled: true,
          markdownEnabled: true,
          codeHighlightEnabled: true,
          autoScrollEnabled: true,
        },
      })
    })
  })

  describe('file_created event handling', () => {
    it('should add file output to streaming message', () => {
      const { result } = renderHook(() => useChatStore())

      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/analysis.html',
          name: 'analysis.html',
          format: 'html',
          size: 12345,
          summary: 'Reddit analysis report',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.outputs).toHaveLength(1)
      expect(message?.outputs?.[0]).toMatchObject({
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
        size: 12345,
        summary: 'Reddit analysis report',
      })
    })

    it('should handle file_created with minimal fields', () => {
      const { result } = renderHook(() => useChatStore())

      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/exports/data.csv',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.outputs).toHaveLength(1)
      expect(message?.outputs?.[0]).toMatchObject({
        type: 'report',
        path: '/exports/data.csv',
        name: 'file', // default name
        format: 'txt', // default format
      })
    })

    it('should add multiple file outputs to same message', () => {
      const { result } = renderHook(() => useChatStore())

      // First file
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/summary.html',
          name: 'summary.html',
          format: 'html',
          summary: 'Main summary report',
        })
      })

      // Second file
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/exports/data.csv',
          name: 'data.csv',
          format: 'csv',
          summary: 'Raw data export',
        })
      })

      // Third file
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/exports/analysis.json',
          name: 'analysis.json',
          format: 'json',
          summary: 'Structured analysis data',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.outputs).toHaveLength(3)
      expect(message?.outputs?.[0].name).toBe('summary.html')
      expect(message?.outputs?.[1].name).toBe('data.csv')
      expect(message?.outputs?.[2].name).toBe('analysis.json')
    })

    it('should not modify message if no streaming message exists', () => {
      const { result } = renderHook(() => useChatStore())

      // Clear streaming message
      act(() => {
        useChatStore.setState({ streamingMessageId: null })
      })

      // This should not throw
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/test/file.html',
          name: 'file.html',
          format: 'html',
        })
      })

      // Messages should remain unchanged
      expect(result.current.messages[0].outputs).toBeUndefined()
    })

    it('should preserve existing message content when adding file output', () => {
      const { result } = renderHook(() => useChatStore())

      // First add some content
      act(() => {
        result.current.handleStreamingChunk({
          type: 'content',
          delta: { content: 'Here is your analysis report. ' },
        })
      })

      // Then add file output
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/analysis.html',
          name: 'analysis.html',
          format: 'html',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.content).toBe('Here is your analysis report. ')
      expect(message?.outputs).toHaveLength(1)
    })

    it('should add createdAt timestamp to file output', () => {
      const { result } = renderHook(() => useChatStore())
      const beforeTime = new Date().toISOString()

      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/test.html',
          name: 'test.html',
          format: 'html',
        })
      })

      const afterTime = new Date().toISOString()
      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      const createdAt = message?.outputs?.[0].createdAt

      expect(createdAt).toBeDefined()
      expect(createdAt! >= beforeTime).toBe(true)
      expect(createdAt! <= afterTime).toBe(true)
    })

    it('should handle all supported file formats', () => {
      const { result } = renderHook(() => useChatStore())
      const formats = ['html', 'csv', 'json', 'txt', 'pdf', 'xlsx'] as const

      formats.forEach((format, index) => {
        act(() => {
          result.current.handleStreamingChunk({
            type: 'file_created',
            path: `/test/file.${format}`,
            name: `file.${format}`,
            format,
          })
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.outputs).toHaveLength(formats.length)

      formats.forEach((format, index) => {
        expect(message?.outputs?.[index].format).toBe(format)
      })
    })
  })

  describe('integration with other streaming events', () => {
    it('should handle complete workflow: thinking → content → file_created → complete', () => {
      const { result } = renderHook(() => useChatStore())

      // Thinking phase
      act(() => {
        result.current.handleStreamingChunk({
          type: 'thinking',
          context: {
            thoughts: [
              {
                id: 'thought-1',
                content: 'Analyzing Reddit data...',
                timestamp: new Date().toISOString(),
                importance: 'medium' as const,
              },
            ],
          },
        })
      })

      // Content streaming
      act(() => {
        result.current.handleStreamingChunk({
          type: 'content',
          delta: { content: 'I have completed the analysis. ' },
        })
      })

      // File created
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/reddit-analysis.html',
          name: 'reddit-analysis.html',
          format: 'html',
          size: 45678,
          summary: 'Comprehensive Reddit analysis with sentiment breakdown',
        })
      })

      // Stream complete
      act(() => {
        result.current.handleStreamingChunk({
          type: 'complete',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')

      // Verify all components are present
      expect(message?.isThinking).toBe(false)
      expect(message?.streaming).toBe(false)
      expect(message?.content).toBe('I have completed the analysis. ')
      expect(message?.outputs).toHaveLength(1)
      expect(message?.outputs?.[0]).toMatchObject({
        type: 'report',
        path: '/reports/reddit-analysis.html',
        name: 'reddit-analysis.html',
        format: 'html',
        size: 45678,
        summary: 'Comprehensive Reddit analysis with sentiment breakdown',
      })
    })

    it('should handle progress events followed by file_created', () => {
      const { result } = renderHook(() => useChatStore())

      // Progress events
      act(() => {
        result.current.handleStreamingChunk({
          type: 'progress',
          step: 'fetching',
          message: 'Fetching Reddit posts...',
          metadata: { count: 100 },
        })
      })

      act(() => {
        result.current.handleStreamingChunk({
          type: 'progress',
          step: 'analyzing',
          message: 'Running sentiment analysis...',
        })
      })

      act(() => {
        result.current.handleStreamingChunk({
          type: 'progress',
          step: 'generating',
          message: 'Generating report...',
        })
      })

      // File created
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/output.html',
          name: 'output.html',
          format: 'html',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')

      // Verify progress steps were tracked
      expect(message?.thinkingSteps).toBeDefined()
      expect(message?.thinkingSteps?.length).toBeGreaterThanOrEqual(3)

      // Verify file output was added
      expect(message?.outputs).toHaveLength(1)
    })

    it('should handle multiple file outputs with interleaved content', () => {
      const { result } = renderHook(() => useChatStore())

      // First content
      act(() => {
        result.current.handleStreamingChunk({
          type: 'content',
          delta: { content: 'Analysis complete. ' },
        })
      })

      // First file
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/reports/main.html',
          name: 'main.html',
          format: 'html',
          summary: 'Main report',
        })
      })

      // More content
      act(() => {
        result.current.handleStreamingChunk({
          type: 'content',
          delta: { content: 'Data exported. ' },
        })
      })

      // Second file
      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/exports/data.csv',
          name: 'data.csv',
          format: 'csv',
          summary: 'Raw data',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.content).toBe('Analysis complete. Data exported. ')
      expect(message?.outputs).toHaveLength(2)
      expect(message?.outputs?.[0].name).toBe('main.html')
      expect(message?.outputs?.[1].name).toBe('data.csv')
    })
  })

  describe('edge cases', () => {
    it('should handle empty path gracefully', () => {
      const { result } = renderHook(() => useChatStore())

      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '',
          name: 'file.html',
          format: 'html',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.outputs?.[0].path).toBe('')
    })

    it('should handle undefined size and summary', () => {
      const { result } = renderHook(() => useChatStore())

      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/test/file.html',
          name: 'file.html',
          format: 'html',
          size: undefined,
          summary: undefined,
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(message?.outputs?.[0].size).toBeUndefined()
      expect(message?.outputs?.[0].summary).toBeUndefined()
    })

    it('should initialize outputs array if not present', () => {
      const { result } = renderHook(() => useChatStore())

      // Verify outputs is initially undefined
      expect(result.current.messages[0].outputs).toBeUndefined()

      act(() => {
        result.current.handleStreamingChunk({
          type: 'file_created',
          path: '/test/file.html',
          name: 'file.html',
          format: 'html',
        })
      })

      const message = result.current.messages.find(m => m.id === 'streaming-msg')
      expect(Array.isArray(message?.outputs)).toBe(true)
      expect(message?.outputs).toHaveLength(1)
    })
  })
})

/**
 * Integration test simulating full agent file generation scenario
 */
describe('Agent File Generation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should simulate Reddit agent completing analysis with report generation', () => {
    // Setup initial state with user message and assistant response starting
    act(() => {
      useChatStore.setState({
        messages: [
          {
            id: 'user-msg-1',
            role: 'user',
            content: 'Analyze r/technology posts about AI',
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'assistant-msg-1',
            role: 'assistant',
            content: '',
            messageType: 'text',
            streaming: true,
            isThinking: true,
            thinkingSteps: [],
            createdAt: new Date().toISOString(),
          },
        ],
        streamingMessageId: 'assistant-msg-1',
        isLoading: true,
        currentConversationId: 'conv-reddit',
        isNewConversation: false,
        selectedFiles: [],
        pendingAttachments: [],
        agentHealth: null,
        settings: {
          showThinking: 'always',
          streamingEnabled: true,
          markdownEnabled: true,
          codeHighlightEnabled: true,
          autoScrollEnabled: true,
        },
      })
    })

    const { result } = renderHook(() => useChatStore())

    // Simulate agent progress events
    act(() => {
      result.current.handleStreamingChunk({
        type: 'progress',
        step: 'searching',
        message: 'Searching r/technology for AI posts...',
        metadata: { subreddit: 'technology', query: 'AI' },
      })
    })

    act(() => {
      result.current.handleStreamingChunk({
        type: 'progress',
        step: 'fetching',
        message: 'Found 247 posts, fetching content...',
        metadata: { postCount: 247 },
      })
    })

    act(() => {
      result.current.handleStreamingChunk({
        type: 'progress',
        step: 'analyzing',
        message: 'Running sentiment analysis on posts...',
      })
    })

    // Agent generates content summary
    act(() => {
      result.current.handleStreamingChunk({
        type: 'content',
        delta: { content: 'I analyzed 247 posts from r/technology about AI. ' },
      })
    })

    act(() => {
      result.current.handleStreamingChunk({
        type: 'content',
        delta: { content: 'Key findings:\n- 62% positive sentiment\n- Main topics: GPT-4, Claude, automation\n' },
      })
    })

    // Agent creates HTML report
    act(() => {
      result.current.handleStreamingChunk({
        type: 'file_created',
        path: '/workspace/reports/reddit-ai-analysis-2024-01-15.html',
        name: 'reddit-ai-analysis-2024-01-15.html',
        format: 'html',
        size: 156789,
        summary: 'Comprehensive analysis of AI discussions on r/technology with sentiment breakdown, trending topics, and engagement metrics',
      })
    })

    // Agent creates CSV export
    act(() => {
      result.current.handleStreamingChunk({
        type: 'file_created',
        path: '/workspace/exports/reddit-ai-posts-2024-01-15.csv',
        name: 'reddit-ai-posts-2024-01-15.csv',
        format: 'csv',
        size: 89456,
        summary: 'Raw post data with scores, comments, and sentiment labels',
      })
    })

    // Agent finishes with final content
    act(() => {
      result.current.handleStreamingChunk({
        type: 'content',
        delta: { content: '\nThe full report and data export have been saved to your workspace.' },
      })
    })

    // Complete stream
    act(() => {
      result.current.handleStreamingChunk({
        type: 'complete',
      })
    })

    // Verify final state
    const assistantMessage = result.current.messages.find(m => m.id === 'assistant-msg-1')

    // Check content
    expect(assistantMessage?.content).toContain('I analyzed 247 posts from r/technology')
    expect(assistantMessage?.content).toContain('62% positive sentiment')
    expect(assistantMessage?.content).toContain('full report and data export')

    // Check thinking steps
    expect(assistantMessage?.thinkingSteps?.length).toBeGreaterThanOrEqual(3)
    const stepTypes = assistantMessage?.thinkingSteps?.map(s => s.step)
    expect(stepTypes).toContain('searching')
    expect(stepTypes).toContain('fetching')
    expect(stepTypes).toContain('analyzing')

    // Check file outputs
    expect(assistantMessage?.outputs).toHaveLength(2)
    expect(assistantMessage?.outputs?.[0]).toMatchObject({
      type: 'report',
      path: '/workspace/reports/reddit-ai-analysis-2024-01-15.html',
      format: 'html',
    })
    expect(assistantMessage?.outputs?.[1]).toMatchObject({
      type: 'report',
      path: '/workspace/exports/reddit-ai-posts-2024-01-15.csv',
      format: 'csv',
    })

    // Check streaming state completed
    expect(assistantMessage?.streaming).toBe(false)
    expect(assistantMessage?.isThinking).toBe(false)
    expect(result.current.streamingMessageId).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
