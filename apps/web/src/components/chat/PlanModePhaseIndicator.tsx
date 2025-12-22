'use client'

import React from 'react'
import { Circle, HelpCircle, Search, CheckSquare, Eye, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import type { PlanModePhase } from '@pixell/protocols'

interface PlanModePhaseIndicatorProps {
  currentPhase: PlanModePhase
  supportedPhases: PlanModePhase[]
  agentName?: string
  className?: string
}

const PHASE_CONFIG: Record<PlanModePhase, {
  label: string
  description: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}> = {
  idle: {
    label: 'Ready',
    description: 'Ready to start',
    Icon: Circle,
    color: 'text-gray-400',
  },
  clarification: {
    label: 'Questions',
    description: 'Gathering requirements',
    Icon: HelpCircle,
    color: 'text-purple-500',
  },
  discovery: {
    label: 'Discovery',
    description: 'Finding items',
    Icon: Search,
    color: 'text-blue-500',
  },
  selection: {
    label: 'Selection',
    description: 'Choose items',
    Icon: CheckSquare,
    color: 'text-indigo-500',
  },
  preview: {
    label: 'Preview',
    description: 'Review plan',
    Icon: Eye,
    color: 'text-amber-500',
  },
  executing: {
    label: 'Running',
    description: 'Executing',
    Icon: Loader,
    color: 'text-green-500',
  },
  completed: {
    label: 'Done',
    description: 'Completed',
    Icon: CheckCircle,
    color: 'text-green-600',
  },
  error: {
    label: 'Error',
    description: 'Failed',
    Icon: AlertCircle,
    color: 'text-red-500',
  },
}

const PHASE_ORDER: PlanModePhase[] = [
  'idle',
  'clarification',
  'discovery',
  'selection',
  'preview',
  'executing',
  'completed',
]

export function PlanModePhaseIndicator({
  currentPhase,
  supportedPhases,
  agentName,
  className = '',
}: PlanModePhaseIndicatorProps) {
  // Filter to only show supported phases (excluding idle, completed, error from display)
  const displayPhases = PHASE_ORDER.filter(
    phase => supportedPhases.includes(phase) && !['idle', 'error'].includes(phase)
  )

  const currentIndex = displayPhases.indexOf(currentPhase)
  const currentConfig = PHASE_CONFIG[currentPhase]

  return (
    <div className={`bg-gray-50 rounded-lg p-3 ${className}`}>
      {/* Agent name and current phase label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{agentName || 'Agent'}</span>
        <span className={`text-xs font-medium ${currentConfig.color}`}>
          {currentConfig.label}
        </span>
      </div>

      {/* Phase progress indicators */}
      <div className="flex items-center gap-1">
        {displayPhases.map((phase, index) => {
          const config = PHASE_CONFIG[phase]
          const Icon = config.Icon
          const isActive = phase === currentPhase
          const isPast = currentIndex > index
          const isFuture = currentIndex < index

          return (
            <React.Fragment key={phase}>
              {/* Phase dot/icon */}
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded-full transition-all
                  ${isActive ? `${config.color} bg-white shadow-sm border-2 border-current` : ''}
                  ${isPast ? 'text-green-500 bg-green-50' : ''}
                  ${isFuture ? 'text-gray-300 bg-gray-100' : ''}
                `}
                title={`${config.label}: ${config.description}`}
              >
                <Icon
                  size={12}
                  className={isActive && phase === 'executing' ? 'animate-spin' : ''}
                />
              </div>

              {/* Connector line */}
              {index < displayPhases.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 min-w-4 max-w-8 transition-colors
                    ${isPast ? 'bg-green-300' : 'bg-gray-200'}
                  `}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Current phase description */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        {currentConfig.description}
      </p>
    </div>
  )
}

// Compact inline version for chat headers
export function PlanModePhaseIndicatorCompact({
  currentPhase,
  supportedPhases,
}: Pick<PlanModePhaseIndicatorProps, 'currentPhase' | 'supportedPhases'>) {
  const displayPhases = PHASE_ORDER.filter(
    phase => supportedPhases.includes(phase) && !['idle', 'error'].includes(phase)
  )

  const currentIndex = displayPhases.indexOf(currentPhase)
  const currentConfig = PHASE_CONFIG[currentPhase]
  const Icon = currentConfig.Icon

  return (
    <div className="flex items-center gap-2">
      <Icon
        size={14}
        className={`${currentConfig.color} ${currentPhase === 'executing' ? 'animate-spin' : ''}`}
      />
      <span className={`text-xs font-medium ${currentConfig.color}`}>
        {currentConfig.label}
      </span>
      <span className="text-xs text-gray-400">
        ({currentIndex + 1}/{displayPhases.length})
      </span>
    </div>
  )
}
