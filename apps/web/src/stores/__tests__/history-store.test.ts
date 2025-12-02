/**
 * History Store Tests
 *
 * Tests for the history-store Zustand store that manages conversation lists.
 */

import { renderHook, act } from '@testing-library/react'
import { useHistoryStore } from '../history-store'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useHistoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    act(() => {
      useHistoryStore.setState({
        myConversations: [],
        orgConversations: [],
        activeTab: 'my-chats',
        searchQuery: '',
        isLoading: false,
        error: null,
        myChatsHasMore: false,
        orgChatsHasMore: false,
      })
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useHistoryStore())

      expect(result.current.myConversations).toEqual([])
      expect(result.current.orgConversations).toEqual([])
      expect(result.current.activeTab).toBe('my-chats')
      expect(result.current.searchQuery).toBe('')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('setActiveTab', () => {
    it('should change active tab', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setActiveTab('organization')
      })

      expect(result.current.activeTab).toBe('organization')
    })

    it('should toggle back to my-chats', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setActiveTab('organization')
      })
      act(() => {
        result.current.setActiveTab('my-chats')
      })

      expect(result.current.activeTab).toBe('my-chats')
    })
  })

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setSearchQuery('test query')
      })

      expect(result.current.searchQuery).toBe('test query')
    })

    it('should clear search query', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setSearchQuery('test')
      })
      act(() => {
        result.current.setSearchQuery('')
      })

      expect(result.current.searchQuery).toBe('')
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setError('Something went wrong')
      })

      expect(result.current.error).toBe('Something went wrong')
    })

    it('should clear error', () => {
      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        result.current.setError('Error')
      })
      act(() => {
        result.current.setError(null)
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('fetchMyConversations', () => {
    it('should fetch and set my conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          isPublic: false,
          messageCount: 5,
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: mockConversations,
          hasMore: false,
        }),
      })

      const { result } = renderHook(() => useHistoryStore())

      await act(async () => {
        await result.current.fetchMyConversations()
      })

      expect(result.current.myConversations).toEqual(mockConversations)
      expect(result.current.isLoading).toBe(false)
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tab=my-chats'))
    })

    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      })

      const { result } = renderHook(() => useHistoryStore())

      await act(async () => {
        await result.current.fetchMyConversations()
      })

      expect(result.current.error).toBe('Failed to fetch conversations')
      expect(result.current.isLoading).toBe(false)
    })

    it('should pass search parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [],
          hasMore: false,
        }),
      })

      const { result } = renderHook(() => useHistoryStore())

      await act(async () => {
        await result.current.fetchMyConversations('test search')
      })

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('search=test'))
    })
  })

  describe('fetchOrgConversations', () => {
    it('should fetch and set org conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-2',
          title: 'Org Conversation',
          isPublic: true,
          messageCount: 10,
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: mockConversations,
          hasMore: true,
        }),
      })

      const { result } = renderHook(() => useHistoryStore())

      await act(async () => {
        await result.current.fetchOrgConversations()
      })

      expect(result.current.orgConversations).toEqual(mockConversations)
      expect(result.current.orgChatsHasMore).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tab=organization'))
    })
  })

  describe('createConversation', () => {
    it('should create and add conversation', async () => {
      const newConversation = {
        id: 'new-conv',
        title: 'New Chat',
        isPublic: true,
        messageCount: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newConversation,
      })

      const { result } = renderHook(() => useHistoryStore())

      let created: any
      await act(async () => {
        created = await result.current.createConversation('New Chat')
      })

      expect(created).toEqual(newConversation)
      expect(result.current.myConversations).toContainEqual(newConversation)
    })

    it('should throw on create error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Create failed' }),
      })

      const { result } = renderHook(() => useHistoryStore())

      await expect(
        act(async () => {
          await result.current.createConversation()
        })
      ).rejects.toThrow('Create failed')
    })
  })

  describe('renameConversation', () => {
    it('should optimistically update title', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Old Title',
        titleSource: 'auto' as const,
        isPublic: false,
        messageCount: 5,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useHistoryStore())

      // Set initial conversation
      act(() => {
        useHistoryStore.setState({ myConversations: [conversation as any] })
      })

      await act(async () => {
        await result.current.renameConversation('conv-1', 'New Title')
      })

      const updated = result.current.myConversations.find((c) => c.id === 'conv-1')
      expect(updated?.title).toBe('New Title')
      expect(updated?.titleSource).toBe('user')
    })

    it('should rollback on rename error', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Original Title',
        titleSource: 'auto' as const,
        isPublic: false,
        messageCount: 5,
        orgId: 'org-1',
        userId: 'user-1',
        lastMessageAt: null,
        lastMessagePreview: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        deletedAt: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
      })

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ myConversations: [conversation as any] })
      })

      // Store should rollback on error
      try {
        await act(async () => {
          await result.current.renameConversation('conv-1', 'New Title')
        })
      } catch {
        // Expected to throw
      }

      // Wait for state to settle after rollback
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      const rolledBack = result.current.myConversations.find((c) => c.id === 'conv-1')
      expect(rolledBack?.title).toBe('Original Title')
    })
  })

  describe('deleteConversation', () => {
    it('should optimistically remove conversation', async () => {
      const conversation = {
        id: 'conv-to-delete',
        title: 'Delete Me',
        isPublic: false,
        messageCount: 3,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ myConversations: [conversation as any] })
      })

      await act(async () => {
        await result.current.deleteConversation('conv-to-delete')
      })

      expect(result.current.myConversations).toHaveLength(0)
    })

    it('should rollback on delete error', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Keep Me',
        isPublic: false,
        messageCount: 5,
        orgId: 'org-1',
        userId: 'user-1',
        titleSource: 'auto' as const,
        lastMessageAt: null,
        lastMessagePreview: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        deletedAt: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
      })

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ myConversations: [conversation as any] })
      })

      // Store should rollback on error
      try {
        await act(async () => {
          await result.current.deleteConversation('conv-1')
        })
      } catch {
        // Expected to throw
      }

      // Wait for state to settle after rollback
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.myConversations).toHaveLength(1)
    })
  })

  describe('hideConversation', () => {
    it('should remove from org conversations list', async () => {
      const conversation = {
        id: 'conv-to-hide',
        title: 'Hide Me',
        isPublic: true,
        messageCount: 10,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ orgConversations: [conversation as any] })
      })

      await act(async () => {
        await result.current.hideConversation('conv-to-hide')
      })

      expect(result.current.orgConversations).toHaveLength(0)
    })
  })

  describe('makePublic', () => {
    it('should update isPublic to true', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Private Chat',
        isPublic: false,
        messageCount: 5,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ myConversations: [conversation as any] })
      })

      await act(async () => {
        await result.current.makePublic('conv-1')
      })

      const updated = result.current.myConversations.find((c) => c.id === 'conv-1')
      expect(updated?.isPublic).toBe(true)
    })
  })

  describe('makePrivate', () => {
    it('should update isPublic to false', async () => {
      const conversation = {
        id: 'conv-1',
        title: 'Public Chat',
        isPublic: true,
        messageCount: 5,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ myConversations: [conversation as any] })
      })

      await act(async () => {
        await result.current.makePrivate('conv-1')
      })

      const updated = result.current.myConversations.find((c) => c.id === 'conv-1')
      expect(updated?.isPublic).toBe(false)
    })
  })

  describe('optimistic update helpers', () => {
    it('addConversation should prepend to myConversations', () => {
      const existing = { id: 'conv-1', title: 'Existing' }
      const newConv = {
        id: 'conv-2',
        title: 'New',
        orgId: 'org-1',
        userId: 'user-1',
        isPublic: true,
        messageCount: 0,
        titleSource: 'auto' as const,
        lastMessageAt: null,
        lastMessagePreview: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        deletedAt: null,
      }

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({ myConversations: [existing as any] })
      })

      act(() => {
        result.current.addConversation(newConv)
      })

      expect(result.current.myConversations[0].id).toBe('conv-2')
      expect(result.current.myConversations[1].id).toBe('conv-1')
    })

    it('updateConversation should update in both lists', () => {
      const myConv = { id: 'conv-1', title: 'My Chat', isPublic: true }
      const orgConv = { id: 'conv-1', title: 'My Chat', isPublic: true }

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({
          myConversations: [myConv as any],
          orgConversations: [orgConv as any],
        })
      })

      act(() => {
        result.current.updateConversation('conv-1', { title: 'Updated Title' })
      })

      expect(result.current.myConversations[0].title).toBe('Updated Title')
      expect(result.current.orgConversations[0].title).toBe('Updated Title')
    })

    it('removeConversation should remove from both lists', () => {
      const myConv = { id: 'conv-1', title: 'Chat' }
      const orgConv = { id: 'conv-1', title: 'Chat' }

      const { result } = renderHook(() => useHistoryStore())

      act(() => {
        useHistoryStore.setState({
          myConversations: [myConv as any],
          orgConversations: [orgConv as any],
        })
      })

      act(() => {
        result.current.removeConversation('conv-1')
      })

      expect(result.current.myConversations).toHaveLength(0)
      expect(result.current.orgConversations).toHaveLength(0)
    })
  })
})

describe('History Store selectors', () => {
  it('selectMyConversations should return myConversations', async () => {
    const { selectMyConversations } = await import('../history-store')
    const state = {
      myConversations: [{ id: 'conv-1' }],
      orgConversations: [],
      activeTab: 'my-chats' as const,
      searchQuery: '',
      isLoading: false,
      error: null,
      myChatsHasMore: false,
      orgChatsHasMore: false,
    }

    expect(selectMyConversations(state as any)).toEqual([{ id: 'conv-1' }])
  })

  it('selectOrgConversations should return orgConversations', async () => {
    const { selectOrgConversations } = await import('../history-store')
    const state = {
      myConversations: [],
      orgConversations: [{ id: 'conv-2' }],
      activeTab: 'organization' as const,
      searchQuery: '',
      isLoading: false,
      error: null,
      myChatsHasMore: false,
      orgChatsHasMore: false,
    }

    expect(selectOrgConversations(state as any)).toEqual([{ id: 'conv-2' }])
  })

  it('selectActiveTab should return activeTab', async () => {
    const { selectActiveTab } = await import('../history-store')
    const state = {
      myConversations: [],
      orgConversations: [],
      activeTab: 'organization' as const,
      searchQuery: '',
      isLoading: false,
      error: null,
      myChatsHasMore: false,
      orgChatsHasMore: false,
    }

    expect(selectActiveTab(state as any)).toBe('organization')
  })

  it('selectSearchQuery should return searchQuery', async () => {
    const { selectSearchQuery } = await import('../history-store')
    const state = {
      myConversations: [],
      orgConversations: [],
      activeTab: 'my-chats' as const,
      searchQuery: 'test',
      isLoading: false,
      error: null,
      myChatsHasMore: false,
      orgChatsHasMore: false,
    }

    expect(selectSearchQuery(state as any)).toBe('test')
  })

  it('selectFilteredConversations should filter by search', async () => {
    const { selectFilteredConversations } = await import('../history-store')
    const state = {
      myConversations: [
        { id: '1', title: 'Hello World', lastMessagePreview: 'Test' },
        { id: '2', title: 'Goodbye', lastMessagePreview: 'Farewell' },
      ],
      orgConversations: [],
      activeTab: 'my-chats' as const,
      searchQuery: 'hello',
      isLoading: false,
      error: null,
      myChatsHasMore: false,
      orgChatsHasMore: false,
    }

    const filtered = selectFilteredConversations(state as any)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('1')
  })
})
