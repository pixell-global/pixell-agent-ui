'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import {
  useWorkspaceStore,
  selectRunningActivities,
  selectScheduledActivities,
  selectCompletedActivities,
  selectActivityOutputs,
  selectActivityPaneState,
} from '@/stores/workspace-store'
import { ActivityFeed } from './ActivityFeed'
import type { ActivityOutput } from '@/types'

export function ActivityPane() {
  const toggleRightPanelCollapsed = useUIStore((state) => state.toggleRightPanelCollapsed)

  // Select activities by status - use useShallow to prevent infinite loops
  // since filter/sort create new array references on each call
  const running = useWorkspaceStore(useShallow(selectRunningActivities))
  const scheduled = useWorkspaceStore(useShallow(selectScheduledActivities))
  const completed = useWorkspaceStore(useShallow(selectCompletedActivities))
  const outputs = useWorkspaceStore(useShallow(selectActivityOutputs))
  const activitiesLoading = useWorkspaceStore((state) => state.activitiesLoading)
  const setActivitiesLoading = useWorkspaceStore((state) => state.setActivitiesLoading)
  const activityPaneState = useWorkspaceStore(selectActivityPaneState)

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setActivitiesLoading(true)
    try {
      const response = await fetch('/api/activities')
      if (response.ok) {
        const data = await response.json()
        useWorkspaceStore.getState().setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Failed to refresh activities:', error)
    } finally {
      setActivitiesLoading(false)
    }
  }, [setActivitiesLoading])

  // Handle output file download
  const handleOutputDownload = useCallback(async (output: ActivityOutput) => {
    try {
      if (output.downloadUrl) {
        // Direct download if URL available
        const link = document.createElement('a')
        link.href = output.downloadUrl
        link.download = output.name
        link.click()
      } else {
        // Fetch download URL from API
        const response = await fetch(
          `/api/activities/${output.activityId}/outputs/${output.id}/download`
        )
        if (response.ok) {
          const { url } = await response.json()
          const link = document.createElement('a')
          link.href = url
          link.download = output.name
          link.click()
        }
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-background border-l border-white/10 text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between px-2 h-9 border-b border-white/10 bg-background">
        <span className="text-xs font-medium text-white/70">Activity</span>
        <div className="flex items-center gap-1">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={activitiesLoading}
            title="Refresh activities"
            aria-label="Refresh activities"
            className="h-6 w-6 inline-flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${activitiesLoading ? 'animate-spin' : ''}`}
            />
          </button>

          {/* Collapse button */}
          <button
            onClick={toggleRightPanelCollapsed}
            title="Collapse activity"
            aria-label="Collapse activity"
            className="h-6 w-6 inline-flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors duration-200"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto demo-scrollbar">
        <ActivityFeed
          scheduled={scheduled}
          running={running}
          completed={completed}
          outputs={outputs}
          size="sm"
          onOutputDownload={handleOutputDownload}
          transitionState={activityPaneState}
        />
      </div>
    </div>
  )
}
