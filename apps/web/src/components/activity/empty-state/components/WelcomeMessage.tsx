import React from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, FileText, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WelcomeMessageProps {
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

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  title = 'Welcome to Activities',
  description = 'Your agent activities will appear here when you start working.',
  suggestions = [
    'Start a conversation with an AI agent',
    'Upload files to analyze',
    'Try asking: "Help me analyze this project"'
  ],
  actions = [],
  className
}) => {
  const handleSuggestionClick = (suggestion: string) => {
    // This would typically trigger the suggested action
    console.log('Suggestion clicked:', suggestion)
  }

  return (
    <div className={cn('flex flex-col items-center justify-center h-full p-6 text-center', className)}>
      <div className="max-w-md space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Title and Description */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Try asking:</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      {index === 0 && <MessageSquare className="w-3 h-3 text-muted-foreground group-hover:text-primary" />}
                      {index === 1 && <FileText className="w-3 h-3 text-muted-foreground group-hover:text-primary" />}
                      {index === 2 && <Zap className="w-3 h-3 text-muted-foreground group-hover:text-primary" />}
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {suggestion}
                    </span>
                  </div>
                </button>
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
