import React from 'react'
import { EmptyStateType } from './types'
import { WelcomeMessage } from './components/WelcomeMessage'
import { FeaturePreview } from './components/FeaturePreview'
import { ContextualHints } from './components/ContextualHints'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'
import { cn } from '@/lib/utils'

interface EmptyStateRendererProps {
  stateType: EmptyStateType
  dynamicContent?: {
    title?: string
    description?: string
    suggestions?: string[]
    actions?: Array<{
      label: string
      variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link'
      onClick?: () => void
    }>
  }
  onStateChange?: (newState: EmptyStateType) => void
  onUserInteraction?: (interaction: { type: 'click' | 'dismiss' | 'action'; target: string }) => void
  className?: string
}

export const EmptyStateRenderer: React.FC<EmptyStateRendererProps> = ({
  stateType,
  dynamicContent,
  onStateChange,
  onUserInteraction,
  className
}) => {
  const handleInteraction = (type: 'click' | 'dismiss' | 'action', target: string) => {
    onUserInteraction?.({ type, target })
  }

  const renderState = () => {
    switch (stateType) {
      case 'welcome':
        return (
          <WelcomeMessage
            title={dynamicContent?.title}
            description={dynamicContent?.description}
            suggestions={dynamicContent?.suggestions}
            actions={dynamicContent?.actions?.map(action => ({
              ...action,
              onClick: () => {
                action.onClick?.()
                handleInteraction('action', action.label)
              }
            }))}
            className={className}
          />
        )

      case 'feature-preview':
        return (
          <FeaturePreview
            title={dynamicContent?.title}
            description={dynamicContent?.description}
            suggestions={dynamicContent?.suggestions}
            actions={dynamicContent?.actions?.map(action => ({
              ...action,
              onClick: () => {
                action.onClick?.()
                handleInteraction('action', action.label)
              }
            }))}
            className={className}
          />
        )

      case 'contextual-hints':
        return (
          <ContextualHints
            title={dynamicContent?.title}
            description={dynamicContent?.description}
            suggestions={dynamicContent?.suggestions}
            actions={dynamicContent?.actions?.map(action => ({
              ...action,
              onClick: () => {
                action.onClick?.()
                handleInteraction('action', action.label)
              }
            }))}
            className={className}
          />
        )

      case 'loading':
        return (
          <LoadingState
            message={dynamicContent?.description}
            className={className}
          />
        )

      case 'error':
        return (
          <ErrorState
            title={dynamicContent?.title}
            message={dynamicContent?.description}
            onRetry={() => {
              onStateChange?.('loading')
              handleInteraction('action', 'retry')
            }}
            className={className}
          />
        )

      default:
        return (
          <WelcomeMessage
            title="Welcome to Activities"
            description="Your agent activities will appear here when you start working."
            className={className}
          />
        )
    }
  }

  return (
    <div className={cn('h-full w-full', className)}>
      {renderState()}
    </div>
  )
}
