import React, { useEffect, useState } from 'react'
import { EmptyStateAIController } from './ai-controller'
import { EmptyStateRenderer } from './EmptyStateRenderer'
import { useEmptyStateStore } from './store'
import { EmptyStateContext, EmptyStateType, UserInteraction } from './types'
import { useTabStore } from '@/stores/tab-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface EmptyActivityPaneProps {
  className?: string
  apiKey?: string
  onStateChange?: (newState: EmptyStateType) => void
  onUserInteraction?: (interaction: UserInteraction) => void
}

export const EmptyActivityPane: React.FC<EmptyActivityPaneProps> = ({
  className,
  apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  onStateChange,
  onUserInteraction
}) => {
  const [aiController] = useState(() => new EmptyStateAIController(apiKey))
  const [isInitialized, setIsInitialized] = useState(false)
  
  const {
    currentState,
    isLoading,
    error,
    lastDecision,
    setCurrentState,
    setLoading,
    setError,
    setLastDecision,
    recordInteraction,
    generateContextHash
  } = useEmptyStateStore()

  const { tabs, activeTabId } = useTabStore()
  const { fileTree } = useWorkspaceStore()

  // Build context from current application state
  const buildContext = (): EmptyStateContext => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    const hasActiveFiles = tabs.some(t => t.type === 'editor' && t.bufferId)
    
    return {
      userProfile: {
        isNewUser: tabs.length === 0, // Simple heuristic
        lastActiveTime: new Date(),
        preferredWorkflow: 'chat' // Default
      },
      workspaceState: {
        hasActiveFiles,
        recentActivity: [], // TODO: Implement activity tracking
        currentProject: {
          name: 'Untitled', // TODO: Get project name from file tree or other source
          type: 'web', // TODO: Detect project type
          lastModified: new Date()
        }
      },
      interactionHistory: {
        recentPrompts: [], // TODO: Track recent prompts
        clickedFeatures: [], // TODO: Track feature usage
        dismissedStates: [] // TODO: Track dismissed states
      }
    }
  }

  // Analyze context and decide on empty state
  const analyzeAndDecide = async () => {
    if (!apiKey) {
      console.warn('OpenAI API key not provided, using fallback decision')
      setCurrentState('welcome')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const context = buildContext()
      const decision = await aiController.analyzeAndDecide(context)
      
      setLastDecision(decision)
      setCurrentState(decision.stateType)
      onStateChange?.(decision.stateType)
    } catch (err) {
      console.error('Failed to analyze context:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setCurrentState('error')
    } finally {
      setLoading(false)
    }
  }

  // Handle user interactions
  const handleUserInteraction = (interaction: Omit<UserInteraction, 'timestamp' | 'context'>) => {
    const fullInteraction: UserInteraction = {
      ...interaction,
      timestamp: new Date(),
      context: buildContext()
    }
    
    recordInteraction(fullInteraction)
    onUserInteraction?.(fullInteraction)
  }

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true)
      analyzeAndDecide()
    }
  }, [isInitialized])

  // Re-analyze when context changes
  useEffect(() => {
    if (isInitialized) {
      const timeoutId = setTimeout(() => {
        analyzeAndDecide()
      }, 1000) // Debounce context changes

      return () => clearTimeout(timeoutId)
    }
  }, [tabs.length, activeTabId, fileTree.length])

  // Show loading state while AI is deciding
  if (isLoading) {
    return (
      <EmptyStateRenderer
        stateType="loading"
        dynamicContent={{
          description: 'Analyzing your workspace...'
        }}
        onUserInteraction={handleUserInteraction}
        className={className}
      />
    )
  }

  // Show error state if something went wrong
  if (error) {
    return (
      <EmptyStateRenderer
        stateType="error"
        dynamicContent={{
          title: 'Something went wrong',
          description: error
        }}
        onStateChange={setCurrentState}
        onUserInteraction={handleUserInteraction}
        className={className}
      />
    )
  }

  // Render the AI-selected state
  return (
    <EmptyStateRenderer
      stateType={currentState}
      dynamicContent={lastDecision?.dynamicContent}
      onStateChange={setCurrentState}
      onUserInteraction={handleUserInteraction}
      className={className}
    />
  )
}
