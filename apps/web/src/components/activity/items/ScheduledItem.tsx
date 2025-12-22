'use client'

import { Clock } from 'lucide-react'
import { Activity } from '@/stores/workspace-store'

interface ScheduledItemProps {
  activity: Activity
  size?: 'sm' | 'md'
}

function formatScheduleTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) {
    return `Today ${timeStr}`
  } else if (isTomorrow) {
    return `Tomorrow ${timeStr}`
  } else {
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dayStr} ${timeStr}`
  }
}

export function ScheduledItem({ activity, size = 'sm' }: ScheduledItemProps) {
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1 min-w-0">
        <Clock className={`${iconSize} text-blue-400 flex-shrink-0`} />
        <span className={`${textSize} text-white/60 truncate`}>{activity.name}</span>
      </div>
      {activity.scheduleNextRun && (
        <span className={`${textSize} text-white/30 ml-1 flex-shrink-0`}>
          {formatScheduleTime(activity.scheduleNextRun)}
        </span>
      )}
    </div>
  )
}
