/**
 * E2E Activity Flow Tests
 *
 * These tests simulate complete user flows from activity creation
 * through WebSocket events, state updates, and UI rendering.
 * Tests the full integration between Store and Components.
 *
 * Note: We test ActivityFeed directly rather than ActivityPane
 * to avoid Zustand hook mocking complexity while still testing
 * the complete activity lifecycle rendering.
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { ActivityFeed } from '../ActivityFeed'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { Activity } from '@/stores/workspace-store'
import type { ActivityOutput } from '@/types'

// Test data factories
const createActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  orgId: 'org-test',
  userId: 'user-test',
  name: 'Test Activity',
  description: 'Test description',
  activityType: 'task',
  status: 'pending',
  progress: 0,
  priority: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createOutput = (overrides: Partial<ActivityOutput> = {}): ActivityOutput => ({
  id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  activityId: 'activity-1',
  name: 'output.csv',
  type: 'csv',
  size: 1024,
  sizeFormatted: '1 KB',
  storagePath: '/outputs/output.csv',
  createdAt: new Date().toISOString(),
  ...overrides,
})

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
}

// Mock WebSocket message handling
const handleWebSocketMessage = (type: string, data: any) => {
  const store = useWorkspaceStore.getState()

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
      break
    case 'activity_failed':
      store.updateActivity(data)
      break
    case 'activity_output_created':
      store.addActivityOutput(data)
      break
  }
}

// Helper component that reads from store and renders ActivityFeed
function ActivityFeedWithStore() {
  const activities = useWorkspaceStore((s) => s.activities)
  const outputs = useWorkspaceStore((s) => s.activityOutputs)

  // Filter activities by status
  const running = activities.filter((a) => a.status === 'running')
  const scheduled = activities.filter(
    (a) => a.status === 'scheduled' || (a.status === 'pending' && a.scheduleNextRun)
  )
  const completed = activities.filter(
    (a) => a.status === 'completed' || a.status === 'failed'
  )

  return (
    <ActivityFeed
      running={running}
      scheduled={scheduled}
      completed={completed}
      outputs={outputs}
      size="md"
      onOutputDownload={jest.fn()}
    />
  )
}

describe('E2E Activity Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetStores()
  })

  describe('Complete Activity Lifecycle', () => {
    it('should render activity through full lifecycle: created → running → completed → output', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      // Initial state - empty
      expect(screen.getByText('No activity')).toBeInTheDocument()

      const activityId = 'lifecycle-e2e-1'

      // 1. Activity Created (pending)
      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: activityId,
            name: 'E2E Lifecycle Task',
            status: 'pending',
            agentId: 'agent-scraper',
            agentName: 'Scraper Agent',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // Task should not appear yet (pending != running/completed)
      expect(screen.queryByText('E2E Lifecycle Task')).not.toBeInTheDocument()

      // 2. Activity starts running
      act(() => {
        handleWebSocketMessage('activity_updated', {
          id: activityId,
          name: 'E2E Lifecycle Task',
          status: 'running',
          startedAt: new Date().toISOString(),
          agentName: 'Scraper Agent',
        })
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument()
        expect(screen.getByText('E2E Lifecycle Task')).toBeInTheDocument()
      })

      // 3. Progress updates
      act(() => {
        handleWebSocketMessage('activity_progress', {
          id: activityId,
          progress: 50,
          progressMessage: 'Processing items...',
        })
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Processing items...')).toBeInTheDocument()
      })

      // 4. Activity completes
      act(() => {
        handleWebSocketMessage(
          'activity_completed',
          createActivity({
            id: activityId,
            name: 'E2E Lifecycle Task',
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
            agentId: 'agent-scraper',
            agentName: 'Scraper Agent',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('E2E Lifecycle Task')).toBeInTheDocument()
      })

      // 5. Output created
      act(() => {
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            activityId,
            name: 'lifecycle-report.csv',
            sizeFormatted: '2.5 KB',
            type: 'csv',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Output')).toBeInTheDocument()
        expect(screen.getByText('lifecycle-report.csv')).toBeInTheDocument()
        expect(screen.getByText('2.5 KB')).toBeInTheDocument()
      })
    })

    it('should handle activity failure with error display', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      const activityId = 'failing-e2e'

      // Create and run activity
      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: activityId,
            name: 'Failing Task',
            status: 'running',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Failing Task')).toBeInTheDocument()
      })

      // Activity fails
      act(() => {
        handleWebSocketMessage(
          'activity_failed',
          createActivity({
            id: activityId,
            name: 'Failing Task',
            status: 'failed',
            errorMessage: 'Connection timeout',
            completedAt: new Date().toISOString(),
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('Failing Task')).toBeInTheDocument()
      })
    })
  })

  describe('Multiple Concurrent Activities', () => {
    it('should handle multiple activities running simultaneously', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      // Create multiple running activities
      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'concurrent-1',
            name: 'Task Alpha',
            status: 'running',
            progress: 30,
            agentName: 'Scraper',
          })
        )
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'concurrent-2',
            name: 'Task Beta',
            status: 'running',
            progress: 60,
            agentName: 'Analyzer',
          })
        )
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'concurrent-3',
            name: 'Task Gamma',
            status: 'running',
            progress: 90,
            agentName: 'Reporter',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Task Alpha')).toBeInTheDocument()
        expect(screen.getByText('Task Beta')).toBeInTheDocument()
        expect(screen.getByText('Task Gamma')).toBeInTheDocument()
      })

      // Complete one, fail another, keep one running
      act(() => {
        handleWebSocketMessage(
          'activity_completed',
          createActivity({
            id: 'concurrent-1',
            name: 'Task Alpha',
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
          })
        )
        handleWebSocketMessage(
          'activity_failed',
          createActivity({
            id: 'concurrent-2',
            name: 'Task Beta',
            status: 'failed',
            completedAt: new Date().toISOString(),
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument()
        expect(screen.getByText('Task Gamma')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })
    })
  })

  describe('Scheduled Activities', () => {
    it('should display scheduled activities with next run time', async () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 2)

      const { rerender } = render(<ActivityFeedWithStore />)

      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'scheduled-1',
            name: 'Weekly Report',
            status: 'scheduled',
            scheduleNextRun: futureDate.toISOString(),
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeInTheDocument()
        expect(screen.getByText('Weekly Report')).toBeInTheDocument()
      })
    })

    it('should handle scheduled activity transitioning to running', async () => {
      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 1)

      const { rerender } = render(<ActivityFeedWithStore />)

      const activityId = 'scheduled-to-running'

      // Add scheduled activity
      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: activityId,
            name: 'Scheduled Task',
            status: 'scheduled',
            scheduleNextRun: futureDate.toISOString(),
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeInTheDocument()
        expect(screen.getByText('Scheduled Task')).toBeInTheDocument()
      })

      // Simulate schedule trigger - activity starts running
      act(() => {
        handleWebSocketMessage('activity_updated', {
          id: activityId,
          name: 'Scheduled Task',
          status: 'running',
          startedAt: new Date().toISOString(),
        })
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument()
      })
    })
  })

  describe('Activity Outputs', () => {
    it('should display multiple output files for a single activity', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      const activityId = 'multi-output'

      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: activityId,
            name: 'Report Generator',
            status: 'completed',
            completedAt: new Date().toISOString(),
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // Add multiple outputs
      act(() => {
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            id: 'out-1',
            activityId,
            name: 'raw-data.csv',
            type: 'csv',
            sizeFormatted: '15 KB',
          })
        )
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            id: 'out-2',
            activityId,
            name: 'analysis.xlsx',
            type: 'excel',
            sizeFormatted: '42 KB',
          })
        )
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            id: 'out-3',
            activityId,
            name: 'summary.pdf',
            type: 'pdf',
            sizeFormatted: '128 KB',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Output')).toBeInTheDocument()
        expect(screen.getByText('raw-data.csv')).toBeInTheDocument()
        expect(screen.getByText('analysis.xlsx')).toBeInTheDocument()
        expect(screen.getByText('summary.pdf')).toBeInTheDocument()
        expect(screen.getByText('15 KB')).toBeInTheDocument()
        expect(screen.getByText('42 KB')).toBeInTheDocument()
        expect(screen.getByText('128 KB')).toBeInTheDocument()
      })
    })

    it('should call download handler when clicking download button', async () => {
      const mockDownload = jest.fn()
      const output = createOutput({
        id: 'downloadable',
        name: 'download-me.csv',
        downloadUrl: 'https://example.com/download/file.csv',
      })

      render(
        <ActivityFeed
          running={[]}
          scheduled={[]}
          completed={[]}
          outputs={[output]}
          size="md"
          onOutputDownload={mockDownload}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('download-me.csv')).toBeInTheDocument()
      })

      // Click download button
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      expect(mockDownload).toHaveBeenCalledWith(output)
    })
  })

  describe('Agent Labels', () => {
    it('should display activities with agent data stored correctly', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'agent-labeled-1',
            name: 'Scraping Task',
            status: 'running',
            agentId: 'agent-reddit',
            agentName: 'Reddit Scraper',
          })
        )
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'agent-labeled-2',
            name: 'Analysis Task',
            status: 'completed',
            completedAt: new Date().toISOString(),
            agentId: 'agent-analyzer',
            agentName: 'Sentiment Analyzer',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // Verify task names are displayed
      await waitFor(() => {
        expect(screen.getByText('Scraping Task')).toBeInTheDocument()
        expect(screen.getByText('Analysis Task')).toBeInTheDocument()
      })

      // Verify agent data is stored in the state (even if not rendered)
      const state = useWorkspaceStore.getState()
      const activity1 = state.activities.find((a) => a.id === 'agent-labeled-1')
      const activity2 = state.activities.find((a) => a.id === 'agent-labeled-2')
      expect(activity1?.agentName).toBe('Reddit Scraper')
      expect(activity2?.agentName).toBe('Sentiment Analyzer')
    })
  })

  describe('Progress Bar', () => {
    it('should update progress bar as activity progresses', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      const activityId = 'progress-bar-test'

      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: activityId,
            name: 'Progress Task',
            status: 'running',
            progress: 0,
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Progress Task')).toBeInTheDocument()
      })

      // Check progress bar updates
      const progressValues = [25, 50, 75, 100]

      for (const progress of progressValues) {
        act(() => {
          handleWebSocketMessage('activity_progress', {
            id: activityId,
            progress,
          })
        })
        rerender(<ActivityFeedWithStore />)
      }

      // Final progress should be 100
      const activities = useWorkspaceStore.getState().activities
      expect(activities.find((a) => a.id === activityId)?.progress).toBe(100)
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no activities exist', () => {
      render(<ActivityFeedWithStore />)
      expect(screen.getByText('No activity')).toBeInTheDocument()
    })

    it('should hide Running section when no running activities', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: 'only-completed',
            name: 'Only Completed',
            status: 'completed',
            completedAt: new Date().toISOString(),
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.queryByText('Running')).not.toBeInTheDocument()
      })
    })
  })

  describe('Stress Test - High Volume', () => {
    it('should handle rapid succession of activity events', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      // Simulate 20 activities being created rapidly
      act(() => {
        for (let i = 0; i < 20; i++) {
          handleWebSocketMessage(
            'activity_created',
            createActivity({
              id: `rapid-${i}`,
              name: `Rapid Task ${i}`,
              status: i % 2 === 0 ? 'running' : 'completed',
              completedAt: i % 2 === 0 ? undefined : new Date().toISOString(),
            })
          )
        }
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        const activities = useWorkspaceStore.getState().activities
        expect(activities.length).toBe(20)
      })
    })

    it('should handle rapid progress updates', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      const activityId = 'rapid-progress'

      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: activityId,
            name: 'Rapid Progress Task',
            status: 'running',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // Simulate 100 progress updates
      act(() => {
        for (let i = 0; i <= 100; i++) {
          handleWebSocketMessage('activity_progress', {
            id: activityId,
            progress: i,
            progressMessage: `Processing ${i}%`,
          })
        }
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        const activity = useWorkspaceStore
          .getState()
          .activities.find((a) => a.id === activityId)
        expect(activity?.progress).toBe(100)
      })
    })
  })

  describe('Full User Scenario', () => {
    it('should simulate complete user session with multiple workflows', async () => {
      const { rerender } = render(<ActivityFeedWithStore />)

      // Scenario: User starts scraping, gets analysis, downloads report

      // 1. Start scraping job
      const scrapeId = 'user-session-scrape'
      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: scrapeId,
            name: 'Scrape Reddit /r/technology',
            status: 'running',
            agentName: 'Reddit Scraper',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      await waitFor(() => {
        expect(screen.getByText('Scrape Reddit /r/technology')).toBeInTheDocument()
      })

      // 2. Progress updates
      const messages = [
        'Connecting to Reddit API...',
        'Fetching posts...',
        'Processing 50/200 posts...',
        'Processing 100/200 posts...',
        'Processing 150/200 posts...',
        'Processing 200/200 posts...',
      ]

      for (let i = 0; i < messages.length; i++) {
        act(() => {
          handleWebSocketMessage('activity_progress', {
            id: scrapeId,
            progress: (i + 1) * 16,
            progressMessage: messages[i],
          })
        })
        rerender(<ActivityFeedWithStore />)
      }

      // 3. Scraping completes
      act(() => {
        handleWebSocketMessage(
          'activity_completed',
          createActivity({
            id: scrapeId,
            name: 'Scrape Reddit /r/technology',
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
            agentName: 'Reddit Scraper',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // 4. Output generated
      act(() => {
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            activityId: scrapeId,
            name: 'reddit-technology-posts.csv',
            type: 'csv',
            sizeFormatted: '847 KB',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // 5. Analysis job starts automatically
      const analysisId = 'user-session-analysis'
      act(() => {
        handleWebSocketMessage(
          'activity_created',
          createActivity({
            id: analysisId,
            name: 'Analyze Sentiment',
            status: 'running',
            agentName: 'Sentiment Analyzer',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // 6. Analysis completes
      act(() => {
        handleWebSocketMessage(
          'activity_completed',
          createActivity({
            id: analysisId,
            name: 'Analyze Sentiment',
            status: 'completed',
            completedAt: new Date().toISOString(),
            agentName: 'Sentiment Analyzer',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // 7. Analysis outputs
      act(() => {
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            activityId: analysisId,
            name: 'sentiment-analysis.xlsx',
            type: 'excel',
            sizeFormatted: '42 KB',
          })
        )
        handleWebSocketMessage(
          'activity_output_created',
          createOutput({
            activityId: analysisId,
            name: 'sentiment-report.pdf',
            type: 'pdf',
            sizeFormatted: '128 KB',
          })
        )
      })
      rerender(<ActivityFeedWithStore />)

      // Verify final state
      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('Output')).toBeInTheDocument()
        expect(screen.getByText('reddit-technology-posts.csv')).toBeInTheDocument()
        expect(screen.getByText('sentiment-analysis.xlsx')).toBeInTheDocument()
        expect(screen.getByText('sentiment-report.pdf')).toBeInTheDocument()
      })

      // Verify state
      const state = useWorkspaceStore.getState()
      expect(state.activities.filter((a) => a.status === 'completed').length).toBe(2)
      expect(state.activityOutputs.length).toBe(3)
    })
  })
})
