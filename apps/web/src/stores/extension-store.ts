'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface Extension {
  id: string
  name: string
  description: string
  version: string
  type: 'runtime' | 'worker' | 'ui' | 'tool'
  verified: boolean
  downloads: number
  author: string
  homepage?: string
  repository?: string
  tags: string[]
  compatibility: string[]
  screenshots?: string[]
  rating: number
  reviews: number
  lastUpdate: string
  size: string
  dependencies: string[]
}

interface ExtensionStore {
  // State
  extensions: Extension[]
  installedExtensions: string[]
  selectedExtension: Extension | null
  searchQuery: string
  selectedType: string | null
  selectedTags: string[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setExtensions: (extensions: Extension[]) => void
  setSelectedExtension: (extension: Extension | null) => void
  setSearchQuery: (query: string) => void
  setSelectedType: (type: string | null) => void
  setSelectedTags: (tags: string[]) => void
  installExtension: (extensionId: string) => Promise<void>
  uninstallExtension: (extensionId: string) => Promise<void>
  fetchExtensions: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Getters
  getFilteredExtensions: () => Extension[]
  getExtensionsByType: (type: string) => Extension[]
  isExtensionInstalled: (extensionId: string) => boolean
  getPopularExtensions: (limit?: number) => Extension[]
  getRecentExtensions: (limit?: number) => Extension[]
}

export const useExtensionStore = create<ExtensionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    extensions: [],
    installedExtensions: ['reddit-agent-pro', 'slack-notifications'], // Mock installed
    selectedExtension: null,
    searchQuery: '',
    selectedType: null,
    selectedTags: [],
    isLoading: false,
    error: null,
    
    // Actions
    setExtensions: (extensions) => set({ extensions }),
    setSelectedExtension: (selectedExtension) => set({ selectedExtension }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedType: (selectedType) => set({ selectedType }),
    setSelectedTags: (selectedTags) => set({ selectedTags }),
    
    installExtension: async (extensionId: string) => {
      set({ isLoading: true, error: null })
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        set((state) => ({
          installedExtensions: [...state.installedExtensions, extensionId],
          isLoading: false
        }))
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Installation failed',
          isLoading: false 
        })
      }
    },
    
    uninstallExtension: async (extensionId: string) => {
      set({ isLoading: true, error: null })
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        set((state) => ({
          installedExtensions: state.installedExtensions.filter(id => id !== extensionId),
          isLoading: false
        }))
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Uninstallation failed',
          isLoading: false 
        })
      }
    },
    
    fetchExtensions: async () => {
      set({ isLoading: true, error: null })
      try {
        // Mock extension data - in real implementation, fetch from API
        const mockExtensions: Extension[] = [
          {
            id: 'reddit-agent-pro',
            name: 'Reddit Agent Pro',
            description: 'Advanced Reddit automation with sentiment analysis, keyword monitoring, and engagement analytics.',
            version: '1.2.0',
            type: 'worker',
            verified: true,
            downloads: 15420,
            author: 'Pixell Community',
            homepage: 'https://github.com/pixell/reddit-agent-pro',
            repository: 'https://github.com/pixell/reddit-agent-pro',
            tags: ['social-media', 'analytics', 'automation'],
            compatibility: ['aws-strand', 'langgraph'],
            rating: 4.8,
            reviews: 234,
            lastUpdate: '2024-12-15',
            size: '2.3 MB',
            dependencies: ['@pixell/protocols', 'praw', 'sentiment']
          },
          {
            id: 'langgraph-runtime',
            name: 'LangGraph Runtime',
            description: 'LangGraph runtime adapter for Pixell with graph visualization and debugging tools.',
            version: '0.8.1',
            type: 'runtime',
            verified: true,
            downloads: 8930,
            author: 'LangChain Team',
            homepage: 'https://python.langchain.com/docs/langgraph',
            repository: 'https://github.com/langchain-ai/langgraph',
            tags: ['runtime', 'graph', 'ai'],
            compatibility: ['langgraph'],
            rating: 4.6,
            reviews: 156,
            lastUpdate: '2024-12-10',
            size: '8.7 MB',
            dependencies: ['@langchain/core', '@langchain/langgraph']
          },
          {
            id: 'slack-notifications',
            name: 'Slack Notifications',
            description: 'Send task notifications and status updates to Slack channels with rich formatting.',
            version: '2.1.0',
            type: 'tool',
            verified: true,
            downloads: 12500,
            author: 'Slack Inc.',
            tags: ['notifications', 'communication'],
            compatibility: ['aws-strand', 'langgraph', 'openai-assistants'],
            rating: 4.7,
            reviews: 89,
            lastUpdate: '2024-12-12',
            size: '1.2 MB',
            dependencies: ['@slack/web-api']
          },
          {
            id: 'chart-ui-components',
            name: 'Chart UI Components',
            description: 'Additional chart components for Activity Pane with custom visualizations.',
            version: '1.0.3',
            type: 'ui',
            verified: false,
            downloads: 450,
            author: 'Community Contributor',
            tags: ['ui', 'charts', 'visualization'],
            compatibility: ['any'],
            rating: 4.1,
            reviews: 12,
            lastUpdate: '2024-12-08',
            size: '512 KB',
            dependencies: ['recharts', 'd3']
          },
          {
            id: 'openai-assistants-runtime',
            name: 'OpenAI Assistants Runtime',
            description: 'OpenAI Assistants API runtime adapter with function calling and file handling.',
            version: '1.5.2',
            type: 'runtime',
            verified: true,
            downloads: 6780,
            author: 'OpenAI',
            tags: ['runtime', 'openai', 'assistants'],
            compatibility: ['openai-assistants'],
            rating: 4.5,
            reviews: 98,
            lastUpdate: '2024-12-14',
            size: '3.1 MB',
            dependencies: ['openai']
          }
        ]
        
        set({ extensions: mockExtensions, isLoading: false })
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch extensions',
          isLoading: false 
        })
      }
    },
    
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    // Getters
    getFilteredExtensions: () => {
      const { extensions, searchQuery, selectedType, selectedTags } = get()
      
      return extensions.filter(extension => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const matchesSearch = 
            extension.name.toLowerCase().includes(query) ||
            extension.description.toLowerCase().includes(query) ||
            extension.tags.some(tag => tag.toLowerCase().includes(query))
          
          if (!matchesSearch) return false
        }
        
        // Type filter
        if (selectedType && extension.type !== selectedType) {
          return false
        }
        
        // Tags filter
        if (selectedTags.length > 0) {
          const hasMatchingTag = selectedTags.some(tag => 
            extension.tags.includes(tag)
          )
          if (!hasMatchingTag) return false
        }
        
        return true
      })
    },
    
    getExtensionsByType: (type: string) => {
      return get().extensions.filter(extension => extension.type === type)
    },
    
    isExtensionInstalled: (extensionId: string) => {
      return get().installedExtensions.includes(extensionId)
    },
    
    getPopularExtensions: (limit = 5) => {
      return get().extensions
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, limit)
    },
    
    getRecentExtensions: (limit = 5) => {
      return get().extensions
        .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
        .slice(0, limit)
    }
  }))
) 