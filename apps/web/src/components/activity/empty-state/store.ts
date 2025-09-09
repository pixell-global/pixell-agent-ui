import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { EmptyStateType, AIDecision, EmptyStateContext, UserInteraction } from './types'

interface EmptyStateStore {
  // Current state
  currentState: EmptyStateType
  lastDecision: AIDecision | null
  isLoading: boolean
  error: string | null
  
  // User preferences and learning
  userPreferences: {
    preferredStates: EmptyStateType[]
    dismissedStates: EmptyStateType[]
    interactionHistory: UserInteraction[]
  }
  
  // Cache for AI decisions
  cache: {
    [contextHash: string]: {
      decision: AIDecision
      timestamp: number
    }
  }
  
  // Actions
  setCurrentState: (state: EmptyStateType) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLastDecision: (decision: AIDecision) => void
  
  // User interaction tracking
  recordInteraction: (interaction: UserInteraction) => void
  dismissState: (state: EmptyStateType) => void
  preferState: (state: EmptyStateType) => void
  
  // Cache management
  getCachedDecision: (contextHash: string) => AIDecision | null
  setCachedDecision: (contextHash: string, decision: AIDecision) => void
  clearCache: () => void
  
  // Context analysis
  generateContextHash: (context: EmptyStateContext) => string
}

export const useEmptyStateStore = create<EmptyStateStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentState: 'loading',
    lastDecision: null,
    isLoading: false,
    error: null,
    
    userPreferences: {
      preferredStates: [],
      dismissedStates: [],
      interactionHistory: []
    },
    
    cache: {},
    
    // Actions
    setCurrentState: (state) => set({ currentState: state }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setLastDecision: (decision) => set({ lastDecision: decision }),
    
    // User interaction tracking
    recordInteraction: (interaction) => set((state) => ({
      userPreferences: {
        ...state.userPreferences,
        interactionHistory: [
          ...state.userPreferences.interactionHistory.slice(-49), // Keep last 50
          interaction
        ]
      }
    })),
    
    dismissState: (state) => set((store) => ({
      userPreferences: {
        ...store.userPreferences,
        dismissedStates: [...store.userPreferences.dismissedStates, state]
      }
    })),
    
    preferState: (state) => set((store) => ({
      userPreferences: {
        ...store.userPreferences,
        preferredStates: [
          ...store.userPreferences.preferredStates.filter(s => s !== state),
          state
        ].slice(-5) // Keep last 5 preferred states
      }
    })),
    
    // Cache management
    getCachedDecision: (contextHash) => {
      const cached = get().cache[contextHash]
      if (!cached) return null
      
      // Check if cache is expired (5 minutes)
      const isExpired = Date.now() - cached.timestamp > 5 * 60 * 1000
      if (isExpired) {
        const newCache = { ...get().cache }
        delete newCache[contextHash]
        set({ cache: newCache })
        return null
      }
      
      return cached.decision
    },
    
    setCachedDecision: (contextHash, decision) => set((state) => ({
      cache: {
        ...state.cache,
        [contextHash]: {
          decision,
          timestamp: Date.now()
        }
      }
    })),
    
    clearCache: () => set({ cache: {} }),
    
    // Context analysis
    generateContextHash: (context) => {
      // Create a simple hash of the context for caching
      const contextString = JSON.stringify({
        isNewUser: context.userProfile.isNewUser,
        hasActiveFiles: context.workspaceState.hasActiveFiles,
        projectType: context.workspaceState.currentProject.type,
        recentPrompts: context.interactionHistory.recentPrompts.slice(-3), // Last 3 prompts
        dismissedStates: context.interactionHistory.dismissedStates
      })
      
      // Simple hash function
      let hash = 0
      for (let i = 0; i < contextString.length; i++) {
        const char = contextString.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString()
    }
  }))
)
