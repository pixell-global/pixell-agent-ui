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
  messageType: 'text' | 'plan' | 'progress' | 'alert' | 'file_context' | 'code'
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

export interface KPIMetrics {
  activeJobs: number
  successRate: number
  averageRuntime: string
  queuedJobs: number
  totalJobsToday: number
  failedJobsToday: number
  systemUptime: string
  lastUpdated: string
}

// Activity types for Activity Pane
export type ActivityType = 'task' | 'scheduled' | 'workflow'
export type ActivityStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type ActivityStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
export type ApprovalRequestStatus = 'pending' | 'approved' | 'denied' | 'expired'

export interface ActivityStep {
  id: string
  activityId: string
  stepOrder: number
  name: string
  description?: string
  status: ActivityStepStatus
  startedAt?: string
  completedAt?: string
  result?: any
  errorMessage?: string
  createdAt: string
}

export interface ActivityApprovalRequest {
  id: string
  activityId: string
  requestType: 'permission' | 'confirmation' | 'input'
  title: string
  description?: string
  requiredScopes?: string[]
  options?: any
  status: ApprovalRequestStatus
  respondedAt?: string
  response?: any
  expiresAt?: string
  createdAt: string
}

export interface Activity {
  id: string
  orgId: string
  userId: string
  conversationId?: string
  agentId?: string
  name: string
  description?: string
  activityType: ActivityType
  status: ActivityStatus
  progress: number
  progressMessage?: string
  scheduleCron?: string
  scheduleNextRun?: string
  scheduleLastRun?: string
  scheduleTimezone?: string
  startedAt?: string
  completedAt?: string
  estimatedDurationMs?: number
  actualDurationMs?: number
  result?: any
  errorMessage?: string
  errorCode?: string
  metadata?: any
  tags?: string[]
  priority: number
  createdAt: string
  updatedAt: string
  archivedAt?: string
  // Joined data (loaded on detail view)
  steps?: ActivityStep[]
  approvalRequests?: ActivityApprovalRequest[]
}

export interface ActivityFilters {
  status: ActivityStatus[]
  type: ActivityType[]
  agent: string[]
  search: string
  archived: boolean
}

export interface ActivityCounts {
  total: number
  archived: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  byAgent: Record<string, number>
}

export interface JobData {
  id: string
  name: string
  description?: string
  status: 'running' | 'queued' | 'completed' | 'failed' | 'paused'
  progress: number
  startTime: string
  endTime?: string
  duration?: string
  agentId: string
  agentName: string
  priority: 'low' | 'medium' | 'high'
  tags?: string[]
  error?: string
}

interface WorkspaceState {
  // Chat State
  messages: ChatMessage[]
  streamingMessageId: string | null
  selectedFiles: FileReference[]

  // Activity State (legacy tasks)
  tasks: TaskActivity[]
  agents: WorkerAgentStatus[]
  liveMetrics: LiveMetrics | null

  // Activities State (new Activity Pane)
  activities: Activity[]
  activitiesLoading: boolean
  activitiesCursor: string | null
  activitiesHasMore: boolean
  activityFilters: ActivityFilters
  activityCounts: ActivityCounts | null

  // KPI State
  kpiMetrics: KPIMetrics | null
  recentJobs: JobData[]

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

  // Activities actions
  setActivities: (activities: Activity[]) => void
  appendActivities: (activities: Activity[]) => void
  addActivity: (activity: Activity) => void
  updateActivity: (activity: Activity) => void
  updateActivityProgress: (id: string, progress: number, progressMessage?: string) => void
  removeActivity: (id: string) => void
  setActivityFilters: (filters: Partial<ActivityFilters>) => void
  resetActivityFilters: () => void
  setActivityCounts: (counts: ActivityCounts) => void
  setActivitiesLoading: (loading: boolean) => void
  setActivitiesCursor: (cursor: string | null) => void
  setActivitiesHasMore: (hasMore: boolean) => void
  addActivityApprovalRequest: (activityId: string, request: ActivityApprovalRequest) => void
  updateActivityApprovalRequest: (activityId: string, requestId: string, updates: Partial<ActivityApprovalRequest>) => void

  setKPIMetrics: (metrics: KPIMetrics) => void
  setRecentJobs: (jobs: JobData[]) => void
  addJob: (job: JobData) => void
  updateJob: (id: string, updates: Partial<JobData>) => void

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
        // Activities state
        activities: [],
        activitiesLoading: false,
        activitiesCursor: null,
        activitiesHasMore: true,
        activityFilters: {
          status: [],
          type: [],
          agent: [],
          search: '',
          archived: false,
        },
        activityCounts: null,
        // KPI state
        kpiMetrics: null,
        recentJobs: [],
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

        // Activities actions
        setActivities: (activities) =>
          set((state) => {
            state.activities = activities
          }),

        appendActivities: (activities) =>
          set((state) => {
            // Append without duplicates
            const existingIds = new Set(state.activities.map(a => a.id))
            const newActivities = activities.filter(a => !existingIds.has(a.id))
            state.activities.push(...newActivities)
          }),

        addActivity: (activity) =>
          set((state) => {
            // Add to beginning (most recent first)
            const existingIndex = state.activities.findIndex(a => a.id === activity.id)
            if (existingIndex === -1) {
              state.activities.unshift(activity)
            }
          }),

        updateActivity: (activity) =>
          set((state) => {
            const existingIndex = state.activities.findIndex(a => a.id === activity.id)
            if (existingIndex !== -1) {
              state.activities[existingIndex] = { ...state.activities[existingIndex], ...activity }
            } else {
              // Activity doesn't exist, add it
              state.activities.unshift(activity)
            }
          }),

        updateActivityProgress: (id, progress, progressMessage) =>
          set((state) => {
            const activity = state.activities.find(a => a.id === id)
            if (activity) {
              activity.progress = progress
              if (progressMessage !== undefined) {
                activity.progressMessage = progressMessage
              }
            }
          }),

        removeActivity: (id) =>
          set((state) => {
            state.activities = state.activities.filter(a => a.id !== id)
          }),

        setActivityFilters: (filters) =>
          set((state) => {
            state.activityFilters = { ...state.activityFilters, ...filters }
          }),

        resetActivityFilters: () =>
          set((state) => {
            state.activityFilters = {
              status: [],
              type: [],
              agent: [],
              search: '',
              archived: false,
            }
          }),

        setActivityCounts: (counts) =>
          set((state) => {
            state.activityCounts = counts
          }),

        setActivitiesLoading: (loading) =>
          set((state) => {
            state.activitiesLoading = loading
          }),

        setActivitiesCursor: (cursor) =>
          set((state) => {
            state.activitiesCursor = cursor
          }),

        setActivitiesHasMore: (hasMore) =>
          set((state) => {
            state.activitiesHasMore = hasMore
          }),

        addActivityApprovalRequest: (activityId, request) =>
          set((state) => {
            const activity = state.activities.find(a => a.id === activityId)
            if (activity) {
              if (!activity.approvalRequests) {
                activity.approvalRequests = []
              }
              const existingIndex = activity.approvalRequests.findIndex(r => r.id === request.id)
              if (existingIndex === -1) {
                activity.approvalRequests.push(request)
              }
            }
          }),

        updateActivityApprovalRequest: (activityId, requestId, updates) =>
          set((state) => {
            const activity = state.activities.find(a => a.id === activityId)
            if (activity && activity.approvalRequests) {
              const request = activity.approvalRequests.find(r => r.id === requestId)
              if (request) {
                Object.assign(request, updates)
              }
            }
          }),

        // KPI actions
        setKPIMetrics: (metrics) =>
          set((state) => {
            state.kpiMetrics = metrics
          }),
          
        setRecentJobs: (jobs) =>
          set((state) => {
            state.recentJobs = jobs
          }),
          
        addJob: (job) =>
          set((state) => {
            state.recentJobs.unshift(job)
            // Keep only the last 50 jobs
            if (state.recentJobs.length > 50) {
              state.recentJobs = state.recentJobs.slice(0, 50)
            }
          }),
          
        updateJob: (id, updates) =>
          set((state) => {
            const jobIndex = state.recentJobs.findIndex(j => j.id === id)
            if (jobIndex !== -1) {
              Object.assign(state.recentJobs[jobIndex], updates)
            }
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
export const selectAgents = (state: WorkspaceState) => state.agents
export const selectFileTree = (state: WorkspaceState) => state.fileTree
export const selectLiveMetrics = (state: WorkspaceState) => state.liveMetrics
export const selectKPIMetrics = (state: WorkspaceState) => state.kpiMetrics
export const selectRecentJobs = (state: WorkspaceState) => state.recentJobs
export const selectActiveJobs = (state: WorkspaceState) => 
  state.recentJobs.filter(j => j.status === 'running' || j.status === 'queued')
export const selectCurrentFolder = (state: WorkspaceState) => state.currentFolder
export const selectIsLoading = (state: WorkspaceState) => state.isLoading

// Activity selectors
export const selectActivities = (state: WorkspaceState) => state.activities
export const selectActivitiesLoading = (state: WorkspaceState) => state.activitiesLoading
export const selectActivitiesCursor = (state: WorkspaceState) => state.activitiesCursor
export const selectActivitiesHasMore = (state: WorkspaceState) => state.activitiesHasMore
export const selectActivityFilters = (state: WorkspaceState) => state.activityFilters
export const selectActivityCounts = (state: WorkspaceState) => state.activityCounts

export const selectRunningActivities = (state: WorkspaceState) =>
  state.activities.filter(a => a.status === 'running')

export const selectPendingActivities = (state: WorkspaceState) =>
  state.activities.filter(a => a.status === 'pending')

export const selectScheduledActivities = (state: WorkspaceState) =>
  state.activities.filter(a => a.activityType === 'scheduled')

export const selectActivitiesWithApprovals = (state: WorkspaceState) =>
  state.activities.filter(a =>
    a.approvalRequests?.some(r => r.status === 'pending')
  )

export const selectActivityById = (id: string) => (state: WorkspaceState) =>
  state.activities.find(a => a.id === id) 