/**
 * Workspace Store - Activities State Tests
 *
 * Tests for the activities-related state and actions in the workspace store.
 */

import {
  useWorkspaceStore,
  selectRunningActivities,
  selectPendingActivities,
  selectScheduledActivities,
  selectActivitiesWithApprovals,
  selectActivityById,
} from '../workspace-store'
import type {
  Activity,
  ActivityApprovalRequest,
  ActivityFilters,
  ActivityCounts,
} from '../workspace-store'

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

const createMockApprovalRequest = (
  overrides: Partial<ActivityApprovalRequest> = {}
): ActivityApprovalRequest => ({
  id: `approval-${Math.random().toString(36).substr(2, 9)}`,
  activityId: 'activity-1',
  requestType: 'confirmation',
  title: 'Test Approval',
  status: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('Workspace Store - Activities State', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('Initial State', () => {
    it('should have empty activities array', () => {
      const { activities } = useWorkspaceStore.getState()
      expect(activities).toEqual([])
    })

    it('should not be loading initially', () => {
      const { activitiesLoading } = useWorkspaceStore.getState()
      expect(activitiesLoading).toBe(false)
    })

    it('should have null cursor initially', () => {
      const { activitiesCursor } = useWorkspaceStore.getState()
      expect(activitiesCursor).toBeNull()
    })

    it('should have hasMore true initially', () => {
      const { activitiesHasMore } = useWorkspaceStore.getState()
      expect(activitiesHasMore).toBe(true)
    })

    it('should have default filters', () => {
      const { activityFilters } = useWorkspaceStore.getState()
      expect(activityFilters).toEqual({
        status: [],
        type: [],
        agent: [],
        search: '',
        archived: false,
      })
    })

    it('should have null counts initially', () => {
      const { activityCounts } = useWorkspaceStore.getState()
      expect(activityCounts).toBeNull()
    })
  })

  describe('setActivities', () => {
    it('should set activities array', () => {
      const activities = [createMockActivity(), createMockActivity()]
      useWorkspaceStore.getState().setActivities(activities)

      expect(useWorkspaceStore.getState().activities).toEqual(activities)
    })

    it('should replace existing activities', () => {
      const initial = [createMockActivity({ id: 'old' })]
      const replacement = [createMockActivity({ id: 'new' })]

      useWorkspaceStore.getState().setActivities(initial)
      useWorkspaceStore.getState().setActivities(replacement)

      expect(useWorkspaceStore.getState().activities).toHaveLength(1)
      expect(useWorkspaceStore.getState().activities[0].id).toBe('new')
    })
  })

  describe('appendActivities', () => {
    it('should append activities to existing array', () => {
      const initial = [createMockActivity({ id: 'first' })]
      const additional = [createMockActivity({ id: 'second' })]

      useWorkspaceStore.getState().setActivities(initial)
      useWorkspaceStore.getState().appendActivities(additional)

      expect(useWorkspaceStore.getState().activities).toHaveLength(2)
    })

    it('should not add duplicates', () => {
      const activity = createMockActivity({ id: 'same-id' })
      useWorkspaceStore.getState().setActivities([activity])
      useWorkspaceStore.getState().appendActivities([{ ...activity }])

      expect(useWorkspaceStore.getState().activities).toHaveLength(1)
    })
  })

  describe('addActivity', () => {
    it('should add activity to beginning', () => {
      const first = createMockActivity({ id: 'first' })
      const second = createMockActivity({ id: 'second' })

      useWorkspaceStore.getState().addActivity(first)
      useWorkspaceStore.getState().addActivity(second)

      const { activities } = useWorkspaceStore.getState()
      expect(activities[0].id).toBe('second')
      expect(activities[1].id).toBe('first')
    })

    it('should not add duplicate', () => {
      const activity = createMockActivity({ id: 'same' })
      useWorkspaceStore.getState().addActivity(activity)
      useWorkspaceStore.getState().addActivity({ ...activity, name: 'Updated' })

      expect(useWorkspaceStore.getState().activities).toHaveLength(1)
    })
  })

  describe('updateActivity', () => {
    it('should update existing activity', () => {
      const activity = createMockActivity({ id: 'test', status: 'pending' })
      useWorkspaceStore.getState().setActivities([activity])

      useWorkspaceStore.getState().updateActivity({
        ...activity,
        status: 'running',
        progress: 50,
      })

      const updated = useWorkspaceStore.getState().activities[0]
      expect(updated.status).toBe('running')
      expect(updated.progress).toBe(50)
    })

    it('should add activity if not found', () => {
      const activity = createMockActivity({ id: 'new' })
      useWorkspaceStore.getState().updateActivity(activity)

      expect(useWorkspaceStore.getState().activities).toHaveLength(1)
    })
  })

  describe('updateActivityProgress', () => {
    it('should update progress value', () => {
      const activity = createMockActivity({ id: 'test', progress: 0 })
      useWorkspaceStore.getState().setActivities([activity])

      useWorkspaceStore.getState().updateActivityProgress('test', 75)

      expect(useWorkspaceStore.getState().activities[0].progress).toBe(75)
    })

    it('should update progress message if provided', () => {
      const activity = createMockActivity({ id: 'test' })
      useWorkspaceStore.getState().setActivities([activity])

      useWorkspaceStore.getState().updateActivityProgress('test', 50, 'Processing...')

      const updated = useWorkspaceStore.getState().activities[0]
      expect(updated.progress).toBe(50)
      expect(updated.progressMessage).toBe('Processing...')
    })

    it('should not update non-existent activity', () => {
      useWorkspaceStore.getState().updateActivityProgress('non-existent', 100)
      expect(useWorkspaceStore.getState().activities).toHaveLength(0)
    })
  })

  describe('removeActivity', () => {
    it('should remove activity by id', () => {
      const activities = [
        createMockActivity({ id: 'keep' }),
        createMockActivity({ id: 'remove' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      useWorkspaceStore.getState().removeActivity('remove')

      const remaining = useWorkspaceStore.getState().activities
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('keep')
    })
  })

  describe('setActivityFilters', () => {
    it('should update partial filters', () => {
      useWorkspaceStore.getState().setActivityFilters({ status: ['running'] })

      const { activityFilters } = useWorkspaceStore.getState()
      expect(activityFilters.status).toEqual(['running'])
      expect(activityFilters.type).toEqual([])
    })

    it('should merge multiple filter updates', () => {
      useWorkspaceStore.getState().setActivityFilters({ status: ['running'] })
      useWorkspaceStore.getState().setActivityFilters({ type: ['scheduled'] })

      const { activityFilters } = useWorkspaceStore.getState()
      expect(activityFilters.status).toEqual(['running'])
      expect(activityFilters.type).toEqual(['scheduled'])
    })
  })

  describe('resetActivityFilters', () => {
    it('should reset all filters to defaults', () => {
      useWorkspaceStore.getState().setActivityFilters({
        status: ['running'],
        type: ['task'],
        agent: ['agent-1'],
        search: 'test',
        archived: true,
      })

      useWorkspaceStore.getState().resetActivityFilters()

      const { activityFilters } = useWorkspaceStore.getState()
      expect(activityFilters).toEqual({
        status: [],
        type: [],
        agent: [],
        search: '',
        archived: false,
      })
    })
  })

  describe('setActivityCounts', () => {
    it('should set counts object', () => {
      const counts: ActivityCounts = {
        total: 100,
        archived: 10,
        byStatus: { running: 5, pending: 10, completed: 85 },
        byType: { task: 80, scheduled: 15, workflow: 5 },
        byAgent: { 'agent-1': 50, 'agent-2': 50 },
      }

      useWorkspaceStore.getState().setActivityCounts(counts)

      expect(useWorkspaceStore.getState().activityCounts).toEqual(counts)
    })
  })

  describe('setActivitiesLoading', () => {
    it('should set loading state', () => {
      useWorkspaceStore.getState().setActivitiesLoading(true)
      expect(useWorkspaceStore.getState().activitiesLoading).toBe(true)

      useWorkspaceStore.getState().setActivitiesLoading(false)
      expect(useWorkspaceStore.getState().activitiesLoading).toBe(false)
    })
  })

  describe('setActivitiesCursor', () => {
    it('should set cursor value', () => {
      useWorkspaceStore.getState().setActivitiesCursor('cursor-123')
      expect(useWorkspaceStore.getState().activitiesCursor).toBe('cursor-123')
    })

    it('should allow setting cursor to null', () => {
      useWorkspaceStore.getState().setActivitiesCursor('cursor-123')
      useWorkspaceStore.getState().setActivitiesCursor(null)
      expect(useWorkspaceStore.getState().activitiesCursor).toBeNull()
    })
  })

  describe('setActivitiesHasMore', () => {
    it('should set hasMore flag', () => {
      useWorkspaceStore.getState().setActivitiesHasMore(false)
      expect(useWorkspaceStore.getState().activitiesHasMore).toBe(false)
    })
  })

  describe('addActivityApprovalRequest', () => {
    it('should add approval request to activity', () => {
      const activity = createMockActivity({ id: 'activity-1' })
      useWorkspaceStore.getState().setActivities([activity])

      const approval = createMockApprovalRequest({ activityId: 'activity-1' })
      useWorkspaceStore.getState().addActivityApprovalRequest('activity-1', approval)

      const updated = useWorkspaceStore.getState().activities[0]
      expect(updated.approvalRequests).toHaveLength(1)
      expect(updated.approvalRequests![0].id).toBe(approval.id)
    })

    it('should not add duplicate approval request', () => {
      const activity = createMockActivity({ id: 'activity-1' })
      useWorkspaceStore.getState().setActivities([activity])

      const approval = createMockApprovalRequest({ id: 'approval-1', activityId: 'activity-1' })
      useWorkspaceStore.getState().addActivityApprovalRequest('activity-1', approval)
      useWorkspaceStore.getState().addActivityApprovalRequest('activity-1', { ...approval })

      const updated = useWorkspaceStore.getState().activities[0]
      expect(updated.approvalRequests).toHaveLength(1)
    })

    it('should do nothing for non-existent activity', () => {
      const approval = createMockApprovalRequest()
      useWorkspaceStore.getState().addActivityApprovalRequest('non-existent', approval)
      expect(useWorkspaceStore.getState().activities).toHaveLength(0)
    })
  })

  describe('updateActivityApprovalRequest', () => {
    it('should update approval request status', () => {
      const activity = createMockActivity({
        id: 'activity-1',
        approvalRequests: [createMockApprovalRequest({ id: 'approval-1', status: 'pending' })],
      })
      useWorkspaceStore.getState().setActivities([activity])

      useWorkspaceStore.getState().updateActivityApprovalRequest('activity-1', 'approval-1', {
        status: 'approved',
        respondedAt: new Date().toISOString(),
      })

      const updated = useWorkspaceStore.getState().activities[0]
      expect(updated.approvalRequests![0].status).toBe('approved')
      expect(updated.approvalRequests![0].respondedAt).toBeDefined()
    })
  })
})

describe('Workspace Store - Activity Selectors', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('selectRunningActivities', () => {
    it('should return only running activities', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'running' }),
        createMockActivity({ id: '2', status: 'pending' }),
        createMockActivity({ id: '3', status: 'running' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const running = selectRunningActivities(useWorkspaceStore.getState())

      expect(running).toHaveLength(2)
      expect(running.every((a) => a.status === 'running')).toBe(true)
    })
  })

  describe('selectPendingActivities', () => {
    it('should return only pending activities', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'pending' }),
        createMockActivity({ id: '2', status: 'running' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const pending = selectPendingActivities(useWorkspaceStore.getState())

      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBe('1')
    })
  })

  describe('selectScheduledActivities', () => {
    it('should return only scheduled type activities', () => {
      const activities = [
        createMockActivity({ id: '1', activityType: 'scheduled' }),
        createMockActivity({ id: '2', activityType: 'task' }),
        createMockActivity({ id: '3', activityType: 'scheduled' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const scheduled = selectScheduledActivities(useWorkspaceStore.getState())

      expect(scheduled).toHaveLength(2)
      expect(scheduled.every((a) => a.activityType === 'scheduled')).toBe(true)
    })
  })

  describe('selectActivitiesWithApprovals', () => {
    it('should return activities with pending approval requests', () => {
      const activities = [
        createMockActivity({
          id: '1',
          approvalRequests: [createMockApprovalRequest({ status: 'pending' })],
        }),
        createMockActivity({
          id: '2',
          approvalRequests: [createMockApprovalRequest({ status: 'approved' })],
        }),
        createMockActivity({
          id: '3',
          approvalRequests: [],
        }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const withApprovals = selectActivitiesWithApprovals(useWorkspaceStore.getState())

      expect(withApprovals).toHaveLength(1)
      expect(withApprovals[0].id).toBe('1')
    })
  })

  describe('selectActivityById', () => {
    it('should return activity by id', () => {
      const activities = [
        createMockActivity({ id: '1', name: 'First' }),
        createMockActivity({ id: '2', name: 'Second' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const activity = selectActivityById('2')(useWorkspaceStore.getState())

      expect(activity?.name).toBe('Second')
    })

    it('should return undefined for non-existent id', () => {
      const activity = selectActivityById('non-existent')(useWorkspaceStore.getState())

      expect(activity).toBeUndefined()
    })
  })
})

describe('Workspace Store - Activity Types', () => {
  it('should have correct ActivityStatus type values', () => {
    const validStatuses: Array<Activity['status']> = [
      'pending',
      'running',
      'paused',
      'completed',
      'failed',
      'cancelled',
    ]
    expect(validStatuses).toHaveLength(6)
  })

  it('should have correct ActivityType type values', () => {
    const validTypes: Array<Activity['activityType']> = ['task', 'scheduled', 'workflow']
    expect(validTypes).toHaveLength(3)
  })

  it('should have correct ApprovalRequestStatus type values', () => {
    const validStatuses: Array<ActivityApprovalRequest['status']> = [
      'pending',
      'approved',
      'denied',
      'expired',
    ]
    expect(validStatuses).toHaveLength(4)
  })

  it('should have correct ActivityApprovalRequest requestType values', () => {
    const validTypes: Array<ActivityApprovalRequest['requestType']> = [
      'permission',
      'confirmation',
      'input',
    ]
    expect(validTypes).toHaveLength(3)
  })
})
