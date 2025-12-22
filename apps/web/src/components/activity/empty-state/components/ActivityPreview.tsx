'use client'

import React from 'react'
import { Activity, Sparkles, Check, FileSpreadsheet, MessageSquare } from 'lucide-react'
import { MockActivityCard } from './MockActivityCard'
import { MockOutputCard } from './MockOutputCard'
import { MOCK_ACTIVITIES, MOCK_OUTPUTS } from '../mock-data'

interface ActivityPreviewProps {
  onDismiss: () => void
  onStartConversation: () => void
  className?: string
}

export function ActivityPreview({
  onDismiss,
  onStartConversation,
  className = '',
}: ActivityPreviewProps) {
  const runningActivity = MOCK_ACTIVITIES.find((a) => a.status === 'running')
  const completedActivities = MOCK_ACTIVITIES.filter((a) => a.status === 'completed')

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Educational Header */}
      <div className="px-3 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-pixell-yellow/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-pixell-yellow" />
          </div>
          <h3 className="text-sm font-medium text-white/90">Activity Feed</h3>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">
          This panel shows real-time progress of agent tasks, completed activities, and
          downloadable outputs. Start a conversation to see it in action.
        </p>
      </div>

      {/* Mock Preview Section */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* What You'll See Label */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-white/30" />
          <span className="text-[10px] text-white/30 uppercase tracking-wide">
            Preview
          </span>
        </div>

        {/* Mock Running Activity */}
        {runningActivity && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <MockActivityCard activity={runningActivity} />
          </div>
        )}

        {/* Mock Completed Activities */}
        {completedActivities.length > 0 && (
          <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
            <div className="flex items-center gap-1 px-1 text-green-500/70">
              <Check className="w-2.5 h-2.5" />
              <span className="text-[10px]">Completed</span>
            </div>
            {completedActivities.map((activity) => (
              <MockActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {/* Mock Output Files */}
        {MOCK_OUTPUTS.length > 0 && (
          <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
            <div className="flex items-center gap-1 px-1 text-pixell-yellow/80">
              <FileSpreadsheet className="w-2.5 h-2.5" />
              <span className="text-[10px]">Outputs</span>
            </div>
            {MOCK_OUTPUTS.map((output) => (
              <MockOutputCard key={output.id} output={output} />
            ))}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="px-3 py-3 border-t border-white/5 space-y-2">
        <button
          onClick={onStartConversation}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white/70 text-xs font-medium rounded-lg hover:bg-white/10 hover:text-white/90 transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Start a Conversation
        </button>
        <button
          onClick={onDismiss}
          className="w-full text-[10px] text-white/30 hover:text-white/50 transition-colors py-1"
        >
          Dismiss preview
        </button>
      </div>
    </div>
  )
}
