'use client'

import React, { useState, useEffect } from 'react'
import { Lightbulb, X } from 'lucide-react'
import type { DailyTip } from '@/data/daily-tips'

interface RotatingTipProps {
  tip: DailyTip
}

// Key for localStorage
const DISMISSED_TIPS_KEY = 'pixell-dismissed-tips'

function getDismissedTips(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(DISMISSED_TIPS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveDismissedTip(tipId: string) {
  try {
    const current = getDismissedTips()
    if (!current.includes(tipId)) {
      localStorage.setItem(DISMISSED_TIPS_KEY, JSON.stringify([...current, tipId]))
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function RotatingTip({ tip }: RotatingTipProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  // Check if already dismissed on mount
  useEffect(() => {
    const dismissed = getDismissedTips()
    if (dismissed.includes(tip.id)) {
      setIsVisible(false)
    }
  }, [tip.id])

  const handleDismiss = () => {
    setIsAnimatingOut(true)
    setTimeout(() => {
      setIsVisible(false)
      saveDismissedTip(tip.id)
    }, 200)
  }

  if (!isVisible) return null

  return (
    <div
      className={`
        mt-8 p-3 bg-pixell-yellow/10 border border-pixell-yellow/20 rounded-xl
        transition-all duration-200
        ${isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
      `}
    >
      <div className="flex items-start gap-3">
        <Lightbulb className="text-pixell-yellow flex-shrink-0 mt-0.5" size={16} />
        <p className="text-sm text-pixell-yellow/90 flex-1 text-left">
          <span className="font-medium">Tip: </span>
          {tip.text}
        </p>
        <button
          onClick={handleDismiss}
          className="text-pixell-yellow/60 hover:text-pixell-yellow transition-colors p-1 -mr-1 -mt-1"
          aria-label="Dismiss tip"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
