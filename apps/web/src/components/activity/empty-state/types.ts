export type EmptyStateType = 'welcome' | 'feature-preview' | 'contextual-hints' | 'loading' | 'error'

export interface EmptyStateContext {
  userProfile: {
    isNewUser: boolean
    lastActiveTime: Date
    preferredWorkflow: string
  }
  workspaceState: {
    hasActiveFiles: boolean
    recentActivity: Activity[]
    currentProject: ProjectInfo
  }
  interactionHistory: {
    recentPrompts: string[]
    clickedFeatures: string[]
    dismissedStates: EmptyStateType[]
  }
}

export interface Activity {
  id: string
  type: string
  timestamp: Date
  description: string
}

export interface ProjectInfo {
  name: string
  type: string
  lastModified: Date
}

export interface AIDecision {
  stateType: EmptyStateType
  dynamicContent?: {
    title?: string
    description?: string
    suggestions?: string[]
    actions?: Action[]
  }
  confidence: number
  reasoning: string
}

export interface Action {
  label: string
  onClick: () => void
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link'
}

export interface UserInteraction {
  type: 'click' | 'dismiss' | 'action'
  target: string
  timestamp: Date
  context: EmptyStateContext
}

export interface EmptyStateConfig {
  aiConfig: {
    model: string
    temperature: number
    maxTokens: number
    cacheTimeout: number
  }
  availableStates: EmptyStateType[]
  defaultState: EmptyStateType
  fallbackState: EmptyStateType
  customStates?: Record<string, React.ComponentType<any>>
  onStateChange?: (newState: EmptyStateType) => void
  onUserInteraction?: (interaction: UserInteraction) => void
}
