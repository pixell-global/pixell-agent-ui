'use client'

import React, { useEffect, useState } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { AgentPromptCards } from './AgentPromptCards'
import { RotatingTip } from './RotatingTip'
import { AgentHealthBanner } from './AgentHealthBanner'
import { AgentCapabilitiesTooltip } from './AgentCapabilitiesTooltip'
import { getPromptsForAgent } from '@/data/agent-prompts'
import { getTodaysTip } from '@/data/daily-tips'

interface WelcomeStateProps {
  className?: string
}

export function WelcomeState({ className = '' }: WelcomeStateProps) {
  const selectedAgent = useChatStore((state) => state.selectedAgent)
  const agentHealth = useChatStore((state) => state.agentHealth)
  const setInputPrefill = useChatStore((state) => state.setInputPrefill)

  const [animationKey, setAnimationKey] = useState(0)

  // Re-trigger animation when agent changes
  useEffect(() => {
    setAnimationKey((prev) => prev + 1)
  }, [selectedAgent?.id])

  const prompts = getPromptsForAgent(selectedAgent?.id)
  const todaysTip = getTodaysTip()

  const handlePromptClick = (promptText: string) => {
    setInputPrefill(promptText)
  }

  const agentName = selectedAgent?.name || 'Pixell Agents'
  const agentDescription =
    selectedAgent?.description || 'Start a conversation with our AI agents. They can help you with various tasks and workflows.'

  return (
    <div
      className={`flex flex-col items-center justify-center h-full text-center p-8 ${className}`}
    >
      <div className="max-w-lg w-full">
        {/* Health Warning Banner */}
        {agentHealth && !agentHealth.healthy && (
          <AgentHealthBanner health={agentHealth} />
        )}

        {/* Welcome Header with Agent Name + Tooltip */}
        <div key={animationKey} className="mb-6 welcome-content-enter">
          <h2 className="text-2xl font-semibold text-white mb-3 flex items-center justify-center gap-2 flex-wrap">
            Welcome to{' '}
            <span className="relative group inline-flex items-center">
              <span className="cursor-help border-b border-dashed border-white/30 text-pixell-yellow">
                {agentName}
              </span>
              {selectedAgent && <AgentCapabilitiesTooltip agent={selectedAgent} />}
            </span>
          </h2>
          <p className="text-white/60 leading-relaxed text-sm">{agentDescription}</p>
        </div>

        {/* File Awareness Note */}
        <p className="text-xs text-white/40 mb-6">
          Attach files or use @filename to include file context in your messages.
        </p>

        {/* Prompt Cards */}
        <AgentPromptCards
          prompts={prompts}
          onPromptClick={handlePromptClick}
          agentId={selectedAgent?.id}
        />

        {/* Rotating Tip */}
        <RotatingTip tip={todaysTip} />
      </div>
    </div>
  )
}

export { PromptCard } from './PromptCard'
export { AgentPromptCards } from './AgentPromptCards'
export { AgentCapabilitiesTooltip } from './AgentCapabilitiesTooltip'
export { AgentHealthBanner } from './AgentHealthBanner'
export { RotatingTip } from './RotatingTip'
