'use client'

import React, { useEffect, useState } from 'react'
import { Bot, ChevronDown, Check, Loader2, AlertCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { AgentConfig } from '@pixell/protocols'

export type { AgentConfig }

const DEFAULT_AGENT_KEY = 'pixell-default-agent-id'

interface AgentSelectorProps {
  selectedAgent: AgentConfig | null
  onSelectAgent: (agent: AgentConfig | null) => void
  disabled?: boolean
  className?: string
}

export function AgentSelector({
  selectedAgent,
  onSelectAgent,
  disabled = false,
  className = ''
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null)

  // Load user's default agent preference from localStorage
  useEffect(() => {
    const savedDefault = localStorage.getItem(DEFAULT_AGENT_KEY)
    if (savedDefault) {
      setDefaultAgentId(savedDefault)
    }
  }, [])

  // Fetch agents from orchestrator
  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true)
        setError(null)

        const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001'
        const response = await fetch(`${orchestratorUrl}/api/agents`)

        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.status}`)
        }

        const data = await response.json()

        if (data.ok && data.agents) {
          setAgents(data.agents)

          // If no agent selected, select the user's default or server default
          if (!selectedAgent) {
            const savedDefaultId = localStorage.getItem(DEFAULT_AGENT_KEY)
            const userDefault = savedDefaultId
              ? data.agents.find((a: AgentConfig) => a.id === savedDefaultId)
              : null
            const serverDefault = data.agents.find((a: AgentConfig) => a.default)
            const defaultAgent = userDefault || serverDefault || data.agents[0]
            if (defaultAgent) {
              onSelectAgent(defaultAgent)
            }
          }
        } else {
          throw new Error(data.error || 'Failed to load agents')
        }
      } catch (err) {
        console.error('Error fetching agents:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agents')

        // Use fallback agents
        const fallbackAgents: AgentConfig[] = [
          {
            id: 'paf-core',
            name: 'PAF Core Agent',
            description: 'General-purpose AI assistant',
            url: 'http://localhost:8000',
            protocol: 'paf',
            default: true,
            capabilities: ['streaming', 'thinking']
          }
        ]
        setAgents(fallbackAgents)

        if (!selectedAgent) {
          onSelectAgent(fallbackAgents[0])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetDefault = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation()
    localStorage.setItem(DEFAULT_AGENT_KEY, agentId)
    setDefaultAgentId(agentId)
  }

  const isUserDefault = (agentId: string) => defaultAgentId === agentId

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || agents.length === 0}
          className={`flex items-center gap-2 ${className}`}
        >
          <Bot size={14} />
          <span className="max-w-[120px] truncate">
            {selectedAgent?.name || 'Select Agent'}
          </span>
          <ChevronDown size={14} className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
        {error && (
          <div className="px-2 py-1.5 text-xs text-orange-400 flex items-center gap-1">
            <AlertCircle size={12} />
            <span>Using fallback config</span>
          </div>
        )}

        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="group flex items-start gap-3 py-2 cursor-pointer"
          >
            <div className="flex-shrink-0 mt-0.5">
              {selectedAgent?.id === agent.id ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Bot size={16} className="text-white/40" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate text-white/90">
                  {agent.name}
                </span>
                {isUserDefault(agent.id) && (
                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                )}
              </div>

              {agent.description && (
                <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                  {agent.description}
                </p>
              )}
            </div>

            {!isUserDefault(agent.id) && (
              <button
                onClick={(e) => handleSetDefault(e, agent.id)}
                className="flex-shrink-0 p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Set as default"
              >
                <Star size={12} className="text-white/40 hover:text-yellow-400" />
              </button>
            )}
          </DropdownMenuItem>
        ))}

        {!defaultAgentId && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] text-white/40">
              Click <Star size={10} className="inline text-white/40" /> to set default agent
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
