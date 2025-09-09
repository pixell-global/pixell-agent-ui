import React from 'react'
import { Button } from '@/components/ui/button'
import { Lightbulb, FileText, Code, Search, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextualHintsProps {
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

export const ContextualHints: React.FC<ContextualHintsProps> = ({
  title = 'Ready to Assist',
  description = 'I can help you with your current project.',
  suggestions = [
    'Analyze your project structure',
    'Review your code for improvements',
    'Generate documentation'
  ],
  actions = [],
  className
}) => {
  const getSuggestionIcon = (suggestion: string, index: number) => {
    if (suggestion.toLowerCase().includes('analyze') || suggestion.toLowerCase().includes('structure')) {
      return <Search className="w-4 h-4" />
    }
    if (suggestion.toLowerCase().includes('code') || suggestion.toLowerCase().includes('review')) {
      return <Code className="w-4 h-4" />
    }
    if (suggestion.toLowerCase().includes('documentation') || suggestion.toLowerCase().includes('readme')) {
      return <FileText className="w-4 h-4" />
    }
    return <Zap className="w-4 h-4" />
  }

  const handleSuggestionClick = (suggestion: string) => {
    // This would typically trigger the suggested action
    console.log('Contextual hint clicked:', suggestion)
  }

  return (
    <div className={cn('flex flex-col h-full p-6', className)}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {/* Contextual Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Based on your workspace:</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      {getSuggestionIcon(suggestion, index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {suggestion}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Quick actions:</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('Quick action: Analyze')}
              className="h-8 text-xs"
            >
              <Search className="w-3 h-3 mr-1" />
              Analyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('Quick action: Generate')}
              className="h-8 text-xs"
            >
              <Zap className="w-3 h-3 mr-1" />
              Generate
            </Button>
          </div>
        </div>

        {/* Custom Actions */}
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
