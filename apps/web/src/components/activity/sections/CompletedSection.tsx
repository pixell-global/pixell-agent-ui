'use client'

import { Check } from 'lucide-react'
import { Activity } from '@/stores/workspace-store'
import { CompletedItem } from '../items'

interface CompletedSectionProps {
  activities: Activity[]
  size?: 'sm' | 'md'
  maxHeight?: string
}

export function CompletedSection({
  activities,
  size = 'sm',
  maxHeight = 'max-h-32',
}: CompletedSectionProps) {
  if (activities.length === 0) return null

  const headerPadding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-2'
  const sectionPadding = size === 'sm' ? 'px-2 pb-1.5' : 'px-3 pb-2'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="border-b border-white/5">
      <div className={`flex items-center gap-1 ${headerPadding} text-green-500/70`}>
        <Check className={iconSize} />
        <span className={textSize}>Completed</span>
        <span className={`ml-auto ${textSize} text-white/30`}>({activities.length})</span>
      </div>
      <div className={`${sectionPadding} space-y-0.5 ${maxHeight} overflow-y-auto demo-scrollbar`}>
        {activities.map((activity, index) => (
          <CompletedItem key={`${activity.id}-${index}`} activity={activity} size={size} />
        ))}
      </div>
    </div>
  )
}
