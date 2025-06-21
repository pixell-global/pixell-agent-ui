'use client'
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Core types
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

interface WorkspaceState {
  // Chat State
  messages: ChatMessage[]
  streamingMessageId: string | null
  selectedFiles: FileReference[]
  
  // Activity State
  tasks: TaskActivity[]
  agents: WorkerAgentStatus[]
  liveMetrics: LiveMetrics | null
  
  // Navigator State
  fileTree: FileNode[]
  uploadProgress: Record<string, { name: string; progress: number }>
  currentFolder: string
  searchQuery: string
  isLoading: boolean
  
  // UI State
  activePanel: 'chat' | 'activity' | 'navigator'
  isConnected: boolean
  
  // Actions
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  appendToStreamingMessage: (id: string, token: string) => void
  setStreamingMessage: (id: string | null) => void
  
  addFileReference: (file: FileReference) => void
  removeFileReference: (id: string) => void
  clearFileReferences: () => void
  
  updateTask: (task: TaskActivity) => void
  updateAgent: (agent: WorkerAgentStatus) => void
  setLiveMetrics: (metrics: LiveMetrics) => void
  
  setFileTree: (tree: FileNode[]) => void
  updateFileNode: (path: string, updates: Partial<FileNode>) => void
  addFileNode: (parentPath: string, node: FileNode) => void
  removeFileNode: (path: string) => void
  expandFolder: (path: string) => void
  collapseFolder: (path: string) => void
  addUploadProgress: (id: string, name: string, progress: number) => void
  updateUploadProgress: (id: string, progress: number) => void
  removeUploadProgress: (id: string) => void
  
  setCurrentFolder: (path: string) => void
  setSearchQuery: (query: string) => void
  setActivePanel: (panel: 'chat' | 'activity' | 'navigator') => void
  setConnectionStatus: (connected: boolean) => void
  setLoading: (loading: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        // Initial state
        messages: [],
        streamingMessageId: null,
        selectedFiles: [],
        tasks: [],
        agents: [],
        liveMetrics: null,
        fileTree: [],
        uploadProgress: {},
        currentFolder: '/',
        searchQuery: '',
        activePanel: 'chat',
        isConnected: false,
        isLoading: false,
        
        // Chat actions
        addMessage: (message) =>
          set((state) => {
            state.messages.push(message)
          }),
          
        updateMessage: (id, updates) =>
          set((state) => {
            const messageIndex = state.messages.findIndex(m => m.id === id)
            if (messageIndex !== -1) {
              Object.assign(state.messages[messageIndex], updates)
            }
          }),
          
        appendToStreamingMessage: (id, token) =>
          set((state) => {
            const message = state.messages.find(m => m.id === id)
            if (message) {
              message.content += token
            }
          }),
          
        setStreamingMessage: (id) =>
          set((state) => {
            state.streamingMessageId = id
          }),
          
        // File reference actions
        addFileReference: (file) =>
          set((state) => {
            if (!state.selectedFiles.find(f => f.id === file.id)) {
              state.selectedFiles.push(file)
            }
          }),
          
        removeFileReference: (id) =>
          set((state) => {
            state.selectedFiles = state.selectedFiles.filter(f => f.id !== id)
          }),
          
        clearFileReferences: () =>
          set((state) => {
            state.selectedFiles = []
          }),
          
        // Activity actions
        updateTask: (task) =>
          set((state) => {
            const existingIndex = state.tasks.findIndex(t => t.id === task.id)
            if (existingIndex !== -1) {
              state.tasks[existingIndex] = task
            } else {
              state.tasks.unshift(task)
            }
          }),
          
        updateAgent: (agent) =>
          set((state) => {
            const existingIndex = state.agents.findIndex(a => a.id === agent.id)
            if (existingIndex !== -1) {
              state.agents[existingIndex] = agent
            } else {
              state.agents.push(agent)
            }
          }),
          
        setLiveMetrics: (metrics) =>
          set((state) => {
            state.liveMetrics = metrics
          }),
          
        // Navigator actions
        setFileTree: (tree) =>
          set((state) => {
            state.fileTree = tree
          }),
          
        updateFileNode: (path, updates) =>
          set((state) => {
            const updateNodeRecursive = (nodes: FileNode[]): boolean => {
              for (const node of nodes) {
                if (node.path === path) {
                  Object.assign(node, updates)
                  return true
                }
                if (node.children && updateNodeRecursive(node.children)) {
                  return true
                }
              }
              return false
            }
            updateNodeRecursive(state.fileTree)
          }),

        addFileNode: (parentPath, node) =>
          set((state) => {
            const addNodeRecursive = (nodes: FileNode[]): boolean => {
              for (const parentNode of nodes) {
                if (parentNode.path === parentPath) {
                  if (!parentNode.children) {
                    parentNode.children = []
                  }
                  parentNode.children.push(node)
                  return true
                }
                if (parentNode.children && addNodeRecursive(parentNode.children)) {
                  return true
                }
              }
              return false
            }
            
            if (parentPath === '/') {
              state.fileTree.push(node)
            } else {
              addNodeRecursive(state.fileTree)
            }
          }),

        removeFileNode: (path) =>
          set((state) => {
            const removeNodeRecursive = (nodes: FileNode[]): FileNode[] => {
              return nodes.filter(node => {
                if (node.path === path) {
                  return false
                }
                if (node.children) {
                  node.children = removeNodeRecursive(node.children)
                }
                return true
              })
            }
            state.fileTree = removeNodeRecursive(state.fileTree)
          }),

        expandFolder: (path) =>
          set((state) => {
            const updateNodeRecursive = (nodes: FileNode[]): boolean => {
              for (const node of nodes) {
                if (node.path === path && node.type === 'folder') {
                  node.isExpanded = true
                  return true
                }
                if (node.children && updateNodeRecursive(node.children)) {
                  return true
                }
              }
              return false
            }
            updateNodeRecursive(state.fileTree)
          }),

        collapseFolder: (path) =>
          set((state) => {
            const updateNodeRecursive = (nodes: FileNode[]): boolean => {
              for (const node of nodes) {
                if (node.path === path && node.type === 'folder') {
                  node.isExpanded = false
                  return true
                }
                if (node.children && updateNodeRecursive(node.children)) {
                  return true
                }
              }
              return false
            }
            updateNodeRecursive(state.fileTree)
          }),
          
        addUploadProgress: (id, name, progress) =>
          set((state) => {
            state.uploadProgress[id] = { name, progress }
          }),
          
        updateUploadProgress: (id, progress) =>
          set((state) => {
            if (state.uploadProgress[id]) {
              state.uploadProgress[id].progress = progress
            }
          }),
          
        removeUploadProgress: (id) =>
          set((state) => {
            delete state.uploadProgress[id]
          }),
          
        // UI actions
        setCurrentFolder: (path) =>
          set((state) => {
            state.currentFolder = path
          }),
          
        setSearchQuery: (query) =>
          set((state) => {
            state.searchQuery = query
          }),
          
        setActivePanel: (panel) =>
          set((state) => {
            state.activePanel = panel
          }),
          
        setConnectionStatus: (connected) =>
          set((state) => {
            state.isConnected = connected
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading
          }),
      }))
    )
  )
)

// Selectors for optimized subscriptions
export const selectMessages = (state: WorkspaceState) => state.messages
export const selectStreamingMessage = (state: WorkspaceState) => 
  state.streamingMessageId ? state.messages.find(m => m.id === state.streamingMessageId) : null
export const selectSelectedFiles = (state: WorkspaceState) => state.selectedFiles
export const selectActiveTasks = (state: WorkspaceState) => 
  state.tasks.filter(t => t.status === 'running' || t.status === 'queued')
export const selectFileTree = (state: WorkspaceState) => state.fileTree
export const selectLiveMetrics = (state: WorkspaceState) => state.liveMetrics
export const selectCurrentFolder = (state: WorkspaceState) => state.currentFolder
export const selectIsLoading = (state: WorkspaceState) => state.isLoading 