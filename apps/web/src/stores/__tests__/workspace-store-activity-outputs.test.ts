/**
 * Workspace Store - Activity Outputs State Tests
 *
 * Comprehensive tests for the activity outputs state, actions, and selectors.
 * Covers the new ActivityOutput functionality added for the Activity Pane.
 */

import {
  useWorkspaceStore,
  selectActivityOutputs,
  selectActivityOutputsByActivityId,
  selectCompletedActivities,
  selectScheduledActivities,
  selectRunningActivities,
} from '../workspace-store'
import type { Activity } from '../workspace-store'
import type { ActivityOutput } from '@/types'

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

describe('Workspace Store - Activity Outputs State', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('Initial State', () => {
    it('should have empty activityOutputs array', () => {
      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs).toEqual([])
    })
  })

  describe('setActivityOutputs', () => {
    it('should set activity outputs array', () => {
      const outputs = [createMockActivityOutput(), createMockActivityOutput()]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      expect(useWorkspaceStore.getState().activityOutputs).toEqual(outputs)
    })

    it('should replace existing outputs', () => {
      const initial = [createMockActivityOutput({ id: 'old' })]
      const replacement = [createMockActivityOutput({ id: 'new' })]

      useWorkspaceStore.getState().setActivityOutputs(initial)
      useWorkspaceStore.getState().setActivityOutputs(replacement)

      expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(1)
      expect(useWorkspaceStore.getState().activityOutputs[0].id).toBe('new')
    })

    it('should handle empty array', () => {
      useWorkspaceStore.getState().setActivityOutputs([createMockActivityOutput()])
      useWorkspaceStore.getState().setActivityOutputs([])

      expect(useWorkspaceStore.getState().activityOutputs).toEqual([])
    })
  })

  describe('addActivityOutput', () => {
    it('should add output to beginning of array', () => {
      const first = createMockActivityOutput({ id: 'first', name: 'first.csv' })
      const second = createMockActivityOutput({ id: 'second', name: 'second.csv' })

      useWorkspaceStore.getState().addActivityOutput(first)
      useWorkspaceStore.getState().addActivityOutput(second)

      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs[0].id).toBe('second')
      expect(activityOutputs[1].id).toBe('first')
    })

    it('should not add duplicate output with same id', () => {
      const output = createMockActivityOutput({ id: 'same-id' })
      useWorkspaceStore.getState().addActivityOutput(output)
      useWorkspaceStore.getState().addActivityOutput({ ...output, name: 'Updated.csv' })

      expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(1)
    })

    it('should add outputs with different ids', () => {
      const output1 = createMockActivityOutput({ id: 'id-1' })
      const output2 = createMockActivityOutput({ id: 'id-2' })

      useWorkspaceStore.getState().addActivityOutput(output1)
      useWorkspaceStore.getState().addActivityOutput(output2)

      expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(2)
    })

    it('should handle different output types', () => {
      const csvOutput = createMockActivityOutput({ id: '1', type: 'csv', name: 'data.csv' })
      const excelOutput = createMockActivityOutput({ id: '2', type: 'excel', name: 'report.xlsx' })
      const pdfOutput = createMockActivityOutput({ id: '3', type: 'pdf', name: 'doc.pdf' })
      const jsonOutput = createMockActivityOutput({ id: '4', type: 'json', name: 'config.json' })

      useWorkspaceStore.getState().addActivityOutput(csvOutput)
      useWorkspaceStore.getState().addActivityOutput(excelOutput)
      useWorkspaceStore.getState().addActivityOutput(pdfOutput)
      useWorkspaceStore.getState().addActivityOutput(jsonOutput)

      const { activityOutputs } = useWorkspaceStore.getState()
      expect(activityOutputs).toHaveLength(4)
      expect(activityOutputs.map(o => o.type)).toContain('csv')
      expect(activityOutputs.map(o => o.type)).toContain('excel')
      expect(activityOutputs.map(o => o.type)).toContain('pdf')
      expect(activityOutputs.map(o => o.type)).toContain('json')
    })
  })

  describe('removeActivityOutput', () => {
    it('should remove output by id', () => {
      const outputs = [
        createMockActivityOutput({ id: 'keep' }),
        createMockActivityOutput({ id: 'remove' }),
      ]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      useWorkspaceStore.getState().removeActivityOutput('remove')

      const remaining = useWorkspaceStore.getState().activityOutputs
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('keep')
    })

    it('should do nothing for non-existent id', () => {
      const outputs = [createMockActivityOutput({ id: 'existing' })]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      useWorkspaceStore.getState().removeActivityOutput('non-existent')

      expect(useWorkspaceStore.getState().activityOutputs).toHaveLength(1)
    })

    it('should handle removing from empty array', () => {
      useWorkspaceStore.getState().removeActivityOutput('any-id')
      expect(useWorkspaceStore.getState().activityOutputs).toEqual([])
    })

    it('should remove multiple outputs correctly', () => {
      const outputs = [
        createMockActivityOutput({ id: '1' }),
        createMockActivityOutput({ id: '2' }),
        createMockActivityOutput({ id: '3' }),
      ]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      useWorkspaceStore.getState().removeActivityOutput('1')
      useWorkspaceStore.getState().removeActivityOutput('3')

      const remaining = useWorkspaceStore.getState().activityOutputs
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('2')
    })
  })
})

describe('Workspace Store - Activity Output Selectors', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('selectActivityOutputs', () => {
    it('should return all activity outputs', () => {
      const outputs = [
        createMockActivityOutput({ id: '1' }),
        createMockActivityOutput({ id: '2' }),
      ]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      const selected = selectActivityOutputs(useWorkspaceStore.getState())

      expect(selected).toHaveLength(2)
      expect(selected).toEqual(outputs)
    })

    it('should return empty array when no outputs', () => {
      const selected = selectActivityOutputs(useWorkspaceStore.getState())
      expect(selected).toEqual([])
    })
  })

  describe('selectActivityOutputsByActivityId', () => {
    it('should return outputs filtered by activity id', () => {
      const outputs = [
        createMockActivityOutput({ id: '1', activityId: 'activity-1' }),
        createMockActivityOutput({ id: '2', activityId: 'activity-2' }),
        createMockActivityOutput({ id: '3', activityId: 'activity-1' }),
      ]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      const selected = selectActivityOutputsByActivityId('activity-1')(useWorkspaceStore.getState())

      expect(selected).toHaveLength(2)
      expect(selected.every(o => o.activityId === 'activity-1')).toBe(true)
    })

    it('should return empty array for non-existent activity id', () => {
      const outputs = [createMockActivityOutput({ activityId: 'activity-1' })]
      useWorkspaceStore.getState().setActivityOutputs(outputs)

      const selected = selectActivityOutputsByActivityId('non-existent')(useWorkspaceStore.getState())

      expect(selected).toEqual([])
    })
  })
})

describe('Workspace Store - Enhanced Activity Selectors', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('selectCompletedActivities', () => {
    it('should return completed, failed, and cancelled activities', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'completed', completedAt: '2024-01-01T10:00:00Z' }),
        createMockActivity({ id: '2', status: 'failed', completedAt: '2024-01-01T11:00:00Z' }),
        createMockActivity({ id: '3', status: 'cancelled', completedAt: '2024-01-01T12:00:00Z' }),
        createMockActivity({ id: '4', status: 'running' }),
        createMockActivity({ id: '5', status: 'pending' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const completed = selectCompletedActivities(useWorkspaceStore.getState())

      expect(completed).toHaveLength(3)
      expect(completed.map(a => a.status)).toContain('completed')
      expect(completed.map(a => a.status)).toContain('failed')
      expect(completed.map(a => a.status)).toContain('cancelled')
    })

    it('should sort by completedAt descending (most recent first)', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'completed', completedAt: '2024-01-01T08:00:00Z' }),
        createMockActivity({ id: '2', status: 'completed', completedAt: '2024-01-01T12:00:00Z' }),
        createMockActivity({ id: '3', status: 'completed', completedAt: '2024-01-01T10:00:00Z' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const completed = selectCompletedActivities(useWorkspaceStore.getState())

      expect(completed[0].id).toBe('2') // 12:00
      expect(completed[1].id).toBe('3') // 10:00
      expect(completed[2].id).toBe('1') // 08:00
    })

    it('should fallback to updatedAt if completedAt is not set', () => {
      const activities = [
        createMockActivity({
          id: '1',
          status: 'completed',
          completedAt: undefined,
          updatedAt: '2024-01-01T08:00:00Z',
        }),
        createMockActivity({
          id: '2',
          status: 'completed',
          completedAt: '2024-01-01T10:00:00Z',
        }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const completed = selectCompletedActivities(useWorkspaceStore.getState())

      expect(completed[0].id).toBe('2') // completedAt 10:00
      expect(completed[1].id).toBe('1') // updatedAt 08:00
    })

    it('should return empty array when no completed activities', () => {
      const activities = [
        createMockActivity({ status: 'running' }),
        createMockActivity({ status: 'pending' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const completed = selectCompletedActivities(useWorkspaceStore.getState())

      expect(completed).toEqual([])
    })
  })

  describe('selectScheduledActivities', () => {
    it('should return only scheduled activities with pending status and scheduleNextRun', () => {
      const activities = [
        createMockActivity({
          id: '1',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: '2024-01-02T10:00:00Z',
        }),
        createMockActivity({
          id: '2',
          activityType: 'scheduled',
          status: 'running', // not pending
          scheduleNextRun: '2024-01-02T11:00:00Z',
        }),
        createMockActivity({
          id: '3',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: undefined, // no next run
        }),
        createMockActivity({
          id: '4',
          activityType: 'task', // not scheduled
          status: 'pending',
        }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const scheduled = selectScheduledActivities(useWorkspaceStore.getState())

      expect(scheduled).toHaveLength(1)
      expect(scheduled[0].id).toBe('1')
    })

    it('should sort by scheduleNextRun ascending (soonest first)', () => {
      const activities = [
        createMockActivity({
          id: '1',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: '2024-01-05T10:00:00Z',
        }),
        createMockActivity({
          id: '2',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: '2024-01-02T10:00:00Z',
        }),
        createMockActivity({
          id: '3',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: '2024-01-03T10:00:00Z',
        }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const scheduled = selectScheduledActivities(useWorkspaceStore.getState())

      expect(scheduled[0].id).toBe('2') // Jan 2
      expect(scheduled[1].id).toBe('3') // Jan 3
      expect(scheduled[2].id).toBe('1') // Jan 5
    })
  })

  describe('selectRunningActivities', () => {
    it('should return only running activities', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'running', progress: 25 }),
        createMockActivity({ id: '2', status: 'running', progress: 75 }),
        createMockActivity({ id: '3', status: 'pending' }),
        createMockActivity({ id: '4', status: 'completed' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const running = selectRunningActivities(useWorkspaceStore.getState())

      expect(running).toHaveLength(2)
      expect(running.every(a => a.status === 'running')).toBe(true)
    })

    it('should include progress information', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'running', progress: 50, progressMessage: 'Processing...' }),
      ]
      useWorkspaceStore.getState().setActivities(activities)

      const running = selectRunningActivities(useWorkspaceStore.getState())

      expect(running[0].progress).toBe(50)
      expect(running[0].progressMessage).toBe('Processing...')
    })
  })
})

describe('Workspace Store - Activity Output Integration', () => {
  beforeEach(() => {
    resetStore()
  })

  it('should handle activity with associated outputs', () => {
    // Create activity
    const activity = createMockActivity({
      id: 'activity-1',
      name: 'Data Analysis',
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
    useWorkspaceStore.getState().setActivities([activity])

    // Add outputs for this activity
    const outputs = [
      createMockActivityOutput({
        id: 'output-1',
        activityId: 'activity-1',
        name: 'analysis_results.csv',
        type: 'csv',
      }),
      createMockActivityOutput({
        id: 'output-2',
        activityId: 'activity-1',
        name: 'summary_report.pdf',
        type: 'pdf',
      }),
    ]
    outputs.forEach(o => useWorkspaceStore.getState().addActivityOutput(o))

    // Verify association
    const activityOutputs = selectActivityOutputsByActivityId('activity-1')(useWorkspaceStore.getState())
    expect(activityOutputs).toHaveLength(2)

    const completed = selectCompletedActivities(useWorkspaceStore.getState())
    expect(completed).toHaveLength(1)
  })

  it('should maintain outputs when activity is updated', () => {
    // Create activity and output
    const activity = createMockActivity({ id: 'activity-1', status: 'running', progress: 0 })
    useWorkspaceStore.getState().setActivities([activity])
    useWorkspaceStore.getState().addActivityOutput(
      createMockActivityOutput({ activityId: 'activity-1' })
    )

    // Update activity status
    useWorkspaceStore.getState().updateActivity({
      ...activity,
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
    })

    // Outputs should still exist
    const outputs = selectActivityOutputs(useWorkspaceStore.getState())
    expect(outputs).toHaveLength(1)
  })

  it('should handle outputs from multiple activities', () => {
    // Create multiple activities
    const activities = [
      createMockActivity({ id: 'activity-1', name: 'Task 1', status: 'completed' }),
      createMockActivity({ id: 'activity-2', name: 'Task 2', status: 'completed' }),
    ]
    useWorkspaceStore.getState().setActivities(activities)

    // Add outputs for each activity
    useWorkspaceStore.getState().addActivityOutput(
      createMockActivityOutput({ id: 'o1', activityId: 'activity-1', name: 'report1.csv' })
    )
    useWorkspaceStore.getState().addActivityOutput(
      createMockActivityOutput({ id: 'o2', activityId: 'activity-2', name: 'report2.csv' })
    )
    useWorkspaceStore.getState().addActivityOutput(
      createMockActivityOutput({ id: 'o3', activityId: 'activity-1', name: 'summary1.pdf' })
    )

    // Check all outputs
    const allOutputs = selectActivityOutputs(useWorkspaceStore.getState())
    expect(allOutputs).toHaveLength(3)

    // Check filtered outputs
    const activity1Outputs = selectActivityOutputsByActivityId('activity-1')(useWorkspaceStore.getState())
    expect(activity1Outputs).toHaveLength(2)

    const activity2Outputs = selectActivityOutputsByActivityId('activity-2')(useWorkspaceStore.getState())
    expect(activity2Outputs).toHaveLength(1)
  })
})

describe('Workspace Store - Activity Output Types', () => {
  it('should have correct ActivityOutputType values', () => {
    const validTypes: Array<ActivityOutput['type']> = [
      'csv',
      'excel',
      'pdf',
      'json',
      'text',
      'image',
      'other',
    ]
    expect(validTypes).toHaveLength(7)
  })

  it('should support all file metadata fields', () => {
    const output: ActivityOutput = {
      id: 'output-1',
      activityId: 'activity-1',
      name: 'large_dataset.csv',
      type: 'csv',
      size: 1024 * 1024 * 50, // 50MB
      sizeFormatted: '50 MB',
      mimeType: 'text/csv',
      storagePath: '/outputs/large_dataset.csv',
      storageProvider: 'supabase',
      downloadUrl: 'https://storage.example.com/outputs/large_dataset.csv',
      previewUrl: 'https://preview.example.com/outputs/large_dataset.csv',
      createdAt: new Date().toISOString(),
      metadata: {
        rowCount: 1000000,
      },
    }

    useWorkspaceStore.getState().addActivityOutput(output)

    const outputs = selectActivityOutputs(useWorkspaceStore.getState())
    expect(outputs[0]).toMatchObject({
      name: 'large_dataset.csv',
      sizeFormatted: '50 MB',
      downloadUrl: expect.stringContaining('https://'),
      metadata: { rowCount: 1000000 },
    })
  })
})
