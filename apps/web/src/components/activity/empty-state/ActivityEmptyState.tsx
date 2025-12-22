'use client'

import React, { useState, useEffect } from 'react'
import { ActivityPreview } from './components/ActivityPreview'
import { MinimalEmptyState } from './components/MinimalEmptyState'

interface ActivityEmptyStateProps {
  size?: 'sm' | 'md'
}

// Key for localStorage
const PREVIEW_DISMISSED_KEY = 'pixell-activity-preview-dismissed'

function isPreviewDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(PREVIEW_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

function setPreviewDismissed(dismissed: boolean) {
  try {
    if (dismissed) {
      localStorage.setItem(PREVIEW_DISMISSED_KEY, 'true')
    } else {
      localStorage.removeItem(PREVIEW_DISMISSED_KEY)
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function ActivityEmptyState({ size = 'sm' }: ActivityEmptyStateProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Check localStorage on mount
  useEffect(() => {
    setIsDismissed(isPreviewDismissed())
    setIsHydrated(true)
  }, [])

  const handleDismiss = () => {
    setIsDismissed(true)
    setPreviewDismissed(true)
  }

  const handleRestore = () => {
    setIsDismissed(false)
    setPreviewDismissed(false)
  }

  const handleStartConversation = () => {
    // Focus on the chat input by dispatching a custom event
    // The ChatInput component can listen for this if needed
    // For now, we just scroll to the chat area
    const chatInput = document.querySelector('.chat-input textarea')
    if (chatInput instanceof HTMLTextAreaElement) {
      chatInput.focus()
    }
  }

  // Don't render until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return null
  }

  if (isDismissed) {
    return (
      <MinimalEmptyState
        onRestore={handleRestore}
        onStartConversation={handleStartConversation}
      />
    )
  }

  return (
    <ActivityPreview
      onDismiss={handleDismiss}
      onStartConversation={handleStartConversation}
    />
  )
}
