import React from 'react'
import { Button } from '@/components/ui/button'
import { Activity, CheckCircle, Clock, Zap, AlertCircle, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeaturePreviewProps {
  title?: string
  description?: string
  suggestions?: string[]
  actions?: Array<{
    label: string
    variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link'
    onClick?: () => void
  }>
  className?: string
}

export const FeaturePreview: React.FC<FeaturePreviewProps> = ({
  title = 'Activities Preview',
  description = 'Here\'s what you can expect to see when activities are active.',
  suggestions = [
    'Live task progress',
    'Agent status updates',
    'Real-time metrics'
  ],
  actions = [],
  className
}) => {
  const previewCards = [
    {
      icon: Activity,
      title: 'Live Metrics',
      description: 'Real-time performance data',
      status: 'active' as const
    },
    {
      icon: CheckCircle,
      title: 'Task Progress',
      description: 'Current job completion status',
      status: 'completed' as const
    },
    {
      icon: Clock,
      title: 'Recent Jobs',
      description: 'Latest agent activities',
      status: 'pending' as const
    }
  ]

  const getStatusColor = (status: 'active' | 'completed' | 'pending') => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'completed':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    }
  }

  return (
    <div className={cn('flex flex-col h-full p-6', className)}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {/* Preview Cards */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Preview of upcoming activities:</h4>
          <div className="space-y-2">
            {previewCards.map((card, index) => (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-lg border-2 border-dashed transition-all duration-300 hover:border-solid hover:shadow-sm',
                  getStatusColor(card.status)
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center">
                    <card.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium truncate">{card.title}</h5>
                    <p className="text-xs opacity-75 truncate">{card.description}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Get started:</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-2 rounded-md bg-muted/30"
                >
                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex flex-col space-y-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={action.onClick}
                className="w-full"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
