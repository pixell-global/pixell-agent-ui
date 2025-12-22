'use client'

import React from 'react'
import { Activity } from 'lucide-react'

interface MinimalEmptyStateProps {
  onRestore: () => void
  onStartConversation: () => void
}

export function MinimalEmptyState({
  onRestore,
  onStartConversation,
}: MinimalEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <Activity className="w-5 h-5 text-white/20" />
      </div>
      <p className="text-[11px] text-white/40 mb-2">No activity yet</p>
      <button
        onClick={onStartConversation}
        className="text-[10px] text-pixell-yellow hover:text-pixell-yellow/80 transition-colors mb-4"
      >
        Start a conversation to see tasks here
      </button>
      <button
        onClick={onRestore}
        className="text-[9px] text-white/20 hover:text-white/40 transition-colors"
      >
        Show preview guide
      </button>
    </div>
  )
}
