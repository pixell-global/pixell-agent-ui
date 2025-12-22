'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface PromptCardProps {
  icon: LucideIcon
  title: string
  description: string
  promptText: string
  onClick: (promptText: string) => void
  className?: string
}

export function PromptCard({
  icon: Icon,
  title,
  description,
  promptText,
  onClick,
  className = '',
}: PromptCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(promptText)}
      className={`
        p-4 text-left w-full rounded-xl
        bg-white/[0.03] border border-white/10
        transition-all duration-200 ease-out
        hover:scale-[1.02] hover:border-pixell-yellow/30 hover:bg-white/[0.06]
        active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-pixell-yellow/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-pixell-yellow/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-pixell-yellow" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm mb-1">{title}</h3>
          <p className="text-xs text-white/50 line-clamp-2">{description}</p>
        </div>
      </div>
    </button>
  )
}
