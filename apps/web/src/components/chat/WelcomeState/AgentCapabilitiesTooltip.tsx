'use client'

import React from 'react'
import { getCapabilitiesForAgent } from '@/data/agent-prompts'
import type { AgentConfig } from '@pixell/protocols'

interface AgentCapabilitiesTooltipProps {
  agent: AgentConfig
}

export function AgentCapabilitiesTooltip({ agent }: AgentCapabilitiesTooltipProps) {
  const capabilities = getCapabilitiesForAgent(agent.id, agent.capabilities)

  if (capabilities.length === 0) return null

  return (
    <div
      className="
        absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2
        opacity-0 invisible group-hover:opacity-100 group-hover:visible
        transition-all duration-200 delay-150
        pointer-events-none
      "
    >
      <div className="bg-elevated/95 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-xl min-w-[200px]">
        <p className="text-xs font-medium text-white/80 mb-2">Capabilities</p>
        <ul className="space-y-1.5">
          {capabilities.map((cap) => (
            <li key={cap.name} className="flex items-start gap-2 text-xs">
              <span className="text-pixell-yellow">•</span>
              <span className="text-white/70">{cap.description}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Arrow pointing up */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-elevated/95 border-l border-t border-white/20 rotate-45" />
    </div>
  )
}
