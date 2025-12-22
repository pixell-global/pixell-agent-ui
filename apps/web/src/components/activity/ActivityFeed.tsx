'use client'

import { useState, useEffect } from 'react'
import { Activity, ActivityPaneTransitionState } from '@/stores/workspace-store'
import type { ActivityOutput } from '@/types'
import { ScheduledSection, RunningSection, CompletedSection, OutputSection } from './sections'
import { ActivityEmptyState } from './empty-state'

interface ActivityFeedProps {
  scheduled: Activity[]
  running: Activity[]
  completed: Activity[]
  outputs: ActivityOutput[]
  size?: 'sm' | 'md'
  onOutputDownload?: (output: ActivityOutput) => void
  transitionState?: ActivityPaneTransitionState
}

export function ActivityFeed({
  scheduled,
  running,
  completed,
  outputs,
  size = 'sm',
  onOutputDownload,
  transitionState = 'empty',
}: ActivityFeedProps) {
  const [showContent, setShowContent] = useState(false)

  const isEmpty =
    scheduled.length === 0 &&
    running.length === 0 &&
    completed.length === 0 &&
    outputs.length === 0

  // Handle transition animation
  useEffect(() => {
    if (transitionState === 'transitioning') {
      // Brief delay then show real content
      const timer = setTimeout(() => setShowContent(true), 50)
      return () => clearTimeout(timer)
    }
    if (transitionState === 'active') {
      setShowContent(true)
    }
    if (transitionState === 'empty' || transitionState === 'preview') {
      setShowContent(false)
    }
  }, [transitionState])

  // Show empty state when truly empty and not transitioning
  if (isEmpty && (transitionState === 'empty' || transitionState === 'preview')) {
    return <ActivityEmptyState size={size} />
  }

  // Transition wrapper with crossfade
  return (
    <div className="relative">
      {/* Fading out empty state during transition */}
      {transitionState === 'transitioning' && (
        <div
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{ opacity: showContent ? 0 : 1, pointerEvents: 'none' }}
        >
          <ActivityEmptyState size={size} />
        </div>
      )}

      {/* Real activity content */}
      <div
        className={`flex flex-col transition-opacity duration-300 ease-in ${
          showContent || transitionState === 'active'
            ? 'opacity-100'
            : 'opacity-0'
        }`}
      >
        <ScheduledSection activities={scheduled} size={size} />
        <RunningSection activities={running} size={size} />
        <CompletedSection activities={completed} size={size} />
        <OutputSection outputs={outputs} size={size} onDownload={onOutputDownload} />
      </div>
    </div>
  )
}
