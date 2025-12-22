'use client'

import React from 'react'
import { Loader2, Check } from 'lucide-react'
import type { MockActivityData } from '../mock-data'

interface MockActivityCardProps {
  activity: MockActivityData
}

export function MockActivityCard({ activity }: MockActivityCardProps) {
  if (activity.status === 'running') {
    return (
      <div className="relative p-2.5 rounded-lg bg-white/[0.02] border border-dashed border-white/10">
        {/* Preview badge */}
        <div className="absolute -top-2 right-2 px-1.5 py-0.5 bg-white/5 rounded text-[8px] text-white/30 uppercase tracking-wide">
          Preview
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 text-pixell-yellow animate-spin" />
            <span className="text-[11px] text-white/80 truncate flex-1">
              {activity.name}
            </span>
          </div>

          {/* Progress bar with animation */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-pixell-yellow/70 mock-progress-bar"
              style={{ width: `${activity.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[9px] text-white/40">
            <span>{activity.agentName}</span>
            <span>{activity.progressMessage}</span>
          </div>
        </div>
      </div>
    )
  }

  // Completed variant
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-white/[0.01] opacity-70">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <Check className="w-2.5 h-2.5 text-green-500" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] text-white/60 truncate block">
            {activity.name}
          </span>
          <span className="text-[8px] text-white/30">{activity.agentName}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <span className="text-[9px] text-white/40 block">{activity.timestamp}</span>
        {activity.duration && (
          <span className="text-[8px] text-white/30">{activity.duration}</span>
        )}
      </div>
    </div>
  )
}
