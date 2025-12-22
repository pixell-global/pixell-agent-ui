'use client'

import React, { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, Globe, Bot } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

export interface MemoryReference {
  id: string
  key: string
  value: string
  category: 'user_preference' | 'project_context' | 'domain_knowledge' | 'conversation_goal' | 'entity'
  agentId?: string | null
}

interface MemoryUsedSectionProps {
  memoriesUsed: MemoryReference[]
  className?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  user_preference: 'Preference',
  project_context: 'Project',
  domain_knowledge: 'Knowledge',
  conversation_goal: 'Goal',
  entity: 'Entity',
}

const CATEGORY_COLORS: Record<string, string> = {
  user_preference: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  project_context: 'bg-green-500/20 text-green-400 border-green-500/30',
  domain_knowledge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  conversation_goal: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  entity: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
}

// =============================================================================
// COMPONENT
// =============================================================================

export const MemoryUsedSection: React.FC<MemoryUsedSectionProps> = ({
  memoriesUsed,
  className,
}) => {
  const [expanded, setExpanded] = useState(false)

  if (!memoriesUsed || memoriesUsed.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'mt-3 pt-3 border-t border-white/10',
        className
      )}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-white/50 hover:text-white/70 transition-colors w-full"
      >
        <div className="flex items-center gap-1.5">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Brain className="h-3.5 w-3.5 text-purple-400" />
        </div>
        <span>
          {memoriesUsed.length} {memoriesUsed.length === 1 ? 'memory' : 'memories'} used
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 space-y-2 pl-6">
          {memoriesUsed.map((memory) => (
            <div
              key={memory.id}
              className="p-2 rounded-lg bg-white/[0.02] border border-white/5"
            >
              {/* Memory header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white/80 truncate">
                  {memory.key}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-1 py-0 h-4',
                    CATEGORY_COLORS[memory.category] || 'bg-white/10 text-white/60'
                  )}
                >
                  {CATEGORY_LABELS[memory.category] || memory.category}
                </Badge>
                {memory.agentId ? (
                  <span className="flex items-center gap-0.5 text-[9px] text-white/30">
                    <Bot className="h-2.5 w-2.5" />
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[9px] text-white/30">
                    <Globe className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>

              {/* Memory value */}
              <p className="text-[11px] text-white/50 line-clamp-2">
                {memory.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
