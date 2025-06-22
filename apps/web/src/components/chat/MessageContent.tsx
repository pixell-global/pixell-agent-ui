'use client'

import React from 'react'
import { FileMention } from '@/types'
import { cn } from '@/lib/utils'

interface MessageContentProps {
  content: string
  mentions?: FileMention[]
  className?: string
}

export function MessageContent({ content, mentions, className }: MessageContentProps) {
  if (!mentions || mentions.length === 0) {
    return <div className={className}>{content}</div>
  }

  // Sort mentions by start index to process them in order
  const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex)
  
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  sortedMentions.forEach((mention, index) => {
    // Add text before the mention
    if (mention.startIndex > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>
          {content.substring(lastIndex, mention.startIndex)}
        </span>
      )
    }

    // Add the highlighted mention
    parts.push(
      <span
        key={`mention-${mention.id}`}
        className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-sm font-medium border border-blue-200 hover:bg-blue-200 transition-colors cursor-pointer"
        title={`File: ${mention.path}`}
      >
        {mention.displayText}
      </span>
    )

    lastIndex = mention.endIndex
  })

  // Add remaining text after the last mention
  if (lastIndex < content.length) {
    parts.push(
      <span key="text-final">
        {content.substring(lastIndex)}
      </span>
    )
  }

  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {parts}
    </div>
  )
} 