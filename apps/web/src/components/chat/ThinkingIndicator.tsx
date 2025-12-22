'use client'

import React, { useEffect } from 'react'
import { ChevronDown, ChevronRight, Brain, Clock, CheckCircle, Search, MessageSquare, FileText, Sparkles, Database, Loader2 } from 'lucide-react'
import { ThinkingStep, ChatUISettings } from '@/types'
import { useChatStore } from '@/stores/chat-store'

// Pulsing dots animation component (like iMessage typing indicator)
function PulsingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5">
      <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  )
}

// Map step types to user-friendly labels and icons
const STEP_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  // Plan mode phases
  'planning_start': { label: 'Analyzing request', icon: Brain },
  'clarification': { label: 'Gathering requirements', icon: MessageSquare },
  'subreddit_search': { label: 'Finding subreddits', icon: Search },
  'subreddit_discovery': { label: 'Discovering subreddits', icon: Database },
  'selection': { label: 'Waiting for selection', icon: FileText },
  'preview': { label: 'Preparing search plan', icon: FileText },

  // Execution phases
  'executing_search': { label: 'Searching Reddit', icon: Search },
  'search_start': { label: 'Starting search', icon: Search },
  'search_progress': { label: 'Searching', icon: Search },
  'analysis_start': { label: 'Analyzing posts', icon: Brain },
  'synthesis_start': { label: 'Generating response', icon: Sparkles },

  // Generic
  'working': { label: 'Processing', icon: Loader2 },
}

function getStepLabel(step: ThinkingStep): string {
  const stepType = step.step || ''
  const config = STEP_CONFIG[stepType]
  if (config) {
    return config.label
  }
  // Fall back to the content if no mapping exists
  return step.content
}

function getStepIcon(step: ThinkingStep): React.ElementType {
  const stepType = step.step || ''
  const config = STEP_CONFIG[stepType]
  return config?.icon || Brain
}

interface ThinkingIndicatorProps {
  messageId: string
  steps: ThinkingStep[]
  isStreamingActive?: boolean
  className?: string
}

export function ThinkingIndicator({ 
  messageId,
  steps, 
  isStreamingActive = false,
  className = ''
}: ThinkingIndicatorProps) {
  const settings = useChatStore(state => state.settings)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [autoShow, setAutoShow] = React.useState(false)

  // Auto-show logic based on complexity and settings
  useEffect(() => {
    if (settings.showThinking === 'auto') {
      const hasHighImportanceSteps = steps.some(step => step.importance === 'high')
      const hasMultipleSteps = steps.length > 2
      const complexQuery = hasHighImportanceSteps || hasMultipleSteps
      setAutoShow(complexQuery)
      
      // Auto-expand if there are high importance steps
      if (hasHighImportanceSteps && !isExpanded) {
        setIsExpanded(true)
      }
    } else if (settings.showThinking === 'always') {
      setAutoShow(true)
    }
  }, [steps, settings.showThinking, isExpanded])

  const shouldShow = settings.showThinking === 'always' || 
                    (settings.showThinking === 'auto' && autoShow) || 
                    (settings.showThinking === 'on-demand' && steps.length > 0)

  if (!shouldShow || steps.length === 0) return null

  const completedSteps = steps.filter(step => step.isCompleted).length
  const totalSteps = steps.length
  const latestStep = steps[steps.length - 1]

  return (
    <div className={`thinking-indicator border-l-2 border-blue-500/30 pl-4 mb-4 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition-colors duration-200 group w-full text-left"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Hide' : 'Show'} AI reasoning steps`}
      >
        {isExpanded ? (
          <ChevronDown size={16} className="transition-transform flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="transition-transform flex-shrink-0" />
        )}

        <Brain
          size={16}
          className={`flex-shrink-0 transition-colors ${
            isStreamingActive
              ? 'animate-pulse text-blue-400'
              : 'text-blue-400 group-hover:text-blue-300'
          }`}
        />

        <span className="font-medium flex-shrink-0 flex items-center">
          {isStreamingActive ? (
            <>
              <span className="truncate max-w-[300px]">
                {latestStep?.content || 'Processing'}
              </span>
              <PulsingDots />
            </>
          ) : 'AI Reasoning'}
        </span>

        {!isStreamingActive && totalSteps > 0 && (
          <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full flex-shrink-0">
            {completedSteps}/{totalSteps} steps
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2" role="list" aria-label="AI reasoning steps">
          {steps.map((step, index) => {
            const StepIcon = getStepIcon(step)
            const stepLabel = getStepLabel(step)
            const isCurrentStep = isStreamingActive && index === steps.length - 1

            return (
              <div
                key={step.id}
                role="listitem"
                className={`p-3 rounded-lg text-sm transition-all duration-300 ${
                  step.isCompleted
                    ? 'bg-green-500/20 border-green-500/30 border'
                    : isCurrentStep
                    ? 'bg-blue-500/20 border-blue-500/30 border'
                    : 'bg-white/[0.02] border-white/10 border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {step.isCompleted ? (
                      <CheckCircle size={16} className="text-green-400" />
                    ) : isCurrentStep ? (
                      <StepIcon size={16} className="text-blue-400 animate-pulse" />
                    ) : (
                      <StepIcon size={16} className="text-white/30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white/90">
                        {stepLabel}
                      </span>

                      {step.importance === 'high' && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-medium">
                          Important
                        </span>
                      )}

                      <span className="text-xs text-white/40">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Show the raw message content if it differs from the label */}
                    {step.content !== stepLabel && (
                      <p className="text-white/60 leading-relaxed text-xs">
                        {step.content}
                      </p>
                    )}

                    {/* Show metadata if available */}
                    {step.metadata && (
                      <div className="mt-1 text-xs text-white/40">
                        {step.metadata.subreddit && (
                          <span className="mr-2">r/{step.metadata.subreddit}</span>
                        )}
                        {step.metadata.keyword && (
                          <span className="mr-2">"{step.metadata.keyword}"</span>
                        )}
                        {typeof step.metadata.progress === 'number' && step.metadata.total && (
                          <span className="text-blue-400">
                            {step.metadata.progress}/{step.metadata.total}
                          </span>
                        )}
                      </div>
                    )}

                    {typeof step.score === 'number' && (
                      <span className="text-xs font-mono text-blue-400">(score: {step.score.toFixed(2)})</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {isStreamingActive && (
            <div className="flex items-center gap-2 text-xs text-blue-400 mt-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 