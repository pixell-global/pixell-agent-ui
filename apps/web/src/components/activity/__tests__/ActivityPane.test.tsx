/**
 * ActivityPane Integration Tests
 *
 * Tests the ActivityPane component with mocked stores, WebSocket, and API calls.
 * Covers the full integration flow including real-time updates and user interactions.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ActivityPane } from '../activity-pane'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useUIStore } from '@/stores/ui-store'
import type { Activity } from '@/stores/workspace-store'
import type { ActivityOutput } from '@/types'

// Mock the WebSocket manager
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockSend = jest.fn()

jest.mock('@/lib/websocket-manager', () => ({
  useWebSocket: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    send: mockSend,
  }),
}))

// Mock the UI store
jest.mock('@/stores/ui-store', () => ({
  useUIStore: jest.fn(),
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
  name: 'test-report.csv',
  type: 'csv',
  size: 1024,
  sizeFormatted: '1 KB',
  storagePath: '/outputs/test-report.csv',
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Helper to reset stores
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

describe('ActivityPane', () => {
  let mockToggleRightPanelCollapsed: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    resetStores()

    mockToggleRightPanelCollapsed = jest.fn()
    ;(useUIStore as unknown as jest.Mock).mockReturnValue(mockToggleRightPanelCollapsed)
  })

  describe('Rendering', () => {
    it('should render activity pane with header', () => {
      render(<ActivityPane />)

      expect(screen.getByText('Activity')).toBeInTheDocument()
    })

    it('should render refresh button', () => {
      render(<ActivityPane />)

      expect(screen.getByTitle('Refresh activities')).toBeInTheDocument()
    })

    it('should render collapse button', () => {
      render(<ActivityPane />)

      expect(screen.getByTitle('Collapse activity')).toBeInTheDocument()
    })

    it('should show disconnected status when not connected', () => {
      useWorkspaceStore.setState({ isConnected: false })

      const { container } = render(<ActivityPane />)

      // WifiOff icon should be present (red color)
      expect(container.querySelector('.text-red-500\\/70')).toBeInTheDocument()
    })

    it('should show connected status when connected', () => {
      useWorkspaceStore.setState({ isConnected: true })

      const { container } = render(<ActivityPane />)

      // Wifi icon should be present (green color)
      expect(container.querySelector('.text-green-500\\/70')).toBeInTheDocument()
    })

    it('should display empty state when no activities', () => {
      render(<ActivityPane />)

      expect(screen.getByText('No activity')).toBeInTheDocument()
    })
  })

  describe('WebSocket Connection', () => {
    it('should connect to WebSocket on mount', () => {
      render(<ActivityPane />)

      expect(mockConnect).toHaveBeenCalled()
    })
  })

  describe('Activity Display', () => {
    it('should display running activities', () => {
      const running = createMockActivity({
        id: '1',
        name: 'Processing Data',
        status: 'running',
        progress: 50,
      })
      useWorkspaceStore.setState({ activities: [running] })

      render(<ActivityPane />)

      expect(screen.getByText('Processing Data')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('should display scheduled activities', () => {
      const scheduled = createMockActivity({
        id: '1',
        name: 'Weekly Report',
        activityType: 'scheduled',
        status: 'pending',
        scheduleNextRun: new Date(Date.now() + 86400000).toISOString(),
      })
      useWorkspaceStore.setState({ activities: [scheduled] })

      render(<ActivityPane />)

      expect(screen.getByText('Weekly Report')).toBeInTheDocument()
      expect(screen.getByText('Scheduled')).toBeInTheDocument()
    })

    it('should display completed activities', () => {
      const completed = createMockActivity({
        id: '1',
        name: 'Scraped 847 posts',
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      useWorkspaceStore.setState({ activities: [completed] })

      render(<ActivityPane />)

      expect(screen.getByText('Scraped 847 posts')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('should display output files', () => {
      const output = createMockActivityOutput({
        name: 'sentiment_report.csv',
        sizeFormatted: '18 KB',
      })
      useWorkspaceStore.setState({ activityOutputs: [output] })

      render(<ActivityPane />)

      expect(screen.getByText('sentiment_report.csv')).toBeInTheDocument()
      expect(screen.getByText('18 KB')).toBeInTheDocument()
    })

    it('should display all sections when data is present', () => {
      const scheduled = createMockActivity({
        id: '1',
        activityType: 'scheduled',
        status: 'pending',
        scheduleNextRun: new Date(Date.now() + 86400000).toISOString(),
      })
      const running = createMockActivity({ id: '2', status: 'running', progress: 50 })
      const completed = createMockActivity({ id: '3', status: 'completed', completedAt: new Date().toISOString() })
      const output = createMockActivityOutput()

      useWorkspaceStore.setState({
        activities: [scheduled, running, completed],
        activityOutputs: [output],
      })

      render(<ActivityPane />)

      expect(screen.getByText('Scheduled')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Output')).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should fetch activities when refresh button is clicked', async () => {
      const mockActivities = [
        createMockActivity({ id: '1', name: 'Fetched Activity', status: 'running', progress: 25 }),
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activities: mockActivities }),
      })

      render(<ActivityPane />)

      const refreshButton = screen.getByTitle('Refresh activities')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/activities')
      })
    })

    it('should show loading state during refresh', async () => {
      let resolvePromise: () => void
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

      ;(global.fetch as jest.Mock).mockImplementation(() => promise.then(() => ({
        ok: true,
        json: async () => ({ activities: [] }),
      })))

      render(<ActivityPane />)

      const refreshButton = screen.getByTitle('Refresh activities')
      fireEvent.click(refreshButton)

      // Check if button is disabled during loading
      await waitFor(() => {
        expect(refreshButton).toBeDisabled()
      })

      // Resolve the promise
      act(() => {
        resolvePromise!()
      })
    })

    it('should handle fetch errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<ActivityPane />)

      const refreshButton = screen.getByTitle('Refresh activities')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh activities:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('should handle non-ok response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      render(<ActivityPane />)

      const refreshButton = screen.getByTitle('Refresh activities')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Output Download', () => {
    beforeEach(() => {
      global.fetch = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should download directly when downloadUrl is available', async () => {
      const mockClick = jest.fn()
      const createElement = document.createElement.bind(document)
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = createElement(tag)
        if (tag === 'a') {
          element.click = mockClick
        }
        return element
      })

      const output = createMockActivityOutput({
        name: 'direct-download.csv',
        downloadUrl: 'https://example.com/download/file.csv',
      })
      useWorkspaceStore.setState({ activityOutputs: [output] })

      render(<ActivityPane />)

      const downloadButton = screen.getByText('direct-download.csv')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockClick).toHaveBeenCalled()
      })
    })

    it('should fetch download URL when not available', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/signed-url' }),
      })

      const mockClick = jest.fn()
      const createElement = document.createElement.bind(document)
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = createElement(tag)
        if (tag === 'a') {
          element.click = mockClick
        }
        return element
      })

      const output = createMockActivityOutput({
        id: 'output-1',
        activityId: 'activity-1',
        name: 'fetch-url.csv',
        downloadUrl: undefined,
      })
      useWorkspaceStore.setState({ activityOutputs: [output] })

      render(<ActivityPane />)

      const downloadButton = screen.getByText('fetch-url.csv')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/activities/activity-1/outputs/output-1/download')
      })
    })

    it('should handle download error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Download failed'))

      const output = createMockActivityOutput({
        name: 'error-download.csv',
        downloadUrl: undefined,
      })
      useWorkspaceStore.setState({ activityOutputs: [output] })

      render(<ActivityPane />)

      const downloadButton = screen.getByText('error-download.csv')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Download failed:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Collapse Functionality', () => {
    it('should call toggle function when collapse button is clicked', () => {
      render(<ActivityPane />)

      const collapseButton = screen.getByTitle('Collapse activity')
      fireEvent.click(collapseButton)

      expect(mockToggleRightPanelCollapsed).toHaveBeenCalled()
    })
  })

  describe('Real-time Updates', () => {
    it('should update when new activity is added to store', async () => {
      render(<ActivityPane />)

      expect(screen.getByText('No activity')).toBeInTheDocument()

      // Simulate real-time update
      act(() => {
        useWorkspaceStore.getState().addActivity(
          createMockActivity({ name: 'New Task', status: 'running', progress: 0 })
        )
      })

      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument()
      })
    })

    it('should update when activity progress changes', async () => {
      const activity = createMockActivity({
        id: 'updating-activity',
        name: 'Updating Task',
        status: 'running',
        progress: 25,
      })
      useWorkspaceStore.setState({ activities: [activity] })

      render(<ActivityPane />)

      // Simulate progress update
      act(() => {
        useWorkspaceStore.getState().updateActivityProgress('updating-activity', 75, 'Almost done')
      })

      await waitFor(() => {
        expect(screen.getByText('Almost done')).toBeInTheDocument()
      })
    })

    it('should update when activity completes', async () => {
      const activity = createMockActivity({
        id: 'completing-activity',
        name: 'Task to Complete',
        status: 'running',
        progress: 99,
      })
      useWorkspaceStore.setState({ activities: [activity] })

      render(<ActivityPane />)

      expect(screen.getByText('Running')).toBeInTheDocument()

      // Simulate completion
      act(() => {
        useWorkspaceStore.getState().updateActivity({
          ...activity,
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })
    })

    it('should update when new output is added', async () => {
      render(<ActivityPane />)

      expect(screen.queryByText('Output')).not.toBeInTheDocument()

      // Simulate output creation
      act(() => {
        useWorkspaceStore.getState().addActivityOutput(
          createMockActivityOutput({ name: 'new-report.csv' })
        )
      })

      await waitFor(() => {
        expect(screen.getByText('Output')).toBeInTheDocument()
        expect(screen.getByText('new-report.csv')).toBeInTheDocument()
      })
    })
  })

  describe('Activity Lifecycle', () => {
    it('should handle full activity lifecycle: created -> running -> completed', async () => {
      render(<ActivityPane />)

      // 1. Activity created as pending
      const activity = createMockActivity({
        id: 'lifecycle-activity',
        name: 'Full Lifecycle Task',
        status: 'pending',
        progress: 0,
      })

      act(() => {
        useWorkspaceStore.getState().addActivity(activity)
      })

      // 2. Activity starts running
      act(() => {
        useWorkspaceStore.getState().updateActivity({
          ...activity,
          status: 'running',
          progress: 25,
          progressMessage: 'Starting...',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument()
      })

      // 3. Activity progresses
      act(() => {
        useWorkspaceStore.getState().updateActivityProgress('lifecycle-activity', 75, 'Almost done')
      })

      await waitFor(() => {
        expect(screen.getByText('Almost done')).toBeInTheDocument()
      })

      // 4. Activity completes
      act(() => {
        useWorkspaceStore.getState().updateActivity({
          ...activity,
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })

      // 5. Output is generated
      act(() => {
        useWorkspaceStore.getState().addActivityOutput(
          createMockActivityOutput({
            activityId: 'lifecycle-activity',
            name: 'lifecycle-output.csv',
          })
        )
      })

      await waitFor(() => {
        expect(screen.getByText('Output')).toBeInTheDocument()
        expect(screen.getByText('lifecycle-output.csv')).toBeInTheDocument()
      })
    })

    it('should handle activity failure', async () => {
      const activity = createMockActivity({
        id: 'failing-activity',
        name: 'Failing Task',
        status: 'running',
        progress: 50,
      })
      useWorkspaceStore.setState({ activities: [activity] })

      render(<ActivityPane />)

      // Simulate failure
      act(() => {
        useWorkspaceStore.getState().updateActivity({
          ...activity,
          status: 'failed',
          completedAt: new Date().toISOString(),
          errorMessage: 'Task failed due to network error',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('Failing Task')).toBeInTheDocument()
      })
    })
  })

  describe('Multiple Agents', () => {
    it('should display activities from multiple agents', () => {
      const activities = [
        createMockActivity({
          id: '1',
          name: 'TikTok Analysis',
          agentId: 'tiktok-agent',
          status: 'completed',
          completedAt: new Date().toISOString(),
        }),
        createMockActivity({
          id: '2',
          name: 'Reddit Scrape',
          agentId: 'reddit-agent',
          status: 'running',
          progress: 50,
        }),
        createMockActivity({
          id: '3',
          name: 'Weekly Report',
          agentId: 'report-agent',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: new Date(Date.now() + 86400000).toISOString(),
        }),
      ]
      useWorkspaceStore.setState({ activities })

      render(<ActivityPane />)

      expect(screen.getByText('TikTok Analysis')).toBeInTheDocument()
      expect(screen.getByText('Reddit Scrape')).toBeInTheDocument()
      expect(screen.getByText('Weekly Report')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<ActivityPane />)

      expect(screen.getByLabelText('Refresh activities')).toBeInTheDocument()
      expect(screen.getByLabelText('Collapse activity')).toBeInTheDocument()
    })

    it('should have proper heading structure', () => {
      render(<ActivityPane />)

      expect(screen.getByText('Activity')).toBeInTheDocument()
    })
  })
})
