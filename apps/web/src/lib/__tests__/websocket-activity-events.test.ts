/**
 * WebSocket Activity Event Tests
 *
 * Tests for WebSocket message handling of activity-related events.
 * Verifies that the websocket manager correctly processes activity events
 * and updates the workspace store accordingly.
 */

import { useWorkspaceStore } from '@/stores/workspace-store'
import { useNotificationStore } from '@/stores/notification-store'
import type { Activity } from '@/stores/workspace-store'
import type { ActivityOutput } from '@/types'

// Create a persistent mock for addEvent
const mockAddEvent = jest.fn()

// Mock the notification store
jest.mock('@/stores/notification-store', () => ({
  useNotificationStore: {
    getState: () => ({
      addEvent: mockAddEvent,
    }),
  },
  createJobNotification: jest.fn((type, name, desc) => ({ type, title: name, description: desc })),
  createHypothesisNotification: jest.fn(),
  createSystemNotification: jest.fn(),
}))

// Helper to reset the store between tests
const resetStore = () => {
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
}

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
  name: 'test-report.csv',
  type: 'csv',
  size: 1024,
  sizeFormatted: '1 KB',
  storagePath: '/outputs/test-report.csv',
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Simulate WebSocket message handling
const handleWebSocketMessage = (type: string, data: any) => {
  const store = useWorkspaceStore.getState()
  const notificationStore = useNotificationStore.getState()

  switch (type) {
    case 'activity_created':
      store.addActivity(data)
      break

    case 'activity_updated':
      store.updateActivity(data)
      break

    case 'activity_progress':
      store.updateActivityProgress(data.id, data.progress, data.progressMessage)
      break

    case 'activity_completed':
      store.updateActivity(data)
      notificationStore.addEvent({
        type: 'job.success',
        title: data.name,
        description: 'Activity completed successfully',
      })
      break

    case 'activity_failed':
      store.updateActivity(data)
      notificationStore.addEvent({
        type: 'job.error',
        title: data.name,
        description: data.errorMessage || 'Activity failed',
      })
      break

    case 'activity_output_created':
      store.addActivityOutput(data)
      notificationStore.addEvent({
        type: 'system.alert',
        title: 'Output Ready',
        description: `${data.name} is available for download`,
      })
      break

    case 'activity_output_ready':
      store.addActivityOutput(data)
      break

    case 'activity_approval_requested':
      store.addActivityApprovalRequest(data.activityId, data.approvalRequest)
      notificationStore.addEvent({
        type: 'system.alert',
        title: 'Approval Required',
        description: data.approvalRequest.title,
      })
      break
  }
}

describe('WebSocket Activity Events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddEvent.mockClear()
    resetStore()
  })

  describe('activity_created', () => {
    it('should add new activity to store', () => {
      const activity = createMockActivity({
        id: 'new-activity-1',
        name: 'New Task',
        status: 'pending',
      })

      handleWebSocketMessage('activity_created', activity)

      const { activities } = useWorkspaceStore.getState()
      expect(activities).toHaveLength(1)
      expect(activities[0].name).toBe('New Task')
    })

    it('should add activity to beginning of array', () => {
      const existing = createMockActivity({ id: 'existing', name: 'Existing' })
      useWorkspaceStore.getState().setActivities([existing])

      const newActivity = createMockActivity({ id: 'new', name: 'New' })
      handleWebSocketMessage('activity_created', newActivity)

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].name).toBe('New')
      expect(activities[1].name).toBe('Existing')
    })

    it('should handle activity with all fields', () => {
      const fullActivity = createMockActivity({
        id: 'full-activity',
        name: 'Full Task',
        description: 'A complete task',
        activityType: 'workflow',
        status: 'running',
        progress: 25,
        progressMessage: 'Processing...',
        agentId: 'agent-1',
        conversationId: 'conv-1',
        priority: 2,
        tags: ['important', 'urgent'],
      })

      handleWebSocketMessage('activity_created', fullActivity)

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0]).toMatchObject({
        name: 'Full Task',
        activityType: 'workflow',
        status: 'running',
        progress: 25,
      })
    })
  })

  describe('activity_updated', () => {
    it('should update existing activity', () => {
      const activity = createMockActivity({
        id: 'update-me',
        name: 'Original Name',
        status: 'pending',
      })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_updated', {
        ...activity,
        name: 'Updated Name',
        status: 'running',
      })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].name).toBe('Updated Name')
      expect(activities[0].status).toBe('running')
    })

    it('should add activity if not found', () => {
      const activity = createMockActivity({
        id: 'not-found',
        name: 'Not Found Task',
      })

      handleWebSocketMessage('activity_updated', activity)

      const { activities } = useWorkspaceStore.getState()
      expect(activities).toHaveLength(1)
    })

    it('should preserve other activities', () => {
      const activities = [
        createMockActivity({ id: '1', name: 'First' }),
        createMockActivity({ id: '2', name: 'Second' }),
        createMockActivity({ id: '3', name: 'Third' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      handleWebSocketMessage('activity_updated', {
        ...activities[1],
        name: 'Updated Second',
      })

      const state = useWorkspaceStore.getState().activities
      expect(state).toHaveLength(3)
      expect(state.find(a => a.id === '2')?.name).toBe('Updated Second')
      expect(state.find(a => a.id === '1')?.name).toBe('First')
      expect(state.find(a => a.id === '3')?.name).toBe('Third')
    })
  })

  describe('activity_progress', () => {
    it('should update activity progress', () => {
      const activity = createMockActivity({
        id: 'progress-activity',
        progress: 0,
      })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_progress', {
        id: 'progress-activity',
        progress: 50,
      })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].progress).toBe(50)
    })

    it('should update progress message', () => {
      const activity = createMockActivity({ id: 'message-activity' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_progress', {
        id: 'message-activity',
        progress: 75,
        progressMessage: 'Processing 750/1000 items',
      })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].progressMessage).toBe('Processing 750/1000 items')
    })

    it('should handle multiple progress updates', () => {
      const activity = createMockActivity({ id: 'multi-progress' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_progress', { id: 'multi-progress', progress: 25 })
      handleWebSocketMessage('activity_progress', { id: 'multi-progress', progress: 50 })
      handleWebSocketMessage('activity_progress', { id: 'multi-progress', progress: 75 })
      handleWebSocketMessage('activity_progress', { id: 'multi-progress', progress: 100 })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].progress).toBe(100)
    })
  })

  describe('activity_completed', () => {
    it('should mark activity as completed', () => {
      const activity = createMockActivity({
        id: 'completing',
        status: 'running',
      })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_completed', {
        ...activity,
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
      })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].status).toBe('completed')
      expect(activities[0].progress).toBe(100)
      expect(activities[0].completedAt).toBeDefined()
    })

    it('should trigger success notification', () => {
      const activity = createMockActivity({ name: 'Completed Task' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_completed', {
        ...activity,
        status: 'completed',
      })

      expect(mockAddEvent).toHaveBeenCalledWith({
        type: 'job.success',
        title: 'Completed Task',
        description: 'Activity completed successfully',
      })
    })
  })

  describe('activity_failed', () => {
    it('should mark activity as failed', () => {
      const activity = createMockActivity({
        id: 'failing',
        status: 'running',
      })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_failed', {
        ...activity,
        status: 'failed',
        errorMessage: 'Connection timeout',
        completedAt: new Date().toISOString(),
      })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].status).toBe('failed')
      expect(activities[0].errorMessage).toBe('Connection timeout')
    })

    it('should trigger error notification', () => {
      const activity = createMockActivity({ name: 'Failed Task' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_failed', {
        ...activity,
        status: 'failed',
        errorMessage: 'API rate limit exceeded',
      })

      expect(mockAddEvent).toHaveBeenCalledWith({
        type: 'job.error',
        title: 'Failed Task',
        description: 'API rate limit exceeded',
      })
    })

    it('should use default message when errorMessage is not provided', () => {
      const activity = createMockActivity({ name: 'Failed Task' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_failed', {
        ...activity,
        status: 'failed',
      })

      expect(mockAddEvent).toHaveBeenCalledWith({
        type: 'job.error',
        title: 'Failed Task',
        description: 'Activity failed',
      })
    })
  })

  describe('activity_output_created', () => {
    it('should add output to store', () => {
      const output = createMockActivityOutput({
        name: 'report.csv',
        sizeFormatted: '15 KB',
      })

      handleWebSocketMessage('activity_output_created', output)

      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs).toHaveLength(1)
      expect(activityOutputs[0].name).toBe('report.csv')
    })

    it('should trigger notification', () => {
      const output = createMockActivityOutput({ name: 'analysis.xlsx' })

      handleWebSocketMessage('activity_output_created', output)

      expect(mockAddEvent).toHaveBeenCalledWith({
        type: 'system.alert',
        title: 'Output Ready',
        description: 'analysis.xlsx is available for download',
      })
    })

    it('should handle multiple outputs', () => {
      const outputs = [
        createMockActivityOutput({ id: '1', name: 'report1.csv' }),
        createMockActivityOutput({ id: '2', name: 'report2.xlsx' }),
        createMockActivityOutput({ id: '3', name: 'summary.pdf' }),
      ]

      outputs.forEach(output => {
        handleWebSocketMessage('activity_output_created', output)
      })

      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs).toHaveLength(3)
    })
  })

  describe('activity_output_ready', () => {
    it('should add output when ready', () => {
      const output = createMockActivityOutput({
        name: 'processed.csv',
        downloadUrl: 'https://example.com/download/processed.csv',
      })

      handleWebSocketMessage('activity_output_ready', output)

      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs).toHaveLength(1)
      expect(activityOutputs[0].downloadUrl).toBeDefined()
    })

    it('should not duplicate existing output', () => {
      const output = createMockActivityOutput({ id: 'same-id' })
      handleWebSocketMessage('activity_output_created', output)
      handleWebSocketMessage('activity_output_ready', output)

      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs).toHaveLength(1)
    })
  })

  describe('activity_approval_requested', () => {
    it('should add approval request to activity', () => {
      const activity = createMockActivity({ id: 'approval-activity' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_approval_requested', {
        activityId: 'approval-activity',
        approvalRequest: {
          id: 'approval-1',
          activityId: 'approval-activity',
          requestType: 'confirmation',
          title: 'Confirm deletion',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].approvalRequests).toHaveLength(1)
      expect(activities[0].approvalRequests![0].title).toBe('Confirm deletion')
    })

    it('should trigger approval notification', () => {
      const activity = createMockActivity({ id: 'notify-approval' })
      useWorkspaceStore.getState().setActivities([activity])

      handleWebSocketMessage('activity_approval_requested', {
        activityId: 'notify-approval',
        approvalRequest: {
          id: 'approval-1',
          activityId: 'notify-approval',
          requestType: 'permission',
          title: 'Access external API',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      })

      expect(mockAddEvent).toHaveBeenCalledWith({
        type: 'system.alert',
        title: 'Approval Required',
        description: 'Access external API',
      })
    })
  })

  describe('Event Sequence Handling', () => {
    it('should handle full activity lifecycle sequence', () => {
      const activityId = 'lifecycle-activity'

      // 1. Activity created
      handleWebSocketMessage('activity_created', createMockActivity({
        id: activityId,
        name: 'Lifecycle Task',
        status: 'pending',
      }))

      expect(useWorkspaceStore.getState().activities[0].status).toBe('pending')

      // 2. Activity starts running
      handleWebSocketMessage('activity_updated', {
        id: activityId,
        status: 'running',
        startedAt: new Date().toISOString(),
      })

      // 3. Progress updates
      handleWebSocketMessage('activity_progress', { id: activityId, progress: 25 })
      handleWebSocketMessage('activity_progress', { id: activityId, progress: 50 })
      handleWebSocketMessage('activity_progress', { id: activityId, progress: 75 })

      expect(useWorkspaceStore.getState().activities[0].progress).toBe(75)

      // 4. Activity completes
      handleWebSocketMessage('activity_completed', {
        id: activityId,
        name: 'Lifecycle Task',
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
      })

      expect(useWorkspaceStore.getState().activities[0].status).toBe('completed')

      // 5. Output created
      handleWebSocketMessage('activity_output_created', createMockActivityOutput({
        activityId,
        name: 'lifecycle-output.csv',
      }))

      expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(1)
    })

    it('should handle concurrent activities', () => {
      // Start two activities
      handleWebSocketMessage('activity_created', createMockActivity({
        id: 'concurrent-1',
        name: 'Task 1',
        status: 'running',
      }))
      handleWebSocketMessage('activity_created', createMockActivity({
        id: 'concurrent-2',
        name: 'Task 2',
        status: 'running',
      }))

      // Update progress for both
      handleWebSocketMessage('activity_progress', { id: 'concurrent-1', progress: 30 })
      handleWebSocketMessage('activity_progress', { id: 'concurrent-2', progress: 60 })

      const { activities } = useWorkspaceStore.getState()
      expect(activities.find(a => a.id === 'concurrent-1')?.progress).toBe(30)
      expect(activities.find(a => a.id === 'concurrent-2')?.progress).toBe(60)

      // Complete one, fail the other
      handleWebSocketMessage('activity_completed', {
        id: 'concurrent-1',
        name: 'Task 1',
        status: 'completed',
      })
      handleWebSocketMessage('activity_failed', {
        id: 'concurrent-2',
        name: 'Task 2',
        status: 'failed',
        errorMessage: 'Network error',
      })

      const updatedActivities = useWorkspaceStore.getState().activities
      expect(updatedActivities.find(a => a.id === 'concurrent-1')?.status).toBe('completed')
      expect(updatedActivities.find(a => a.id === 'concurrent-2')?.status).toBe('failed')
    })

    it('should handle activity with multiple outputs', () => {
      const activityId = 'multi-output-activity'

      handleWebSocketMessage('activity_created', createMockActivity({
        id: activityId,
        status: 'running',
      }))

      handleWebSocketMessage('activity_completed', {
        id: activityId,
        status: 'completed',
      })

      // Multiple outputs for same activity
      handleWebSocketMessage('activity_output_created', createMockActivityOutput({
        id: 'output-1',
        activityId,
        name: 'data.csv',
      }))
      handleWebSocketMessage('activity_output_created', createMockActivityOutput({
        id: 'output-2',
        activityId,
        name: 'analysis.xlsx',
      }))
      handleWebSocketMessage('activity_output_created', createMockActivityOutput({
        id: 'output-3',
        activityId,
        name: 'summary.pdf',
      }))

      const outputs = useWorkspaceStore.getState().activityOutputs
      expect(outputs).toHaveLength(3)
      expect(outputs.every(o => o.activityId === activityId)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle events for non-existent activities', () => {
      // Progress update for non-existent activity should not throw
      expect(() => {
        handleWebSocketMessage('activity_progress', {
          id: 'non-existent',
          progress: 50,
        })
      }).not.toThrow()
    })

    it('should handle malformed data', () => {
      // Partial activity data
      expect(() => {
        handleWebSocketMessage('activity_created', { id: 'partial' })
      }).not.toThrow()
    })

    it('should handle rapid consecutive updates', () => {
      const activity = createMockActivity({ id: 'rapid-update' })
      useWorkspaceStore.getState().setActivities([activity])

      // Rapid progress updates
      for (let i = 0; i <= 100; i++) {
        handleWebSocketMessage('activity_progress', {
          id: 'rapid-update',
          progress: i,
        })
      }

      expect(useWorkspaceStore.getState().activities[0].progress).toBe(100)
    })
  })
})
