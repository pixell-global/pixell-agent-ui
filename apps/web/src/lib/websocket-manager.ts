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
  }
} 