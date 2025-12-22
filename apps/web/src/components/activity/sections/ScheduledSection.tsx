'use client'

import { Clock } from 'lucide-react'
import { Activity } from '@/stores/workspace-store'
import { ScheduledItem } from '../items'

interface ScheduledSectionProps {
  activities: Activity[]
  size?: 'sm' | 'md'
}

export function ScheduledSection({ activities, size = 'sm' }: ScheduledSectionProps) {
  if (activities.length === 0) return null

  const headerPadding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-2'
  const sectionPadding = size === 'sm' ? 'px-2 pb-1.5' : 'px-3 pb-2'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="border-b border-white/5">
      <div className={`flex items-center gap-1 ${headerPadding} text-blue-400/70`}>
        <Clock className={iconSize} />
        <span className={textSize}>Scheduled</span>
        <span className={`ml-auto ${textSize} text-white/30`}>({activities.length})</span>
      </div>
      <div className={`${sectionPadding} space-y-0.5`}>
        {activities.map((activity) => (
          <ScheduledItem key={activity.id} activity={activity} size={size} />
        ))}
      </div>
    </div>
  )
}
