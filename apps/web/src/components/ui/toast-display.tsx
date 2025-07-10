'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/ui/toast-provider'
import { useNotificationStore } from '@/stores/notification-store'

export const ToastDisplay: React.FC = () => {
  const { addToast } = useToast()
  const events = useNotificationStore(state => state.events)

  useEffect(() => {
    // Listen for new events and convert them to toasts
    const latestEvent = events[0] // Most recent event
    if (latestEvent) {
      const toastType = (() => {
        switch (latestEvent.type) {
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

      addToast({
        type: toastType,
        title: latestEvent.title,
        description: latestEvent.description,
        persistent: latestEvent.persistent,
      })
    }
  }, [events.length, addToast]) // Only trigger when new events are added

  return null // This component doesn't render anything itself
}