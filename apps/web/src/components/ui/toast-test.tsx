'use client'

import { Button } from '@/components/ui/button'
import { useNotificationStore, createJobNotification, createHypothesisNotification, createSystemNotification } from '@/stores/notification-store'

export const ToastTest: React.FC = () => {
  const addEvent = useNotificationStore(state => state.addEvent)

  const testToasts = () => {
    // Test different types of notifications
    addEvent(createJobNotification('success', 'Data Processing', 'Successfully processed 1,000 records'))
    
    setTimeout(() => {
      addEvent(createJobNotification('error', 'API Sync', 'Failed to sync with external API'))
    }, 1000)
    
    setTimeout(() => {
      addEvent(createHypothesisNotification('win', 'Revenue will increase by 15% with new campaign', 0.85))
    }, 2000)
    
    setTimeout(() => {
      addEvent(createSystemNotification('System Update', 'New features available', false))
    }, 3000)
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold mb-2">Toast System Test</h3>
      <Button onClick={testToasts} variant="outline">
        Test Notifications
      </Button>
    </div>
  )
}