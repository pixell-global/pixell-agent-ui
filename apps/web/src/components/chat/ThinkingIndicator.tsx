'use client'

import React, { useEffect } from 'react'
import { ChevronDown, ChevronRight, Brain, Clock, CheckCircle } from 'lucide-react'
import { ThinkingStep, ChatUISettings } from '@/types'
import { useChatStore } from '@/stores/chat-store'

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

  return (
    <div className={`thinking-indicator border-l-2 border-blue-200 pl-4 mb-4 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors group"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Hide' : 'Show'} AI reasoning steps`}
      >
        {isExpanded ? (
          <ChevronDown size={16} className="transition-transform" />
        ) : (
          <ChevronRight size={16} className="transition-transform" />
        )}
        
        <Brain 
          size={16} 
          className={`transition-colors ${
            isStreamingActive 
              ? 'animate-pulse text-blue-500' 
              : 'text-blue-600 group-hover:text-blue-700'
          }`} 
        />
        
        <span className="font-medium">
          {isStreamingActive ? 'Thinking...' : 'AI Reasoning'}
        </span>
        
        {!isStreamingActive && totalSteps > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {completedSteps}/{totalSteps} steps
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2" role="list" aria-label="AI reasoning steps">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              role="listitem"
              className={`p-3 rounded-lg text-sm transition-all duration-300 ${
                step.isCompleted 
                  ? 'bg-green-50 border-green-200 border' 
                  : isStreamingActive && index === steps.length - 1
                  ? 'bg-blue-50 border-blue-200 border'
                  : 'bg-gray-50 border-gray-200 border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {step.isCompleted ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : isStreamingActive && index === steps.length - 1 ? (
                    <Clock size={16} className="text-blue-600 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      Step {index + 1}
                    </span>
                    
                    {step.importance === 'high' && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                        Important
                      </span>
                    )}
                    
                    <span className="text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed">{step.content}</p>
                </div>
              </div>
            </div>
          ))}
          
          {isStreamingActive && (
            <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 