/**
 * WebSocket Integration Tests
 *
 * Tests the integration between WebSocket manager and stores
 * for activity-related functionality. Simulates real WebSocket
 * message flow and verifies store updates.
 */

import { useWorkspaceStore } from '@/stores/workspace-store'
import { useNotificationStore } from '@/stores/notification-store'
import type { Activity } from '@/stores/workspace-store'
import type { ActivityOutput } from '@/types'

// Mock notification store
const mockAddEvent = jest.fn()
jest.mock('@/stores/notification-store', () => ({
  useNotificationStore: {
    getState: () => ({
      addEvent: mockAddEvent,
    }),
  },
  createJobNotification: jest.fn((type, name, desc) => ({
    type,
    title: name,
    description: desc,
  })),
  createHypothesisNotification: jest.fn(),
  createSystemNotification: jest.fn(),
}))

// Test data factories
const createMockActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: `activity-${Math.random().toString(36).substr(2, 9)}`,
  orgId: 'org-1',
  userId: 'user-1',
  name: 'Test Activity',
  description: 'A test activity',
  activityType: 'task',
  status: 'pending',
  progress: 0,
  priority: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createMockActivityOutput = (overrides: Partial<ActivityOutput> = {}): ActivityOutput => ({
  id: `output-${Math.random().toString(36).substr(2, 9)}`,
  activityId: 'activity-1',
  name: 'test-file.csv',
  type: 'csv',
  size: 1024,
  sizeFormatted: '1 KB',
  storagePath: '/outputs/test-file.csv',
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Simulates the WebSocket message handler from websocket-manager.ts
class MockWebSocketManager {
  private isConnected = false

  handleMessage(event: { type: string; data: any }) {
    const store = useWorkspaceStore.getState()
    const notificationStore = useNotificationStore.getState()

    switch (event.type) {
      case 'connected':
        this.isConnected = true
        useWorkspaceStore.setState({ isConnected: true })
        break

      case 'disconnected':
        this.isConnected = false
        useWorkspaceStore.setState({ isConnected: false })
        break

      case 'activity_created':
        store.addActivity(event.data)
        break

      case 'activity_updated':
        store.updateActivity(event.data)
        break

      case 'activity_progress':
        store.updateActivityProgress(
          event.data.id,
          event.data.progress,
          event.data.progressMessage
        )
        break

      case 'activity_completed':
        store.updateActivity(event.data)
        notificationStore.addEvent({
          type: 'job.success',
          title: event.data.name,
          description: 'Activity completed successfully',
        })
        break

      case 'activity_failed':
        store.updateActivity(event.data)
        notificationStore.addEvent({
          type: 'job.error',
          title: event.data.name,
          description: event.data.errorMessage || 'Activity failed',
        })
        break

      case 'activity_output_created':
        store.addActivityOutput(event.data)
        notificationStore.addEvent({
          type: 'system.alert',
          title: 'Output Ready',
          description: `${event.data.name} is available for download`,
        })
        break

      case 'activity_output_ready':
        store.addActivityOutput(event.data)
        break

      case 'activity_approval_requested':
        store.addActivityApprovalRequest(
          event.data.activityId,
          event.data.approvalRequest
        )
        notificationStore.addEvent({
          type: 'system.alert',
          title: 'Approval Required',
          description: event.data.approvalRequest.title,
        })
        break
    }
  }

  getConnectionStatus() {
    return this.isConnected
  }
}

// Reset stores between tests
const resetStores = () => {
  useWorkspaceStore.setState({
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
    activityOutputs: [],
    isConnected: false,
  })
  mockAddEvent.mockClear()
}

describe('WebSocket Manager Integration', () => {
  let wsManager: MockWebSocketManager

  beforeEach(() => {
    resetStores()
    wsManager = new MockWebSocketManager()
  })

  describe('Connection Lifecycle', () => {
    it('should update connection status on connect', () => {
      wsManager.handleMessage({ type: 'connected', data: {} })
      expect(useWorkspaceStore.getState().isConnected).toBe(true)
    })

    it('should update connection status on disconnect', () => {
      wsManager.handleMessage({ type: 'connected', data: {} })
      wsManager.handleMessage({ type: 'disconnected', data: {} })
      expect(useWorkspaceStore.getState().isConnected).toBe(false)
    })

    it('should track connection status correctly', () => {
      expect(wsManager.getConnectionStatus()).toBe(false)
      wsManager.handleMessage({ type: 'connected', data: {} })
      expect(wsManager.getConnectionStatus()).toBe(true)
    })
  })

  describe('Activity Message Handling', () => {
    describe('activity_created', () => {
      it('should add activity to store', () => {
        const activity = createMockActivity({ name: 'New Activity' })
        wsManager.handleMessage({ type: 'activity_created', data: activity })

        const state = useWorkspaceStore.getState()
        expect(state.activities).toHaveLength(1)
        expect(state.activities[0].name).toBe('New Activity')
      })

      it('should prepend new activity to existing list', () => {
        // Add existing activity
        const existing = createMockActivity({ id: 'existing', name: 'Existing' })
        useWorkspaceStore.getState().setActivities([existing])

        // Add new activity via WebSocket
        const newActivity = createMockActivity({ id: 'new', name: 'New' })
        wsManager.handleMessage({ type: 'activity_created', data: newActivity })

        const state = useWorkspaceStore.getState()
        expect(state.activities).toHaveLength(2)
        expect(state.activities[0].name).toBe('New')
        expect(state.activities[1].name).toBe('Existing')
      })
    })

    describe('activity_updated', () => {
      it('should update existing activity', () => {
        const activity = createMockActivity({ id: 'update-test', status: 'pending' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_updated',
          data: { ...activity, status: 'running' },
        })

        expect(useWorkspaceStore.getState().activities[0].status).toBe('running')
      })

      it('should add activity if not found', () => {
        const activity = createMockActivity({ id: 'not-found' })
        wsManager.handleMessage({ type: 'activity_updated', data: activity })

        expect(useWorkspaceStore.getState().activities).toHaveLength(1)
      })
    })

    describe('activity_progress', () => {
      it('should update progress value', () => {
        const activity = createMockActivity({ id: 'progress-test', progress: 0 })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_progress',
          data: { id: 'progress-test', progress: 50 },
        })

        expect(useWorkspaceStore.getState().activities[0].progress).toBe(50)
      })

      it('should update progress message', () => {
        const activity = createMockActivity({ id: 'message-test' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_progress',
          data: {
            id: 'message-test',
            progress: 75,
            progressMessage: 'Processing items...',
          },
        })

        const state = useWorkspaceStore.getState()
        expect(state.activities[0].progress).toBe(75)
        expect(state.activities[0].progressMessage).toBe('Processing items...')
      })
    })

    describe('activity_completed', () => {
      it('should mark activity as completed', () => {
        const activity = createMockActivity({ id: 'complete-test', status: 'running' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_completed',
          data: { ...activity, status: 'completed', name: 'Completed Task' },
        })

        expect(useWorkspaceStore.getState().activities[0].status).toBe('completed')
      })

      it('should trigger success notification', () => {
        const activity = createMockActivity({ name: 'Task Complete' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_completed',
          data: { ...activity, status: 'completed' },
        })

        expect(mockAddEvent).toHaveBeenCalledWith({
          type: 'job.success',
          title: 'Task Complete',
          description: 'Activity completed successfully',
        })
      })
    })

    describe('activity_failed', () => {
      it('should mark activity as failed', () => {
        const activity = createMockActivity({ id: 'fail-test', status: 'running' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_failed',
          data: { ...activity, status: 'failed', errorMessage: 'Network error' },
        })

        const state = useWorkspaceStore.getState()
        expect(state.activities[0].status).toBe('failed')
        expect(state.activities[0].errorMessage).toBe('Network error')
      })

      it('should trigger error notification with error message', () => {
        const activity = createMockActivity({ name: 'Failed Task' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_failed',
          data: { ...activity, status: 'failed', errorMessage: 'API timeout' },
        })

        expect(mockAddEvent).toHaveBeenCalledWith({
          type: 'job.error',
          title: 'Failed Task',
          description: 'API timeout',
        })
      })

      it('should use default error message when none provided', () => {
        const activity = createMockActivity({ name: 'Failed Task' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_failed',
          data: { ...activity, status: 'failed' },
        })

        expect(mockAddEvent).toHaveBeenCalledWith({
          type: 'job.error',
          title: 'Failed Task',
          description: 'Activity failed',
        })
      })
    })
  })

  describe('Output Message Handling', () => {
    describe('activity_output_created', () => {
      it('should add output to store', () => {
        const output = createMockActivityOutput({ name: 'report.csv' })
        wsManager.handleMessage({ type: 'activity_output_created', data: output })

        const state = useWorkspaceStore.getState()
        expect(state.activityOutputs).toHaveLength(1)
        expect(state.activityOutputs[0].name).toBe('report.csv')
      })

      it('should trigger notification for new output', () => {
        const output = createMockActivityOutput({ name: 'analysis.xlsx' })
        wsManager.handleMessage({ type: 'activity_output_created', data: output })

        expect(mockAddEvent).toHaveBeenCalledWith({
          type: 'system.alert',
          title: 'Output Ready',
          description: 'analysis.xlsx is available for download',
        })
      })

      it('should handle multiple outputs', () => {
        wsManager.handleMessage({
          type: 'activity_output_created',
          data: createMockActivityOutput({ id: '1', name: 'file1.csv' }),
        })
        wsManager.handleMessage({
          type: 'activity_output_created',
          data: createMockActivityOutput({ id: '2', name: 'file2.xlsx' }),
        })
        wsManager.handleMessage({
          type: 'activity_output_created',
          data: createMockActivityOutput({ id: '3', name: 'file3.pdf' }),
        })

        expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(3)
      })
    })

    describe('activity_output_ready', () => {
      it('should add output with download URL', () => {
        const output = createMockActivityOutput({
          name: 'ready.csv',
          downloadUrl: 'https://example.com/download/ready.csv',
        })
        wsManager.handleMessage({ type: 'activity_output_ready', data: output })

        const state = useWorkspaceStore.getState()
        expect(state.activityOutputs[0].downloadUrl).toBe(
          'https://example.com/download/ready.csv'
        )
      })

      it('should not trigger notification (unlike activity_output_created)', () => {
        const output = createMockActivityOutput()
        wsManager.handleMessage({ type: 'activity_output_ready', data: output })

        expect(mockAddEvent).not.toHaveBeenCalled()
      })
    })
  })

  describe('Approval Request Handling', () => {
    describe('activity_approval_requested', () => {
      it('should add approval request to activity', () => {
        const activity = createMockActivity({ id: 'approval-activity' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_approval_requested',
          data: {
            activityId: 'approval-activity',
            approvalRequest: {
              id: 'approval-1',
              activityId: 'approval-activity',
              requestType: 'confirmation',
              title: 'Confirm Action',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          },
        })

        const state = useWorkspaceStore.getState()
        expect(state.activities[0].approvalRequests).toHaveLength(1)
        expect(state.activities[0].approvalRequests![0].title).toBe('Confirm Action')
      })

      it('should trigger approval notification', () => {
        const activity = createMockActivity({ id: 'notify-activity' })
        useWorkspaceStore.getState().setActivities([activity])

        wsManager.handleMessage({
          type: 'activity_approval_requested',
          data: {
            activityId: 'notify-activity',
            approvalRequest: {
              id: 'approval-1',
              activityId: 'notify-activity',
              requestType: 'permission',
              title: 'Permission Required',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          },
        })

        expect(mockAddEvent).toHaveBeenCalledWith({
          type: 'system.alert',
          title: 'Approval Required',
          description: 'Permission Required',
        })
      })
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle complete activity workflow', () => {
      const activityId = 'workflow-activity'

      // 1. Activity created
      wsManager.handleMessage({
        type: 'activity_created',
        data: createMockActivity({
          id: activityId,
          name: 'Workflow Task',
          status: 'pending',
        }),
      })
      expect(useWorkspaceStore.getState().activities[0].status).toBe('pending')

      // 2. Activity starts
      wsManager.handleMessage({
        type: 'activity_updated',
        data: { id: activityId, status: 'running' },
      })
      expect(useWorkspaceStore.getState().activities[0].status).toBe('running')

      // 3. Progress updates
      for (let progress = 0; progress <= 100; progress += 25) {
        wsManager.handleMessage({
          type: 'activity_progress',
          data: { id: activityId, progress },
        })
      }
      expect(useWorkspaceStore.getState().activities[0].progress).toBe(100)

      // 4. Activity completes
      wsManager.handleMessage({
        type: 'activity_completed',
        data: createMockActivity({
          id: activityId,
          name: 'Workflow Task',
          status: 'completed',
        }),
      })
      expect(useWorkspaceStore.getState().activities[0].status).toBe('completed')

      // 5. Output created
      wsManager.handleMessage({
        type: 'activity_output_created',
        data: createMockActivityOutput({
          activityId,
          name: 'workflow-output.csv',
        }),
      })
      expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(1)

      // Verify notifications
      expect(mockAddEvent).toHaveBeenCalledTimes(2) // completed + output
    })

    it('should handle concurrent activities independently', () => {
      // Create two activities
      wsManager.handleMessage({
        type: 'activity_created',
        data: createMockActivity({ id: 'concurrent-1', name: 'Task 1', status: 'running' }),
      })
      wsManager.handleMessage({
        type: 'activity_created',
        data: createMockActivity({ id: 'concurrent-2', name: 'Task 2', status: 'running' }),
      })

      expect(useWorkspaceStore.getState().activities).toHaveLength(2)

      // Update progress independently
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'concurrent-1', progress: 30 },
      })
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'concurrent-2', progress: 70 },
      })

      const activities = useWorkspaceStore.getState().activities
      expect(activities.find((a) => a.id === 'concurrent-1')?.progress).toBe(30)
      expect(activities.find((a) => a.id === 'concurrent-2')?.progress).toBe(70)

      // Complete one, fail the other
      wsManager.handleMessage({
        type: 'activity_completed',
        data: { id: 'concurrent-1', name: 'Task 1', status: 'completed' },
      })
      wsManager.handleMessage({
        type: 'activity_failed',
        data: { id: 'concurrent-2', name: 'Task 2', status: 'failed', errorMessage: 'Error' },
      })

      const finalActivities = useWorkspaceStore.getState().activities
      expect(finalActivities.find((a) => a.id === 'concurrent-1')?.status).toBe('completed')
      expect(finalActivities.find((a) => a.id === 'concurrent-2')?.status).toBe('failed')
    })

    it('should handle rapid message bursts', () => {
      // Simulate burst of 50 messages
      for (let i = 0; i < 50; i++) {
        wsManager.handleMessage({
          type: 'activity_created',
          data: createMockActivity({
            id: `burst-${i}`,
            name: `Burst Activity ${i}`,
            status: 'completed',
          }),
        })
      }

      expect(useWorkspaceStore.getState().activities).toHaveLength(50)
    })

    it('should maintain data integrity with interleaved messages', () => {
      const activities = [
        { id: 'interleaved-1', name: 'Task 1' },
        { id: 'interleaved-2', name: 'Task 2' },
        { id: 'interleaved-3', name: 'Task 3' },
      ]

      // Create all activities
      activities.forEach((a) => {
        wsManager.handleMessage({
          type: 'activity_created',
          data: createMockActivity({ ...a, status: 'running' }),
        })
      })

      // Interleaved progress updates
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'interleaved-1', progress: 10 },
      })
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'interleaved-2', progress: 20 },
      })
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'interleaved-3', progress: 30 },
      })
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'interleaved-1', progress: 50 },
      })
      wsManager.handleMessage({
        type: 'activity_progress',
        data: { id: 'interleaved-2', progress: 60 },
      })

      const state = useWorkspaceStore.getState()
      expect(state.activities.find((a) => a.id === 'interleaved-1')?.progress).toBe(50)
      expect(state.activities.find((a) => a.id === 'interleaved-2')?.progress).toBe(60)
      expect(state.activities.find((a) => a.id === 'interleaved-3')?.progress).toBe(30)
    })
  })
})
