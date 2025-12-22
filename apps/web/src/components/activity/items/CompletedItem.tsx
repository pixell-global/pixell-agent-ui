'use client'

import { Check, X, AlertCircle } from 'lucide-react'
import { Activity } from '@/stores/workspace-store'

interface CompletedItemProps {
  activity: Activity
  size?: 'sm' | 'md'
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function CompletedItem({ activity, size = 'sm' }: CompletedItemProps) {
  const iconContainerSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const iconSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  const isSuccess = activity.status === 'completed'
  const isFailed = activity.status === 'failed'
  const isCancelled = activity.status === 'cancelled'

  const timestamp = activity.completedAt || activity.updatedAt

  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1 min-w-0">
        <div
          className={`${iconContainerSize} rounded-full flex items-center justify-center flex-shrink-0 ${
            isSuccess
              ? 'bg-green-500/20'
              : isFailed
              ? 'bg-red-500/20'
              : 'bg-yellow-500/20'
          }`}
        >
          {isSuccess ? (
            <Check className={`${iconSize} text-green-500`} />
          ) : isFailed ? (
            <X className={`${iconSize} text-red-500`} />
          ) : (
            <AlertCircle className={`${iconSize} text-yellow-500`} />
          )}
        </div>
        <span className={`${textSize} text-white/50 truncate`}>{activity.name}</span>
      </div>
      <span className={`${textSize} text-white/30 ml-1 flex-shrink-0`}>
        {formatTime(timestamp)}
      </span>
    </div>
  )
}
