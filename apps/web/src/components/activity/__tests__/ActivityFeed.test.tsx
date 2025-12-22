/**
 * ActivityFeed Component Tests
 *
 * Comprehensive tests for the ActivityFeed component and its child sections.
 * Tests rendering, user interactions, and various activity states.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ActivityFeed } from '../ActivityFeed'
import { RunningSection } from '../sections/RunningSection'
import { CompletedSection } from '../sections/CompletedSection'
import { ScheduledSection } from '../sections/ScheduledSection'
import { OutputSection } from '../sections/OutputSection'
import { RunningItem } from '../items/RunningItem'
import { CompletedItem } from '../items/CompletedItem'
import { ScheduledItem } from '../items/ScheduledItem'
import { OutputFileItem } from '../items/OutputFileItem'
import type { Activity } from '@/stores/workspace-store'
import type { ActivityOutput } from '@/types'

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

describe('ActivityFeed', () => {
  describe('Empty State', () => {
    it('should render empty state when all arrays are empty', () => {
      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={[]}
          outputs={[]}
        />
      )

      expect(screen.getByText('No activity')).toBeInTheDocument()
    })

    it('should not render sections when arrays are empty', () => {
      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={[]}
          outputs={[]}
        />
      )

      expect(screen.queryByText('Scheduled')).not.toBeInTheDocument()
      expect(screen.queryByText('Running')).not.toBeInTheDocument()
      expect(screen.queryByText('Completed')).not.toBeInTheDocument()
      expect(screen.queryByText('Output')).not.toBeInTheDocument()
    })
  })

  describe('Scheduled Section', () => {
    it('should render scheduled activities', () => {
      const scheduled = [
        createMockActivity({
          id: '1',
          name: 'Weekly Report',
          activityType: 'scheduled',
          status: 'pending',
          scheduleNextRun: new Date(Date.now() + 86400000).toISOString(), // tomorrow
        }),
      ]

      render(
        <ActivityFeed
          scheduled={scheduled}
          running={[]}
          completed={[]}
          outputs={[]}
        />
      )

      expect(screen.getByText('Scheduled')).toBeInTheDocument()
      expect(screen.getByText('Weekly Report')).toBeInTheDocument()
    })

    it('should display count badge', () => {
      const scheduled = [
        createMockActivity({ id: '1', activityType: 'scheduled', status: 'pending', scheduleNextRun: new Date().toISOString() }),
        createMockActivity({ id: '2', activityType: 'scheduled', status: 'pending', scheduleNextRun: new Date().toISOString() }),
      ]

      render(
        <ActivityFeed
          scheduled={scheduled}
          running={[]}
          completed={[]}
          outputs={[]}
        />
      )

      expect(screen.getByText('(2)')).toBeInTheDocument()
    })
  })

  describe('Running Section', () => {
    it('should render running activities with progress', () => {
      const running = [
        createMockActivity({
          id: '1',
          name: 'Scraping Data',
          status: 'running',
          progress: 50,
          progressMessage: 'Processing 500/1000 items',
        }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={running}
          completed={[]}
          outputs={[]}
        />
      )

      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Scraping Data')).toBeInTheDocument()
    })

    it('should render multiple running activities', () => {
      const running = [
        createMockActivity({ id: '1', name: 'Task 1', status: 'running', progress: 25 }),
        createMockActivity({ id: '2', name: 'Task 2', status: 'running', progress: 75 }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={running}
          completed={[]}
          outputs={[]}
        />
      )

      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
    })
  })

  describe('Completed Section', () => {
    it('should render completed activities with timestamps', () => {
      const completed = [
        createMockActivity({
          id: '1',
          name: 'Scraped 847 posts',
          status: 'completed',
          completedAt: new Date().toISOString(),
        }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={completed}
          outputs={[]}
        />
      )

      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Scraped 847 posts')).toBeInTheDocument()
    })

    it('should display completed count', () => {
      const completed = [
        createMockActivity({ id: '1', status: 'completed', completedAt: new Date().toISOString() }),
        createMockActivity({ id: '2', status: 'completed', completedAt: new Date().toISOString() }),
        createMockActivity({ id: '3', status: 'failed', completedAt: new Date().toISOString() }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={completed}
          outputs={[]}
        />
      )

      expect(screen.getByText('(3)')).toBeInTheDocument()
    })

    it('should handle failed activities', () => {
      const completed = [
        createMockActivity({
          id: '1',
          name: 'Failed Task',
          status: 'failed',
          completedAt: new Date().toISOString(),
        }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={completed}
          outputs={[]}
        />
      )

      expect(screen.getByText('Failed Task')).toBeInTheDocument()
    })
  })

  describe('Output Section', () => {
    it('should render output files', () => {
      const outputs = [
        createMockActivityOutput({
          name: 'sentiment_report.csv',
          type: 'csv',
          sizeFormatted: '18 KB',
        }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={[]}
          outputs={outputs}
        />
      )

      expect(screen.getByText('Output')).toBeInTheDocument()
      expect(screen.getByText('sentiment_report.csv')).toBeInTheDocument()
      expect(screen.getByText('18 KB')).toBeInTheDocument()
    })

    it('should render multiple output files', () => {
      const outputs = [
        createMockActivityOutput({ id: '1', name: 'report1.csv', type: 'csv' }),
        createMockActivityOutput({ id: '2', name: 'report2.xlsx', type: 'excel' }),
        createMockActivityOutput({ id: '3', name: 'summary.pdf', type: 'pdf' }),
      ]

      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={[]}
          outputs={outputs}
        />
      )

      expect(screen.getByText('report1.csv')).toBeInTheDocument()
      expect(screen.getByText('report2.xlsx')).toBeInTheDocument()
      expect(screen.getByText('summary.pdf')).toBeInTheDocument()
    })

    it('should call onOutputDownload when file is clicked', () => {
      const onDownload = jest.fn()
      const outputs = [createMockActivityOutput({ name: 'clickable.csv' })]

      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={[]}
          outputs={outputs}
          onOutputDownload={onDownload}
        />
      )

      fireEvent.click(screen.getByText('clickable.csv'))

      expect(onDownload).toHaveBeenCalledWith(outputs[0])
    })
  })

  describe('Combined Sections', () => {
    it('should render all sections when data is present', () => {
      const scheduled = [createMockActivity({
        activityType: 'scheduled',
        status: 'pending',
        scheduleNextRun: new Date().toISOString(),
      })]
      const running = [createMockActivity({ status: 'running', progress: 50 })]
      const completed = [createMockActivity({ status: 'completed', completedAt: new Date().toISOString() })]
      const outputs = [createMockActivityOutput()]

      render(
        <ActivityFeed
          scheduled={scheduled}
          running={running}
          completed={completed}
          outputs={outputs}
        />
      )

      expect(screen.getByText('Scheduled')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Output')).toBeInTheDocument()
    })

    it('should not show empty state when at least one section has data', () => {
      render(
        <ActivityFeed
          scheduled={[]}
          running={[]}
          completed={[createMockActivity({ status: 'completed', completedAt: new Date().toISOString() })]}
          outputs={[]}
        />
      )

      expect(screen.queryByText('No activity')).not.toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('should apply small size styling', () => {
      const running = [createMockActivity({ status: 'running', progress: 50 })]

      const { container } = render(
        <ActivityFeed
          scheduled={[]}
          running={running}
          completed={[]}
          outputs={[]}
          size="sm"
        />
      )

      // Small size uses text-[10px] class
      expect(container.querySelector('.text-\\[10px\\]')).toBeInTheDocument()
    })

    it('should apply medium size styling', () => {
      const running = [createMockActivity({ status: 'running', progress: 50 })]

      const { container } = render(
        <ActivityFeed
          scheduled={[]}
          running={running}
          completed={[]}
          outputs={[]}
          size="md"
        />
      )

      // Medium size uses text-xs class
      expect(container.querySelector('.text-xs')).toBeInTheDocument()
    })
  })
})

describe('RunningItem', () => {
  it('should render activity name', () => {
    const activity = createMockActivity({ name: 'Processing Data', status: 'running', progress: 50 })

    render(<RunningItem activity={activity} />)

    expect(screen.getByText('Processing Data')).toBeInTheDocument()
  })

  it('should display progress message when provided', () => {
    const activity = createMockActivity({
      status: 'running',
      progress: 50,
      progressMessage: 'Processing 500/1000 items',
    })

    render(<RunningItem activity={activity} />)

    expect(screen.getByText('Processing 500/1000 items')).toBeInTheDocument()
  })

  it('should render spinner animation', () => {
    const activity = createMockActivity({ status: 'running', progress: 0 })

    const { container } = render(<RunningItem activity={activity} />)

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should show progress bar with correct width', () => {
    const activity = createMockActivity({ status: 'running', progress: 75 })

    const { container } = render(<RunningItem activity={activity} />)

    const progressBar = container.querySelector('[style*="width: 75%"]')
    expect(progressBar).toBeInTheDocument()
  })
})

describe('CompletedItem', () => {
  it('should render completed activity with green checkmark', () => {
    const activity = createMockActivity({
      name: 'Completed Task',
      status: 'completed',
      completedAt: new Date().toISOString(),
    })

    const { container } = render(<CompletedItem activity={activity} />)

    expect(screen.getByText('Completed Task')).toBeInTheDocument()
    expect(container.querySelector('.text-green-500')).toBeInTheDocument()
  })

  it('should render failed activity with red icon', () => {
    const activity = createMockActivity({
      name: 'Failed Task',
      status: 'failed',
      completedAt: new Date().toISOString(),
    })

    const { container } = render(<CompletedItem activity={activity} />)

    expect(screen.getByText('Failed Task')).toBeInTheDocument()
    expect(container.querySelector('.text-red-500')).toBeInTheDocument()
  })

  it('should render cancelled activity with yellow icon', () => {
    const activity = createMockActivity({
      name: 'Cancelled Task',
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    })

    const { container } = render(<CompletedItem activity={activity} />)

    expect(screen.getByText('Cancelled Task')).toBeInTheDocument()
    expect(container.querySelector('.text-yellow-500')).toBeInTheDocument()
  })

  it('should format timestamp correctly', () => {
    const date = new Date('2024-01-15T14:30:00Z')
    const activity = createMockActivity({
      status: 'completed',
      completedAt: date.toISOString(),
    })

    render(<CompletedItem activity={activity} />)

    // Should show time in format like "2:30 PM"
    expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/i)).toBeInTheDocument()
  })
})

describe('ScheduledItem', () => {
  it('should render scheduled activity name', () => {
    const activity = createMockActivity({
      name: 'Weekly Report',
      activityType: 'scheduled',
      status: 'pending',
      scheduleNextRun: new Date(Date.now() + 86400000).toISOString(),
    })

    render(<ScheduledItem activity={activity} />)

    expect(screen.getByText('Weekly Report')).toBeInTheDocument()
  })

  it('should display "Today" for today\'s tasks', () => {
    const today = new Date()
    today.setHours(today.getHours() + 2)

    const activity = createMockActivity({
      name: 'Daily Task',
      activityType: 'scheduled',
      status: 'pending',
      scheduleNextRun: today.toISOString(),
    })

    render(<ScheduledItem activity={activity} />)

    expect(screen.getByText(/Today/)).toBeInTheDocument()
  })

  it('should display "Tomorrow" for tomorrow\'s tasks', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const activity = createMockActivity({
      name: 'Scheduled Task',
      activityType: 'scheduled',
      status: 'pending',
      scheduleNextRun: tomorrow.toISOString(),
    })

    render(<ScheduledItem activity={activity} />)

    // Check that "Tomorrow" appears in the time display (there may be multiple matches)
    const tomorrowElements = screen.getAllByText(/Tomorrow/)
    expect(tomorrowElements.length).toBeGreaterThan(0)
  })
})

describe('OutputFileItem', () => {
  it('should render file name and size', () => {
    const output = createMockActivityOutput({
      name: 'report.csv',
      sizeFormatted: '15 KB',
    })

    render(<OutputFileItem output={output} />)

    expect(screen.getByText('report.csv')).toBeInTheDocument()
    expect(screen.getByText('15 KB')).toBeInTheDocument()
  })

  it('should call onDownload when clicked', () => {
    const onDownload = jest.fn()
    const output = createMockActivityOutput({ name: 'download.csv' })

    render(<OutputFileItem output={output} onDownload={onDownload} />)

    fireEvent.click(screen.getByText('download.csv'))

    expect(onDownload).toHaveBeenCalledWith(output)
  })

  it('should open download URL when available and no handler', () => {
    const mockOpen = jest.fn()
    window.open = mockOpen

    const output = createMockActivityOutput({
      name: 'direct.csv',
      downloadUrl: 'https://example.com/download/direct.csv',
    })

    render(<OutputFileItem output={output} />)

    fireEvent.click(screen.getByText('direct.csv'))

    expect(mockOpen).toHaveBeenCalledWith('https://example.com/download/direct.csv', '_blank')
  })

  it('should render correct icon for CSV file', () => {
    const output = createMockActivityOutput({ type: 'csv' })

    const { container } = render(<OutputFileItem output={output} />)

    // FileSpreadsheet icon should be present
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should render correct icon for PDF file', () => {
    const output = createMockActivityOutput({ type: 'pdf', name: 'document.pdf' })

    const { container } = render(<OutputFileItem output={output} />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should show download icon on hover', () => {
    const output = createMockActivityOutput()

    const { container } = render(<OutputFileItem output={output} />)

    // Download icon should be present
    const downloadIcons = container.querySelectorAll('svg')
    expect(downloadIcons.length).toBeGreaterThan(0)
  })
})

describe('Section Components', () => {
  describe('RunningSection', () => {
    it('should not render when activities array is empty', () => {
      const { container } = render(<RunningSection activities={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render header with Running text', () => {
      const activities = [createMockActivity({ status: 'running', progress: 50 })]

      render(<RunningSection activities={activities} />)

      expect(screen.getByText('Running')).toBeInTheDocument()
    })
  })

  describe('CompletedSection', () => {
    it('should not render when activities array is empty', () => {
      const { container } = render(<CompletedSection activities={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render with count badge', () => {
      const activities = [
        createMockActivity({ id: '1', status: 'completed', completedAt: new Date().toISOString() }),
        createMockActivity({ id: '2', status: 'completed', completedAt: new Date().toISOString() }),
      ]

      render(<CompletedSection activities={activities} />)

      expect(screen.getByText('(2)')).toBeInTheDocument()
    })

    it('should apply max height for scrollable area', () => {
      const activities = Array.from({ length: 20 }, (_, i) =>
        createMockActivity({ id: `${i}`, status: 'completed', completedAt: new Date().toISOString() })
      )

      const { container } = render(<CompletedSection activities={activities} />)

      expect(container.querySelector('.max-h-32')).toBeInTheDocument()
    })
  })

  describe('ScheduledSection', () => {
    it('should not render when activities array is empty', () => {
      const { container } = render(<ScheduledSection activities={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render count badge', () => {
      const activities = [
        createMockActivity({ id: '1', activityType: 'scheduled', status: 'pending', scheduleNextRun: new Date().toISOString() }),
        createMockActivity({ id: '2', activityType: 'scheduled', status: 'pending', scheduleNextRun: new Date().toISOString() }),
        createMockActivity({ id: '3', activityType: 'scheduled', status: 'pending', scheduleNextRun: new Date().toISOString() }),
      ]

      render(<ScheduledSection activities={activities} />)

      expect(screen.getByText('(3)')).toBeInTheDocument()
    })
  })

  describe('OutputSection', () => {
    it('should not render when outputs array is empty', () => {
      const { container } = render(<OutputSection outputs={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render Output header', () => {
      const outputs = [createMockActivityOutput()]

      render(<OutputSection outputs={outputs} />)

      expect(screen.getByText('Output')).toBeInTheDocument()
    })

    it('should pass onDownload to items', () => {
      const onDownload = jest.fn()
      const outputs = [createMockActivityOutput({ name: 'test.csv' })]

      render(<OutputSection outputs={outputs} onDownload={onDownload} />)

      fireEvent.click(screen.getByText('test.csv'))

      expect(onDownload).toHaveBeenCalled()
    })
  })
})
