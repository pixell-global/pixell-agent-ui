'use client'

import React, { useEffect } from 'react'
import { Brain, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMemoryStore } from '@/stores/memory-store'

interface MemoryIndicatorProps {
  className?: string
  disabled?: boolean
}

export const MemoryIndicator: React.FC<MemoryIndicatorProps> = ({
  className,
  disabled = false,
}) => {
  const {
    stats,
    incognitoMode,
    settings,
    toggleIncognitoMode,
    fetchMemories,
    fetchSettings,
  } = useMemoryStore()

  // Load memories and settings on mount
  useEffect(() => {
    fetchMemories()
    fetchSettings()
  }, [fetchMemories, fetchSettings])

  // Check if memory is enabled (from server settings)
  const memoryEnabled = settings?.memoryEnabled !== false

  // If memory is completely disabled, don't show the indicator
  if (!memoryEnabled) {
    return null
  }

  const activeCount = stats?.active ?? 0

  const tooltipText = incognitoMode
    ? 'Incognito Mode - Memory disabled. Click to enable.'
    : `${activeCount} memories active. Click to enable incognito mode.`

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleIncognitoMode}
      disabled={disabled}
      title={tooltipText}
      className={cn(
        'h-8 px-2.5 gap-1.5 text-xs font-medium transition-all duration-200 border rounded-lg',
        incognitoMode
          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30'
          : activeCount > 0
            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30'
            : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/70',
        className
      )}
    >
      {incognitoMode ? (
        <>
          <EyeOff className="h-3.5 w-3.5" />
          <span>Incognito</span>
        </>
      ) : (
        <>
          <Brain className="h-3.5 w-3.5" />
          <span>{activeCount}</span>
        </>
      )}
    </Button>
  )
}
