'use client'
import { create } from 'zustand'
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// =============================================================================
// TYPES
// =============================================================================

export type MemoryCategory =
  | 'user_preference'
  | 'project_context'
  | 'domain_knowledge'
  | 'conversation_goal'
  | 'entity'

export type MemorySource = 'auto_extracted' | 'user_provided' | 'user_edited'

export interface Memory {
  id: string
  orgId: string
  userId: string
  agentId: string | null // null = global memory
  category: MemoryCategory
  key: string
  value: string
  confidence: number
  source: MemorySource
  sourceConversationId: string | null
  metadata: Record<string, any> | null
  usageCount: number
  lastUsedAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MemoryStats {
  total: number
  active: number
  inactive: number
  byCategory: Record<MemoryCategory, number>
  byAgent: Record<string, number>
  globalCount: number
}

export interface MemorySettings {
  userId: string
  memoryEnabled: boolean
  autoExtractionEnabled: boolean
  incognitoMode: boolean
  extractionCategories: MemoryCategory[]
  updatedAt: string
}

export type MemoryFilterType = 'all' | 'global' | 'agent'

export interface CreateMemoryInput {
  agentId?: string | null
  category: MemoryCategory
  key: string
  value: string
  confidence?: number
  metadata?: Record<string, any>
}

export interface UpdateMemoryInput {
  value?: string
  confidence?: number
  isActive?: boolean
  metadata?: Record<string, any>
}

// =============================================================================
// STORE STATE
// =============================================================================

interface MemoryState {
  // Data
  memories: Memory[]
  stats: MemoryStats | null
  settings: MemorySettings | null

  // Loading states
  memoriesLoading: boolean
  settingsLoading: boolean
  operationLoading: boolean

  // Filters
  filterType: MemoryFilterType
  categoryFilter: MemoryCategory | null
  searchQuery: string
  currentAgentId: string | null

  // UI state
  incognitoMode: boolean // Session-level override (not persisted to server)

  // Actions - Data fetching
  fetchMemories: (agentId?: string | null) => Promise<void>
  fetchSettings: () => Promise<void>

  // Actions - CRUD
  createMemory: (input: CreateMemoryInput) => Promise<Memory | null>
  updateMemory: (id: string, input: UpdateMemoryInput) => Promise<Memory | null>
  deleteMemory: (id: string, hard?: boolean) => Promise<boolean>
  deleteAllMemories: () => Promise<boolean>

  // Actions - Settings
  updateSettings: (settings: Partial<Omit<MemorySettings, 'userId' | 'updatedAt'>>) => Promise<void>

  // Actions - Filters
  setFilterType: (type: MemoryFilterType) => void
  setCategoryFilter: (category: MemoryCategory | null) => void
  setSearchQuery: (query: string) => void
  setCurrentAgentId: (agentId: string | null) => void
  clearFilters: () => void

  // Actions - Incognito
  toggleIncognitoMode: () => void
  setIncognitoMode: (enabled: boolean) => void

  // Selectors
  getFilteredMemories: () => Memory[]
  getMemoriesForAgent: (agentId: string | null) => Memory[]
  getGlobalMemories: () => Memory[]
  getMemoryById: (id: string) => Memory | undefined
}

// =============================================================================
// API HELPERS
// =============================================================================

const API_BASE = '/api/memories'

async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string; isAuthError?: boolean }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const json = await response.json()

    if (!response.ok || !json.ok) {
      // Check if this is an authentication error (401)
      const isAuthError = response.status === 401 || json.error === 'Authentication required'
      return { ok: false, error: json.error || 'Request failed', isAuthError }
    }

    return { ok: true, data: json }
  } catch (error) {
    console.error(`Memory API error (${endpoint}):`, error)
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// =============================================================================
// STORE
// =============================================================================

export const useMemoryStore = create<MemoryState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          memories: [],
          stats: null,
          settings: null,
          memoriesLoading: false,
          settingsLoading: false,
          operationLoading: false,
          filterType: 'all' as MemoryFilterType,
          categoryFilter: null,
          searchQuery: '',
          currentAgentId: null,
          incognitoMode: false,

          // =================================================================
          // DATA FETCHING
          // =================================================================

          fetchMemories: async (agentId?: string | null) => {
            set((state) => {
              state.memoriesLoading = true
            })

            try {
              const params = new URLSearchParams()
              if (agentId !== undefined) {
                params.set('agentId', agentId === null ? 'null' : agentId)
              }

              const result = await apiCall<{
                memories: Memory[]
                stats: MemoryStats
              }>(`?${params.toString()}`)

              if (result.ok && result.data) {
                set((state) => {
                  state.memories = result.data!.memories
                  state.stats = result.data!.stats
                  state.memoriesLoading = false
                })
              } else {
                // Redirect to sign-in if not authenticated
                if (result.isAuthError) {
                  window.location.href = '/signin'
                  return
                }
                console.error('Failed to fetch memories:', result.error)
                set((state) => {
                  state.memoriesLoading = false
                })
              }
            } catch (error) {
              console.error('Error fetching memories:', error)
              set((state) => {
                state.memoriesLoading = false
              })
            }
          },

          fetchSettings: async () => {
            set((state) => {
              state.settingsLoading = true
            })

            try {
              const result = await apiCall<{ settings: MemorySettings }>('/settings')

              if (result.ok && result.data) {
                set((state) => {
                  state.settings = result.data!.settings
                  state.settingsLoading = false
                })
              } else {
                // Redirect to sign-in if not authenticated
                if (result.isAuthError) {
                  window.location.href = '/signin'
                  return
                }
                console.error('Failed to fetch settings:', result.error)
                set((state) => {
                  state.settingsLoading = false
                })
              }
            } catch (error) {
              console.error('Error fetching settings:', error)
              set((state) => {
                state.settingsLoading = false
              })
            }
          },

          // =================================================================
          // CRUD OPERATIONS
          // =================================================================

          createMemory: async (input: CreateMemoryInput) => {
            set((state) => {
              state.operationLoading = true
            })

            try {
              const result = await apiCall<{ memory: Memory }>('', {
                method: 'POST',
                body: JSON.stringify(input),
              })

              if (result.ok && result.data) {
                const newMemory = result.data.memory

                set((state) => {
                  state.memories.unshift(newMemory)
                  if (state.stats) {
                    state.stats.total += 1
                    state.stats.active += 1
                    state.stats.byCategory[newMemory.category] =
                      (state.stats.byCategory[newMemory.category] || 0) + 1
                    if (newMemory.agentId) {
                      state.stats.byAgent[newMemory.agentId] =
                        (state.stats.byAgent[newMemory.agentId] || 0) + 1
                    } else {
                      state.stats.globalCount += 1
                    }
                  }
                  state.operationLoading = false
                })

                return newMemory
              } else {
                console.error('Failed to create memory:', result.error)
                set((state) => {
                  state.operationLoading = false
                })
                return null
              }
            } catch (error) {
              console.error('Error creating memory:', error)
              set((state) => {
                state.operationLoading = false
              })
              return null
            }
          },

          updateMemory: async (id: string, input: UpdateMemoryInput) => {
            set((state) => {
              state.operationLoading = true
            })

            try {
              const result = await apiCall<{ memory: Memory }>(`/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(input),
              })

              if (result.ok && result.data) {
                const updatedMemory = result.data.memory

                set((state) => {
                  const index = state.memories.findIndex((m) => m.id === id)
                  if (index !== -1) {
                    state.memories[index] = updatedMemory
                  }
                  state.operationLoading = false
                })

                return updatedMemory
              } else {
                console.error('Failed to update memory:', result.error)
                set((state) => {
                  state.operationLoading = false
                })
                return null
              }
            } catch (error) {
              console.error('Error updating memory:', error)
              set((state) => {
                state.operationLoading = false
              })
              return null
            }
          },

          deleteMemory: async (id: string, hard: boolean = false) => {
            set((state) => {
              state.operationLoading = true
            })

            try {
              const params = hard ? '?hard=true' : ''
              const result = await apiCall<{ deleted: boolean }>(`/${id}${params}`, {
                method: 'DELETE',
              })

              if (result.ok) {
                set((state) => {
                  const memory = state.memories.find((m) => m.id === id)
                  if (memory && state.stats) {
                    state.stats.total -= 1
                    if (memory.isActive) {
                      state.stats.active -= 1
                    } else {
                      state.stats.inactive -= 1
                    }
                    state.stats.byCategory[memory.category] =
                      Math.max(0, (state.stats.byCategory[memory.category] || 1) - 1)
                    if (memory.agentId) {
                      state.stats.byAgent[memory.agentId] =
                        Math.max(0, (state.stats.byAgent[memory.agentId] || 1) - 1)
                    } else {
                      state.stats.globalCount = Math.max(0, state.stats.globalCount - 1)
                    }
                  }
                  state.memories = state.memories.filter((m) => m.id !== id)
                  state.operationLoading = false
                })

                return true
              } else {
                console.error('Failed to delete memory:', result.error)
                set((state) => {
                  state.operationLoading = false
                })
                return false
              }
            } catch (error) {
              console.error('Error deleting memory:', error)
              set((state) => {
                state.operationLoading = false
              })
              return false
            }
          },

          deleteAllMemories: async () => {
            set((state) => {
              state.operationLoading = true
            })

            try {
              const result = await apiCall<{ deleted: number }>('?confirm=true', {
                method: 'DELETE',
              })

              if (result.ok) {
                set((state) => {
                  state.memories = []
                  state.stats = {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    byCategory: {
                      user_preference: 0,
                      project_context: 0,
                      domain_knowledge: 0,
                      conversation_goal: 0,
                      entity: 0,
                    },
                    byAgent: {},
                    globalCount: 0,
                  }
                  state.operationLoading = false
                })

                return true
              } else {
                console.error('Failed to delete all memories:', result.error)
                set((state) => {
                  state.operationLoading = false
                })
                return false
              }
            } catch (error) {
              console.error('Error deleting all memories:', error)
              set((state) => {
                state.operationLoading = false
              })
              return false
            }
          },

          // =================================================================
          // SETTINGS
          // =================================================================

          updateSettings: async (
            settings: Partial<Omit<MemorySettings, 'userId' | 'updatedAt'>>
          ) => {
            set((state) => {
              state.settingsLoading = true
            })

            try {
              const result = await apiCall<{ settings: MemorySettings }>('/settings', {
                method: 'PATCH',
                body: JSON.stringify(settings),
              })

              if (result.ok && result.data) {
                set((state) => {
                  state.settings = result.data!.settings
                  state.settingsLoading = false
                })
              } else {
                console.error('Failed to update settings:', result.error)
                set((state) => {
                  state.settingsLoading = false
                })
              }
            } catch (error) {
              console.error('Error updating settings:', error)
              set((state) => {
                state.settingsLoading = false
              })
            }
          },

          // =================================================================
          // FILTERS
          // =================================================================

          setFilterType: (type: MemoryFilterType) => {
            set((state) => {
              state.filterType = type
            })
          },

          setCategoryFilter: (category: MemoryCategory | null) => {
            set((state) => {
              state.categoryFilter = category
            })
          },

          setSearchQuery: (query: string) => {
            set((state) => {
              state.searchQuery = query
            })
          },

          setCurrentAgentId: (agentId: string | null) => {
            set((state) => {
              state.currentAgentId = agentId
            })
          },

          clearFilters: () => {
            set((state) => {
              state.filterType = 'all'
              state.categoryFilter = null
              state.searchQuery = ''
            })
          },

          // =================================================================
          // INCOGNITO MODE
          // =================================================================

          toggleIncognitoMode: () => {
            set((state) => {
              state.incognitoMode = !state.incognitoMode
            })
          },

          setIncognitoMode: (enabled: boolean) => {
            set((state) => {
              state.incognitoMode = enabled
            })
          },

          // =================================================================
          // SELECTORS
          // =================================================================

          getFilteredMemories: () => {
            const { memories, filterType, categoryFilter, searchQuery, currentAgentId } = get()

            let filtered = [...memories]

            // Filter by type
            if (filterType === 'global') {
              filtered = filtered.filter((m) => m.agentId === null)
            } else if (filterType === 'agent') {
              filtered = filtered.filter((m) => m.agentId === currentAgentId)
            }

            // Filter by category
            if (categoryFilter) {
              filtered = filtered.filter((m) => m.category === categoryFilter)
            }

            // Filter by search query
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase()
              filtered = filtered.filter(
                (m) =>
                  m.key.toLowerCase().includes(query) ||
                  m.value.toLowerCase().includes(query)
              )
            }

            return filtered
          },

          getMemoriesForAgent: (agentId: string | null) => {
            const { memories } = get()
            return memories.filter((m) => m.agentId === agentId)
          },

          getGlobalMemories: () => {
            const { memories } = get()
            return memories.filter((m) => m.agentId === null)
          },

          getMemoryById: (id: string) => {
            const { memories } = get()
            return memories.find((m) => m.id === id)
          },
        })),
        {
          name: 'memory-store',
          // Only persist UI-related state
          partialize: (state) => ({
            incognitoMode: state.incognitoMode,
            filterType: state.filterType,
            categoryFilter: state.categoryFilter,
          }),
        }
      )
    ),
    { name: 'MemoryStore' }
  )
)

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

export const useMemories = () => useMemoryStore((state) => state.memories)
export const useMemoryStats = () => useMemoryStore((state) => state.stats)
export const useMemorySettings = () => useMemoryStore((state) => state.settings)
export const useMemoriesLoading = () => useMemoryStore((state) => state.memoriesLoading)
export const useIncognitoMode = () => useMemoryStore((state) => state.incognitoMode)
