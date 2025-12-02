'use client'

import React, { useState, useCallback } from 'react'
import { ChevronRight, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore } from '@/stores/ui-store'
import { useWorkspaceStore, type Activity } from '@/stores/workspace-store'
import { useActivities } from './hooks/use-activities'
import { ActivityFilters } from './activity-filters'
import { ActivityList } from './activity-list'
import { ActivityDetailDialog } from './activity-detail-dialog'
import { cn } from '@/lib/utils'

export function ActivityPaneNew() {
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel)
  const isConnected = useWorkspaceStore(state => state.isConnected)

  const {
    activities,
    loading,
    hasMore,
    filters,
    counts,
    fetchActivities,
    fetchMore,
    setFilters,
    resetFilters,
    pauseActivity,
    resumeActivity,
    cancelActivity,
    retryActivity,
    archiveActivity,
    unarchiveActivity,
  } = useActivities()

  // Detail dialog state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // Handlers
  const handleActivityClick = useCallback((activity: Activity) => {
    setSelectedActivity(activity)
    setDetailDialogOpen(true)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchActivities({ reset: true })
  }, [fetchActivities])

  const handleApprove = useCallback(async (activityId: string, approvalId: string, response?: any) => {
    try {
      const res = await fetch(`/api/activities/${activityId}/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      if (res.ok) {
        // Refresh to get updated data
        fetchActivities({ reset: true })
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }, [fetchActivities])

  const handleDeny = useCallback(async (activityId: string, approvalId: string, reason?: string) => {
    try {
      const res = await fetch(`/api/activities/${activityId}/approvals/${approvalId}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (res.ok) {
        // Refresh to get updated data
        fetchActivities({ reset: true })
      }
    } catch (error) {
      console.error('Failed to deny:', error)
    }
  }, [fetchActivities])

  // Wrap action handlers to close dialog after action
  const handleActionWithRefresh = useCallback((action: (id: string) => Promise<void>) => {
    return async (id: string) => {
      await action(id)
      // Refresh the activity in detail dialog if it's open
      if (selectedActivity?.id === id) {
        setDetailDialogOpen(false)
      }
    }
  }, [selectedActivity])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Disconnected</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh activities"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <button
            onClick={toggleRightPanel}
            title="Collapse activity"
            aria-label="Collapse activity"
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b flex-shrink-0">
        <ActivityFilters
          filters={filters}
          counts={counts}
          onFiltersChange={setFilters}
          onReset={resetFilters}
        />
      </div>

      {/* Activity list with scroll */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <ActivityList
            activities={activities}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={fetchMore}
            onPause={handleActionWithRefresh(pauseActivity)}
            onResume={handleActionWithRefresh(resumeActivity)}
            onCancel={handleActionWithRefresh(cancelActivity)}
            onRetry={handleActionWithRefresh(retryActivity)}
            onArchive={handleActionWithRefresh(archiveActivity)}
            onUnarchive={handleActionWithRefresh(unarchiveActivity)}
            onActivityClick={handleActivityClick}
          />
        </div>
      </ScrollArea>

      {/* Detail dialog */}
      <ActivityDetailDialog
        activity={selectedActivity}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onPause={handleActionWithRefresh(pauseActivity)}
        onResume={handleActionWithRefresh(resumeActivity)}
        onCancel={handleActionWithRefresh(cancelActivity)}
        onRetry={handleActionWithRefresh(retryActivity)}
        onArchive={handleActionWithRefresh(archiveActivity)}
        onUnarchive={handleActionWithRefresh(unarchiveActivity)}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </div>
  )
}
