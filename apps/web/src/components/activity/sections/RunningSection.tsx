'use client'

import { Play } from 'lucide-react'
import { Activity, useWorkspaceStore } from '@/stores/workspace-store'
import { RunningItem } from '../items'

interface RunningSectionProps {
  activities: Activity[]
  size?: 'sm' | 'md'
}

export function RunningSection({ activities, size = 'sm' }: RunningSectionProps) {
  const toggleActivitySubTasksExpanded = useWorkspaceStore(state => state.toggleActivitySubTasksExpanded)

  if (activities.length === 0) return null

  const headerPadding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-2'
  const sectionPadding = size === 'sm' ? 'px-2 pb-1.5' : 'px-3 pb-2'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="border-b border-white/5">
      <div className={`flex items-center gap-1 ${headerPadding} text-pixell-yellow/70`}>
        <Play className={iconSize} />
        <span className={textSize}>Running</span>
      </div>
      <div className={`${sectionPadding} space-y-2`}>
        {activities.map((activity) => (
          <RunningItem
            key={activity.id}
            activity={activity}
            size={size}
            onToggleSubTasks={() => toggleActivitySubTasksExpanded(activity.id)}
          />
        ))}
      </div>
    </div>
  )
}
