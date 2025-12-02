'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { Loader2, MessageSquare, Calendar, Workflow } from 'lucide-react'
import { ActivityCard } from './activity-card'
import { cn } from '@/lib/utils'
import type { Activity } from '@/stores/workspace-store'

interface ActivityListProps {
  activities: Activity[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onActivityClick: (activity: Activity) => void
  className?: string
}

export function ActivityList({
  activities,
  loading,
  hasMore,
  onLoadMore,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onArchive,
  onUnarchive,
  onActivityClick,
  className,
}: ActivityListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, onLoadMore])

  if (activities.length === 0 && !loading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Welcome to Activities</h3>
        <p className="text-sm text-muted-foreground max-w-[300px]">
          Your agent activities will appear here when you start working.
        </p>
        <div className="mt-6 space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Start a conversation with an AI agent
          </p>
          <p className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Upload files to analyze
          </p>
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Try asking: &quot;Help me analyze this project&quot;
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRetry={onRetry}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onClick={onActivityClick}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {!hasMore && activities.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          No more activities to load
        </p>
      )}
    </div>
  )
}
