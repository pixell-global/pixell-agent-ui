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
  messageType: 'text' | 'plan' | 'progress' | 'alert' | 'file_context'
  streaming?: boolean
  taskId?: string
  fileReferences?: FileReference[]
  metadata?: Record<string, any>
  createdAt: string
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