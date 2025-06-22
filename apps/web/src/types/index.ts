// Core workspace types for Pixell Agent Framework

export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  lastModified: string
  children?: FileNode[]
  isExpanded?: boolean
  content?: string
  uploadProgress?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  messageType: 'text' | 'plan' | 'progress' | 'alert' | 'file_context' | 'code'
  streaming?: boolean
  isThinking?: boolean
  thinkingSteps?: ThinkingStep[]
  taskId?: string
  fileReferences?: FileReference[]
  attachments?: FileAttachment[]
  mentions?: FileMention[]
  metadata?: Record<string, any>
  createdAt: string
  updatedAt?: string
}

export interface ThinkingStep {
  id: string
  content: string
  isCompleted: boolean
  timestamp: string
  importance: 'low' | 'medium' | 'high'
}

export interface FileReference {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  content?: string
  contextMention: string
}

export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  preview?: string // Base64 data URL for preview
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'error'
  uploadProgress?: number
  tempPath?: string // Path in .temp folder
  error?: string
}

export interface FileMention {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  startIndex: number
  endIndex: number
  displayText: string // The text that was mentioned like "@filename.txt"
}

export interface StreamingResponse {
  type: 'thinking' | 'content' | 'complete' | 'error'
  delta?: {
    content?: string
    role?: string
  }
  context?: {
    thoughts?: ThinkingStep[]
    data_points?: {
      text?: string[]
      images?: Array<{ url: string; detail: string }>
    }
  }
  error?: string
  accumulated?: string
}

export interface ChatUISettings {
  showThinking: 'never' | 'auto' | 'always' | 'on-demand'
  streamingEnabled: boolean
  markdownEnabled: boolean
  codeHighlightEnabled: boolean
  autoScrollEnabled: boolean
  maxTokensPerStream: number
}

export interface TaskActivity {
  id: string
  name: string
  description: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused'
  progress: number
  agentId: string
  agentName: string
  startTime: string
  estimatedDuration?: number
  output?: any
  errorMessage?: string
}

export interface WorkerAgentStatus {
  id: string
  name: string
  type: 'creator' | 'keyword' | 'analytics' | 'custom'
  status: 'idle' | 'running' | 'busy' | 'error' | 'offline'
  currentTask?: string
  lastActivity: string
  capabilities: string[]
  healthScore: number
  load: number
  exposed_ui: 'activity' | 'chat' | 'none'
}

export interface LiveMetrics {
  activeAgents: number
  tasksCompleted: number
  tasksRunning: number
  tasksQueued: number
  systemHealth: 'healthy' | 'degraded' | 'error'
  uptime: string
}

export interface AgentHealth {
  healthy: boolean
  runtime: string
  model?: string
  status: 'connected' | 'disconnected' | 'error'
  lastCheck: string
}

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

// Chat session types for conversation history
export interface ChatSession {
  id: string
  name: string
  lastMessage: string
  messageCount: number
  createdAt: string
  updatedAt: string
  participants: string[]
  tags: string[]
} 