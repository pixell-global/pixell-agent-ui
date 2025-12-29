'use client'
import React from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useNotificationStore, createJobNotification, createHypothesisNotification, createSystemNotification } from '@/stores/notification-store'

interface WebSocketMessage {
  type: string
  data: any
  timestamp?: string
}

class SimpleWebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private _isConnecting = false

  get isConnecting() {
    return this._isConnecting
  }

  connect() {
    if (this._isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔌 WebSocket already connecting, skipping...')
      return
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket already connected')
      return
    }

    this._isConnecting = true
    console.log('🔌 Connecting to WebSocket...')

    try {
      this.ws = new WebSocket('ws://localhost:3001/ws')
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected')
        this._isConnecting = false
        this.reconnectAttempts = 0
        this.startHeartbeat()
        
        // Update connection status
        try {
          useWorkspaceStore.getState().setConnectionStatus(true)
        } catch (error) {
          console.log('Store not ready yet')
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.log('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected')
        this._isConnecting = false
        this.stopHeartbeat()
        
        try {
          useWorkspaceStore.getState().setConnectionStatus(false)
        } catch (error) {
          console.log('Store not ready yet')
        }

        // Attempt reconnection if not at max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts)
        }
      }

      this.ws.onerror = (error) => {
        console.log('🚨 WebSocket error:', error)
        this._isConnecting = false
      }

    } catch (error) {
      console.log('Failed to create WebSocket:', error)
      this._isConnecting = false
    }
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('📨 Received:', message.type)
    
    try {
      const store = useWorkspaceStore.getState()
      const notificationStore = useNotificationStore.getState()
      
      switch (message.type) {
        case 'task_created':
        case 'task_updated':
        case 'task_completed':
          // Handle task updates - server sends task data directly in message.data
          const taskData = {
            id: message.data.id || 'unknown',
            name: message.data.name || 'Unknown Task',
            description: message.data.description || '',
            status: message.data.status || 'unknown',
            progress: message.data.progress || 0,
            agentId: message.data.agentId || 'unknown',
            agentName: message.data.agentName || 'Unknown Agent',
            startTime: message.data.createdAt || message.data.startTime || new Date().toISOString()
          }
          
          store.updateTask(taskData)
          console.log('📋 Task updated:', taskData.name, `${taskData.progress}%`, taskData.status)
          
          // Create notifications for task events
          if (message.type === 'task_created') {
            notificationStore.addEvent(createJobNotification('started', taskData.name, taskData.description))
          } else if (message.type === 'task_completed') {
            const isError = taskData.status === 'error' || taskData.status === 'failed'
            notificationStore.addEvent(createJobNotification(
              isError ? 'error' : 'success',
              taskData.name,
              isError ? 'Task failed to complete' : 'Task completed successfully'
            ))
          }
          break

        case 'live_metrics':
          // Handle metrics updates - server sends data.metrics, not data directly
          const metricsData = message.data.metrics || message.data
          const healthStatus = metricsData.runtime?.status === 'healthy' ? 'healthy' : 
                              metricsData.runtime?.status === 'error' ? 'error' : 'degraded'
          
          const metrics = {
            activeAgents: metricsData.agents?.online || metricsData.agents?.total || 0,
            tasksCompleted: metricsData.tasks?.recentCompletions || 0,
            tasksRunning: metricsData.tasks?.active || 0,
            tasksQueued: metricsData.tasks?.queued || 0,
            systemHealth: healthStatus as 'healthy' | 'degraded' | 'error',
            uptime: metricsData.runtime?.uptime ? `${metricsData.runtime.uptime}s` : '0s'
          }
          
          store.setLiveMetrics(metrics)
          console.log('📊 Metrics updated:', metrics)
          break

        // New notification-specific event handlers
        case 'job.error':
          notificationStore.addEvent(createJobNotification('error', message.data.jobName, message.data.error))
          break

        case 'job.success':
          notificationStore.addEvent(createJobNotification('success', message.data.jobName, message.data.description))
          break

        case 'hypothesis.win':
          notificationStore.addEvent(createHypothesisNotification('win', message.data.hypothesis, message.data.confidence))
          break

        case 'hypothesis.fail':
          notificationStore.addEvent(createHypothesisNotification('fail', message.data.hypothesis, message.data.confidence))
          break

        case 'system.alert':
          notificationStore.addEvent(createSystemNotification(message.data.title, message.data.description, message.data.persistent))
          break

        case 'data.ingest':
          notificationStore.addEvent({
            type: 'data.ingest',
            title: 'Data Ingestion Complete',
            description: `${message.data.recordCount} records processed from ${message.data.source}`,
          })
          break

        // Activity event handlers
        case 'activity_created':
          store.addActivity(message.data)
          console.log('📋 Activity created:', message.data.name)
          break

        case 'activity_updated':
          store.updateActivity(message.data)
          console.log('📋 Activity updated:', message.data.name, message.data.status)
          break

        case 'activity_progress':
          store.updateActivityProgress(message.data.id, message.data.progress, message.data.progressMessage)
          console.log('📊 Activity progress:', message.data.id, `${message.data.progress}%`)
          break

        case 'activity_completed':
          store.updateActivity(message.data)
          notificationStore.addEvent(createJobNotification('success', message.data.name, 'Activity completed successfully'))
          console.log('✅ Activity completed:', message.data.name)
          break

        case 'activity_failed':
          store.updateActivity(message.data)
          notificationStore.addEvent(createJobNotification('error', message.data.name, message.data.errorMessage || 'Activity failed'))
          console.log('❌ Activity failed:', message.data.name)
          break

        case 'activity_approval_requested':
          store.addActivityApprovalRequest(message.data.activityId, message.data.approvalRequest)
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Approval Required',
            description: message.data.approvalRequest.title,
          })
          console.log('🔔 Approval requested for activity:', message.data.activityId)
          break

        // Activity output handlers
        case 'activity_output_created':
          store.addActivityOutput(message.data)
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Output Ready',
            description: `${message.data.name} is available for download`,
          })
          console.log('📄 Activity output created:', message.data.name)
          break

        case 'activity_output_ready':
          // Output file is ready for download (e.g., after processing)
          store.addActivityOutput(message.data)
          console.log('📄 Activity output ready:', message.data.name)
          break

        // UPEE phase update handler
        case 'upee_phase_update':
          store.updateActivityUPEEPhase(
            message.data.activityId,
            message.data.phase,
            message.data.message,
            message.data.subTasks
          )
          console.log(`📊 UPEE phase: ${message.data.phase} - ${message.data.message}`)
          break

        // Incremental output creation (as files are being generated)
        case 'activity_output_incremental':
          const existingOutput = store.activityOutputs.find(o => o.id === message.data.id)
          if (!existingOutput) {
            store.addActivityOutput({
              ...message.data,
              metadata: {
                ...message.data.metadata,
                isIncremental: true,
              }
            })
            console.log('📄 Incremental output started:', message.data.name)
          }
          break

        // Output generation progress updates
        case 'activity_output_progress':
          console.log(`📄 Output progress: ${message.data.name} - ${message.data.progress}%`)
          break

        // =========================================================================
        // FILE CREATED EVENT HANDLER
        // =========================================================================

        case 'file_created':
          // Agent created a file - trigger Navigator refresh
          store.triggerFileTreeRefresh()
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'File Created',
            description: `${message.data.name} is ready for download`,
          })
          console.log('📁 File created, triggering Navigator refresh:', message.data.name)

          // CRITICAL FIX: Also add file output to chat message!
          // The file_created event comes via WebSocket AFTER SSE stream closes,
          // so we need to handle it here too
          console.log('📁💬 Adding file output to chat via WebSocket:', message.data)

          // Use dynamic import without await (handled asynchronously)
          import('@/stores/chat-store').then(({ useChatStore }) => {
            useChatStore.getState().handleStreamingChunk({
              type: 'file_created',
              path: message.data.path,
              name: message.data.name,
              format: message.data.format,
              size: message.data.size,
              summary: message.data.summary,
            })
          }).catch(err => {
            console.error('Failed to add file output to chat:', err)
          })
          break

        // =========================================================================
        // SCHEDULE EVENT HANDLERS
        // =========================================================================

        case 'schedule_proposal':
          // Agent proposed a new schedule - add to pending proposals
          store.addPendingProposal(message.data)
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Schedule Proposed',
            description: `"${message.data.name}" - ${message.data.scheduleDisplay}`,
          })
          console.log('⏰ Schedule proposed:', message.data.name)
          break

        case 'schedule_created':
          // New schedule was created
          store.addSchedule(message.data)
          // Remove from pending if it was from a proposal
          if (message.data.sourceProposalId) {
            store.removePendingProposal(message.data.sourceProposalId)
          }
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Schedule Created',
            description: `"${message.data.name}" is now active`,
          })
          console.log('⏰ Schedule created:', message.data.name)
          break

        case 'schedule_updated':
          // Schedule was modified
          store.updateSchedule(message.data)
          console.log('⏰ Schedule updated:', message.data.name)
          break

        case 'schedule_paused':
          // Schedule was paused
          store.updateScheduleStatus(message.data.id, 'paused')
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Schedule Paused',
            description: `"${message.data.name}" has been paused`,
          })
          console.log('⏸️ Schedule paused:', message.data.name)
          break

        case 'schedule_resumed':
          // Schedule was resumed
          store.updateScheduleStatus(message.data.id, 'active')
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Schedule Resumed',
            description: `"${message.data.name}" is now active again`,
          })
          console.log('▶️ Schedule resumed:', message.data.name)
          break

        case 'schedule_deleted':
          // Schedule was deleted
          store.removeSchedule(message.data.id)
          console.log('🗑️ Schedule deleted:', message.data.id)
          break

        case 'schedule_failed':
          // Schedule failed after too many consecutive failures
          store.updateScheduleStatus(message.data.id, 'failed')
          notificationStore.addEvent(createJobNotification(
            'error',
            message.data.name,
            'Schedule disabled due to consecutive failures'
          ))
          console.log('❌ Schedule failed:', message.data.name)
          break

        case 'execution_started':
          // A scheduled execution has started
          if (message.data.schedule) {
            store.updateSchedule({
              ...message.data.schedule,
              lastRunAt: new Date().toISOString(),
            })
          }
          console.log('🚀 Execution started:', message.data.scheduleId)
          break

        case 'execution_succeeded':
          // A scheduled execution completed successfully
          if (message.data.schedule) {
            store.updateSchedule(message.data.schedule)
          }
          notificationStore.addEvent(createJobNotification(
            'success',
            message.data.scheduleName || 'Scheduled Task',
            message.data.result?.summary || 'Execution completed successfully'
          ))
          console.log('✅ Execution succeeded:', message.data.scheduleId)
          break

        case 'execution_failed':
          // A scheduled execution failed
          if (message.data.schedule) {
            store.updateSchedule(message.data.schedule)
          }
          notificationStore.addEvent(createJobNotification(
            'error',
            message.data.scheduleName || 'Scheduled Task',
            message.data.error?.message || 'Execution failed'
          ))
          console.log('❌ Execution failed:', message.data.scheduleId, message.data.error?.message)
          break

        case 'execution_retrying':
          // Execution is retrying after failure
          console.log('🔄 Execution retrying:', message.data.scheduleId, `attempt ${message.data.retryAttempt}`)
          break

        case 'schedule_tier_limit':
          // User has reached their schedule tier limit
          notificationStore.addEvent({
            type: 'system.alert',
            title: 'Schedule Limit Reached',
            description: `You've reached your limit of ${message.data.limit} schedules. Upgrade your plan for more.`,
          })
          console.log('⚠️ Schedule tier limit reached:', message.data.limit)
          break

        case 'pong':
          // Heartbeat response
          break

        default:
          console.log('Unknown message type:', message.type)
      }
    } catch (error) {
      console.log('Error handling message:', error)
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 30 second heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }
}

// Single instance
const wsManager = new SimpleWebSocketManager()

// React hook
export function useWebSocket() {
  const connect = () => wsManager.connect()
  const disconnect = () => wsManager.disconnect()
  const send = (message: any) => wsManager.send(message)

  return { connect, disconnect, send }
}

// React hook for WebSocket lifecycle
export const useWebSocketLifecycle = () => {
  const isConnected = useWorkspaceStore(state => state.isConnected)
  const [hasInitialized, setHasInitialized] = React.useState(false)
  
  React.useEffect(() => {
    // Only connect once and prevent rapid reconnection attempts
    if (!hasInitialized && typeof window !== 'undefined') {
      setHasInitialized(true)
      
      // Initialize connection status to false
      try {
        useWorkspaceStore.getState().setConnectionStatus(false)
      } catch {
        // Ignore store access errors
      }
      
      // Delay initial connection to prevent race conditions
      const timer = setTimeout(() => {
        try {
          if (!wsManager.isConnecting) {
            wsManager.connect()
          }
        } catch {
          // Ignore connection errors
        }
      }, 500) // Increased delay to ensure components are ready
      
      return () => clearTimeout(timer)
    }
  }, [hasInitialized])
  
  return { 
    isConnected, 
    send: wsManager.send.bind(wsManager),
    connectionState: wsManager.isConnecting ? 'connecting' : 'connected',
    reconnect: () => {
      try {
        wsManager.connect()
      } catch {
        // Ignore reconnection errors
      }
    }
  }
}

// Helper function to check if WebSocket is in connecting state
function isWebSocketConnecting(): boolean {
  return wsManager.isConnecting
}

// Utility function to send messages via WebSocket
export const sendWebSocketMessage = (type: string, data: any) => {
  wsManager.send({ type, data })
}

// Utility function for common message types
export const webSocketActions = {
  sendChatMessage: (message: string, fileReferences?: any[]) => {
    sendWebSocketMessage('chat_message', { message, fileReferences })
  },

  requestTaskUpdate: (taskId: string) => {
    sendWebSocketMessage('request_task_update', { taskId })
  },

  requestAgentStatus: (agentId?: string) => {
    sendWebSocketMessage('request_agent_status', { agentId })
  },

  requestLiveMetrics: () => {
    sendWebSocketMessage('request_live_metrics', {})
  },

  // Activity-related actions
  requestActivityUpdate: (activityId: string) => {
    sendWebSocketMessage('request_activity_update', { activityId })
  },

  subscribeToActivity: (activityId: string) => {
    sendWebSocketMessage('subscribe_activity', { activityId })
  },

  unsubscribeFromActivity: (activityId: string) => {
    sendWebSocketMessage('unsubscribe_activity', { activityId })
  },

  requestActivitiesList: () => {
    sendWebSocketMessage('request_activities_list', {})
  },

  // Schedule-related actions
  requestSchedulesList: () => {
    sendWebSocketMessage('request_schedules_list', {})
  },

  subscribeToSchedule: (scheduleId: string) => {
    sendWebSocketMessage('subscribe_schedule', { scheduleId })
  },

  unsubscribeFromSchedule: (scheduleId: string) => {
    sendWebSocketMessage('unsubscribe_schedule', { scheduleId })
  },

  respondToScheduleProposal: (proposalId: string, action: 'confirm' | 'edit' | 'cancel', modifications?: any) => {
    sendWebSocketMessage('schedule_proposal_response', {
      proposalId,
      action,
      modifications,
    })
  },

  pauseSchedule: (scheduleId: string) => {
    sendWebSocketMessage('pause_schedule', { scheduleId })
  },

  resumeSchedule: (scheduleId: string) => {
    sendWebSocketMessage('resume_schedule', { scheduleId })
  },

  triggerScheduleRun: (scheduleId: string) => {
    sendWebSocketMessage('trigger_schedule_run', { scheduleId })
  },
}