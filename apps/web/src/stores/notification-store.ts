import { create } from 'zustand'
import { useToast, ToastItem, ToastType } from '@/components/ui/toast-provider'

export interface NotificationEvent {
  id: string
  type: 'job.error' | 'job.success' | 'job.started' | 'hypothesis.win' | 'hypothesis.fail' | 'data.ingest' | 'system.alert'
  timestamp: string
  title: string
  description?: string
  metadata?: Record<string, any>
  persistent?: boolean
}

interface NotificationStore {
  events: NotificationEvent[]
  addEvent: (event: Omit<NotificationEvent, 'id' | 'timestamp'>) => void
  removeEvent: (id: string) => void
  clearEvents: () => void
  markAsRead: (id: string) => void
  getUnreadCount: () => number
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  events: [],
  
  addEvent: (event) => {
    const id = Math.random().toString(36).substr(2, 9)
    const timestamp = new Date().toISOString()
    const newEvent: NotificationEvent = {
      id,
      timestamp,
      ...event,
    }
    
    set(state => ({
      events: [newEvent, ...state.events].slice(0, 100) // Keep last 100 events
    }))
  },

  removeEvent: (id) => {
    set(state => ({
      events: state.events.filter(event => event.id !== id)
    }))
  },

  clearEvents: () => {
    set({ events: [] })
  },

  markAsRead: (id) => {
    set(state => ({
      events: state.events.map(event => 
        event.id === id ? { ...event, read: true } : event
      )
    }))
  },

  getUnreadCount: () => {
    return get().events.filter(event => !('read' in event) || !event.read).length
  },
}))

// Hook to integrate notification store with toast system
export const useNotificationToast = () => {
  const addEvent = useNotificationStore(state => state.addEvent)
  
  const showNotification = (event: Omit<NotificationEvent, 'id' | 'timestamp'>) => {
    // Add to notification store
    addEvent(event)
    
    // Convert to toast type
    const toastType: ToastType = (() => {
      switch (event.type) {
        case 'job.error':
        case 'hypothesis.fail':
          return 'error'
        case 'job.success':
        case 'hypothesis.win':
          return 'success'
        case 'job.started':
        case 'data.ingest':
          return 'info'
        case 'system.alert':
          return 'warning'
        default:
          return 'info'
      }
    })()
    
    // Show toast notification
    // This will be wired up in the WebSocket handler
    return {
      type: toastType,
      title: event.title,
      description: event.description,
      persistent: event.persistent
    }
  }
  
  return { showNotification }
}

// Helper functions for common notification patterns
export const createJobNotification = (
  status: 'started' | 'success' | 'error',
  jobName: string,
  description?: string
): Omit<NotificationEvent, 'id' | 'timestamp'> => ({
  type: `job.${status}` as NotificationEvent['type'],
  title: `Job ${status === 'started' ? 'Started' : status === 'success' ? 'Completed' : 'Failed'}: ${jobName}`,
  description,
  persistent: status === 'error'
})

export const createHypothesisNotification = (
  result: 'win' | 'fail',
  hypothesis: string,
  confidence?: number
): Omit<NotificationEvent, 'id' | 'timestamp'> => ({
  type: `hypothesis.${result}`,
  title: `Hypothesis ${result === 'win' ? 'Validated' : 'Rejected'}`,
  description: `${hypothesis}${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`,
  persistent: result === 'win'
})

export const createSystemNotification = (
  title: string,
  description?: string,
  persistent = false
): Omit<NotificationEvent, 'id' | 'timestamp'> => ({
  type: 'system.alert',
  title,
  description,
  persistent
})