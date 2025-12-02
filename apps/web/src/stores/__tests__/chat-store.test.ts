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
