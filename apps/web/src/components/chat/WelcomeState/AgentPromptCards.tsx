'use client'

import React, { useState, useEffect } from 'react'
import { PromptCard } from './PromptCard'
import type { AgentPrompt } from '@/data/agent-prompts'

interface AgentPromptCardsProps {
  prompts: AgentPrompt[]
  onPromptClick: (promptText: string) => void
  agentId?: string
}

export function AgentPromptCards({
  prompts,
  onPromptClick,
  agentId,
}: AgentPromptCardsProps) {
  // Animation key that changes when agent changes
  const [animationKey, setAnimationKey] = useState(0)

  // Re-trigger animation when agent changes
  useEffect(() => {
    setAnimationKey((prev) => prev + 1)
  }, [agentId])

  return (
    <div key={animationKey} className="grid gap-3">
      {prompts.map((prompt, index) => (
        <PromptCard
          key={prompt.id}
          icon={prompt.icon}
          title={prompt.title}
          description={prompt.description}
          promptText={prompt.promptText}
          onClick={onPromptClick}
          className={`welcome-content-enter prompt-card-stagger-${index + 1}`}
        />
      ))}
    </div>
  )
}
