'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { AgentHealth } from '@/types'

interface AgentHealthBannerProps {
  health: AgentHealth
}

export function AgentHealthBanner({ health }: AgentHealthBannerProps) {
  const getMessage = () => {
    switch (health.status) {
      case 'disconnected':
        return 'The AI agent is currently offline. Please check your connection or try again later.'
      case 'error':
        return 'There was an error connecting to the AI agent. Please try again.'
      default:
        return 'The AI agent is not available. Please check your configuration.'
    }
  }

  return (
    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="font-medium text-red-400 mb-1">Agent Unavailable</h3>
          <p className="text-sm text-red-400/80">{getMessage()}</p>
          <p className="text-xs text-red-400/60 mt-2">
            Run{' '}
            <code className="bg-red-500/20 px-1.5 py-0.5 rounded font-mono">
              pixell services status
            </code>{' '}
            to check service health.
          </p>
        </div>
      </div>
    </div>
  )
}
