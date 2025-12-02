import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getMockConversationsFiltered } from '@/lib/mock-data'

// Enable mock data when API is unavailable
const USE_MOCK_DATA = true

// Conversation type matching the database schema
export interface Conversation {
  id: string
  orgId: string
  userId: string
  title: string | null
  titleSource: 'auto' | 'user' | null
  isPublic: boolean
  messageCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type HistoryTab = 'my-chats' | 'organization'

interface HistoryState {
  // Data
  myConversations: Conversation[]
  orgConversations: Conversation[]

  // UI State
  activeTab: HistoryTab
  searchQuery: string
  isLoading: boolean
  error: string | null

  // Pagination
  myChatsHasMore: boolean
  orgChatsHasMore: boolean

  // Actions
  setActiveTab: (tab: HistoryTab) => void
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Fetch actions
  fetchMyConversations: (search?: string, reset?: boolean) => Promise<void>
  fetchOrgConversations: (search?: string, reset?: boolean) => Promise<void>
  refreshConversations: () => Promise<void>

  // CRUD Actions
  createConversation: (title?: string) => Promise<Conversation>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  hideConversation: (id: string) => Promise<void>
  unhideConversation: (id: string) => Promise<void>
  makePublic: (id: string) => Promise<void>
  makePrivate: (id: string) => Promise<void>

  // Optimistic updates
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removeConversation: (id: string) => void
}

const PAGE_SIZE = 50

export const useHistoryStore = create<HistoryState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        myConversations: [],
        orgConversations: [],
        activeTab: 'my-chats',
        searchQuery: '',
        isLoading: false,
        error: null,
        myChatsHasMore: false,
        orgChatsHasMore: false,

        // Basic actions
        setActiveTab: (tab) =>
          set((state) => {
            state.activeTab = tab
          }),

        setSearchQuery: (query) =>
          set((state) => {
            state.searchQuery = query
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading
          }),

        setError: (error) =>
          set((state) => {
            state.error = error
          }),

        // Fetch my conversations
        fetchMyConversations: async (search, reset = true) => {
          const state = get()
          set((s) => {
            s.isLoading = true
            s.error = null
          })

          try {
            const offset = reset ? 0 : state.myConversations.length
            const searchParam = search || state.searchQuery

            // Use mock data for demonstration
            if (USE_MOCK_DATA) {
              await new Promise(resolve => setTimeout(resolve, 200))
              const mockResult = getMockConversationsFiltered('my-chats', searchParam, PAGE_SIZE, offset)
              set((s) => {
                if (reset) {
                  s.myConversations = mockResult.conversations
                } else {
                  s.myConversations.push(...mockResult.conversations)
                }
                s.myChatsHasMore = mockResult.hasMore
                s.isLoading = false
              })
              return
            }

            const url = new URL('/api/conversations', window.location.origin)
            url.searchParams.set('tab', 'my-chats')
            url.searchParams.set('limit', String(PAGE_SIZE))
            url.searchParams.set('offset', String(offset))
            if (searchParam) {
              url.searchParams.set('search', searchParam)
            }

            const response = await fetch(url.toString())
            if (!response.ok) {
              throw new Error('Failed to fetch conversations')
            }

            const data = await response.json()
            set((s) => {
              if (reset) {
                s.myConversations = data.conversations
              } else {
                s.myConversations.push(...data.conversations)
              }
              s.myChatsHasMore = data.hasMore
              s.isLoading = false
            })
          } catch (err: any) {
            set((s) => {
              s.error = err.message
              s.isLoading = false
            })
          }
        },

        // Fetch organization conversations
        fetchOrgConversations: async (search, reset = true) => {
          const state = get()
          set((s) => {
            s.isLoading = true
            s.error = null
          })

          try {
            const offset = reset ? 0 : state.orgConversations.length
            const searchParam = search || state.searchQuery

            // Use mock data for demonstration
            if (USE_MOCK_DATA) {
              await new Promise(resolve => setTimeout(resolve, 200))
              const mockResult = getMockConversationsFiltered('organization', searchParam, PAGE_SIZE, offset)
              set((s) => {
                if (reset) {
                  s.orgConversations = mockResult.conversations
                } else {
                  s.orgConversations.push(...mockResult.conversations)
                }
                s.orgChatsHasMore = mockResult.hasMore
                s.isLoading = false
              })
              return
            }

            const url = new URL('/api/conversations', window.location.origin)
            url.searchParams.set('tab', 'organization')
            url.searchParams.set('limit', String(PAGE_SIZE))
            url.searchParams.set('offset', String(offset))
            if (searchParam) {
              url.searchParams.set('search', searchParam)
            }

            const response = await fetch(url.toString())
            if (!response.ok) {
              throw new Error('Failed to fetch organization conversations')
            }

            const data = await response.json()
            set((s) => {
              if (reset) {
                s.orgConversations = data.conversations
              } else {
                s.orgConversations.push(...data.conversations)
              }
              s.orgChatsHasMore = data.hasMore
              s.isLoading = false
            })
          } catch (err: any) {
            set((s) => {
              s.error = err.message
              s.isLoading = false
            })
          }
        },

        // Refresh both conversation lists
        refreshConversations: async () => {
          const state = get()
          await Promise.all([
            state.fetchMyConversations(undefined, true),
            state.fetchOrgConversations(undefined, true),
          ])
        },

        // Create a new conversation
        createConversation: async (title) => {
          const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to create conversation')
          }

          const conversation = await response.json()

          // Add to my conversations optimistically
          set((s) => {
            s.myConversations.unshift(conversation)
          })

          return conversation
        },

        // Rename a conversation
        renameConversation: async (id, title) => {
          // Optimistic update
          const originalTitle = get().myConversations.find((c) => c.id === id)?.title
          set((s) => {
            const conv = s.myConversations.find((c) => c.id === id)
            if (conv) {
              conv.title = title
              conv.titleSource = 'user'
            }
          })

          try {
            const response = await fetch(`/api/conversations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title }),
            })

            if (!response.ok) {
              throw new Error('Failed to rename conversation')
            }
          } catch (err) {
            // Rollback
            set((s) => {
              const conv = s.myConversations.find((c) => c.id === id)
              if (conv) {
                conv.title = originalTitle || null
              }
            })
            throw err
          }
        },

        // Delete a conversation (soft delete)
        deleteConversation: async (id) => {
          // Optimistic update
          const original = get().myConversations.find((c) => c.id === id)
          set((s) => {
            s.myConversations = s.myConversations.filter((c) => c.id !== id)
          })

          try {
            const response = await fetch(`/api/conversations/${id}`, {
              method: 'DELETE',
            })

            if (!response.ok) {
              throw new Error('Failed to delete conversation')
            }
          } catch (err) {
            // Rollback
            if (original) {
              set((s) => {
                s.myConversations.unshift(original)
              })
            }
            throw err
          }
        },

        // Hide a public org conversation
        hideConversation: async (id) => {
          // Optimistic update
          const original = get().orgConversations.find((c) => c.id === id)
          set((s) => {
            s.orgConversations = s.orgConversations.filter((c) => c.id !== id)
          })

          try {
            const response = await fetch(`/api/conversations/${id}/hide`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hidden: true }),
            })

            if (!response.ok) {
              throw new Error('Failed to hide conversation')
            }
          } catch (err) {
            // Rollback
            if (original) {
              set((s) => {
                s.orgConversations.unshift(original)
              })
            }
            throw err
          }
        },

        // Unhide a conversation
        unhideConversation: async (id) => {
          const response = await fetch(`/api/conversations/${id}/hide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: false }),
          })

          if (!response.ok) {
            throw new Error('Failed to unhide conversation')
          }

          // Refresh org conversations to show the unhidden one
          await get().fetchOrgConversations(undefined, true)
        },

        // Make a private conversation public
        makePublic: async (id) => {
          set((s) => {
            const conv = s.myConversations.find((c) => c.id === id)
            if (conv) {
              conv.isPublic = true
            }
          })

          try {
            const response = await fetch(`/api/conversations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isPublic: true }),
            })

            if (!response.ok) {
              throw new Error('Failed to make conversation public')
            }
          } catch (err) {
            // Rollback
            set((s) => {
              const conv = s.myConversations.find((c) => c.id === id)
              if (conv) {
                conv.isPublic = false
              }
            })
            throw err
          }
        },

        // Make a public conversation private
        makePrivate: async (id) => {
          set((s) => {
            const conv = s.myConversations.find((c) => c.id === id)
            if (conv) {
              conv.isPublic = false
            }
          })

          try {
            const response = await fetch(`/api/conversations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isPublic: false }),
            })

            if (!response.ok) {
              throw new Error('Failed to make conversation private')
            }
          } catch (err) {
            // Rollback
            set((s) => {
              const conv = s.myConversations.find((c) => c.id === id)
              if (conv) {
                conv.isPublic = true
              }
            })
            throw err
          }
        },

        // Optimistic update helpers
        addConversation: (conversation) =>
          set((s) => {
            s.myConversations.unshift(conversation)
          }),

        updateConversation: (id, updates) =>
          set((s) => {
            const conv = s.myConversations.find((c) => c.id === id)
            if (conv) {
              Object.assign(conv, updates)
            }
            // Also check org conversations
            const orgConv = s.orgConversations.find((c) => c.id === id)
            if (orgConv) {
              Object.assign(orgConv, updates)
            }
          }),

        removeConversation: (id) =>
          set((s) => {
            s.myConversations = s.myConversations.filter((c) => c.id !== id)
            s.orgConversations = s.orgConversations.filter((c) => c.id !== id)
          }),
      }))
    )
  )
)

// Selectors
export const selectMyConversations = (state: HistoryState) => state.myConversations
export const selectOrgConversations = (state: HistoryState) => state.orgConversations
export const selectActiveTab = (state: HistoryState) => state.activeTab
export const selectSearchQuery = (state: HistoryState) => state.searchQuery
export const selectIsLoading = (state: HistoryState) => state.isLoading
export const selectError = (state: HistoryState) => state.error

// Filtered conversations selector
export const selectFilteredConversations = (state: HistoryState) => {
  const { activeTab, myConversations, orgConversations, searchQuery } = state
  const conversations = activeTab === 'my-chats' ? myConversations : orgConversations

  if (!searchQuery) return conversations

  const query = searchQuery.toLowerCase()
  return conversations.filter(
    (c) =>
      c.title?.toLowerCase().includes(query) ||
      c.lastMessagePreview?.toLowerCase().includes(query)
  )
}
