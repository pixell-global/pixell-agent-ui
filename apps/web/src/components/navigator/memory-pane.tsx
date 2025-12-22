'use client'

import React, { useEffect, useState } from 'react'
import { Brain, Search, Plus, Pencil, Trash2, Filter, Globe, Bot, RefreshCw, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useMemoryStore,
  Memory,
  MemoryCategory,
  MemoryFilterType,
} from '@/stores/memory-store'

// =============================================================================
// TYPES
// =============================================================================

interface MemoryPaneProps {
  className?: string
}

// =============================================================================
// CATEGORY LABELS & COLORS
// =============================================================================

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  user_preference: 'Preferences',
  project_context: 'Project',
  domain_knowledge: 'Knowledge',
  conversation_goal: 'Goals',
  entity: 'Entities',
}

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  user_preference: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  project_context: 'bg-green-500/20 text-green-400 border-green-500/30',
  domain_knowledge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  conversation_goal: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  entity: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
}

// =============================================================================
// MEMORY CARD COMPONENT
// =============================================================================

interface MemoryCardProps {
  memory: Memory
  onEdit: (memory: Memory) => void
  onDelete: (id: string) => void
}

const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'group rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-colors',
        'hover:bg-white/[0.04] hover:border-white/20',
        !memory.isActive && 'opacity-50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 hover:bg-white/10 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-white/50" />
            ) : (
              <ChevronRight className="h-3 w-3 text-white/50" />
            )}
          </button>
          <span className="text-sm font-medium text-white/90 truncate">
            {memory.key}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(memory)}
            className="h-6 w-6 p-0 text-white/50 hover:text-white hover:bg-white/10"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(memory.id)}
            className="h-6 w-6 p-0 text-white/50 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Category badge and scope */}
      <div className="flex items-center gap-2 mt-2">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0', CATEGORY_COLORS[memory.category])}
        >
          {CATEGORY_LABELS[memory.category]}
        </Badge>
        {memory.agentId ? (
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <Bot className="h-2.5 w-2.5" />
            Agent
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <Globe className="h-2.5 w-2.5" />
            Global
          </span>
        )}
        <span className="text-[10px] text-white/30 ml-auto">
          {memory.usageCount}x used
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <p className="text-xs text-white/70 whitespace-pre-wrap">
            {memory.value}
          </p>
          <div className="flex items-center justify-between mt-2 text-[10px] text-white/30">
            <span>Confidence: {(memory.confidence * 100).toFixed(0)}%</span>
            <span>
              {new Date(memory.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const MemoryPane: React.FC<MemoryPaneProps> = ({ className }) => {
  const {
    memories,
    stats,
    memoriesLoading,
    filterType,
    categoryFilter,
    searchQuery,
    fetchMemories,
    deleteMemory,
    setFilterType,
    setCategoryFilter,
    setSearchQuery,
    clearFilters,
    getFilteredMemories,
  } = useMemoryStore()

  const [showFilters, setShowFilters] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)

  // Load memories on mount
  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const filteredMemories = getFilteredMemories()

  const handleDeleteMemory = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this memory?')) {
      await deleteMemory(id)
    }
  }

  const handleEditMemory = (memory: Memory) => {
    setEditingMemory(memory)
    // TODO: Open edit dialog
  }

  const hasActiveFilters = filterType !== 'all' || categoryFilter !== null || searchQuery.trim() !== ''

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="p-3 border-b border-white/10 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm bg-white/[0.02] border-white/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/10 rounded"
            >
              <X className="h-3 w-3 text-white/50" />
            </button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={filterType === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('all')}
            className={cn(
              'h-7 px-2 text-xs',
              filterType === 'all' ? 'bg-white/10' : ''
            )}
          >
            All
          </Button>
          <Button
            variant={filterType === 'global' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('global')}
            className={cn(
              'h-7 px-2 text-xs flex items-center gap-1',
              filterType === 'global' ? 'bg-white/10' : ''
            )}
          >
            <Globe className="h-3 w-3" />
            Global
          </Button>
          <Button
            variant={filterType === 'agent' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterType('agent')}
            className={cn(
              'h-7 px-2 text-xs flex items-center gap-1',
              filterType === 'agent' ? 'bg-white/10' : ''
            )}
          >
            <Bot className="h-3 w-3" />
            Agent
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'h-7 w-7 p-0 ml-auto',
              showFilters || categoryFilter ? 'bg-white/10' : ''
            )}
          >
            <Filter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchMemories()}
            disabled={memoriesLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', memoriesLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* Category filters (collapsible) */}
        {showFilters && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={cn(
                  'cursor-pointer text-[10px] transition-colors',
                  categoryFilter === cat
                    ? CATEGORY_COLORS[cat]
                    : 'bg-transparent text-white/50 border-white/20 hover:bg-white/5'
                )}
              >
                {CATEGORY_LABELS[cat]}
                {stats?.byCategory[cat] ? (
                  <span className="ml-1 opacity-60">
                    ({stats.byCategory[cat]})
                  </span>
                ) : null}
              </Badge>
            ))}
          </div>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs text-white/50 hover:text-white"
          >
            <X className="h-3 w-3 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {memoriesLoading && memories.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-white/40">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading memories...
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="h-8 w-8 text-white/20 mb-2" />
            <p className="text-sm text-white/50">
              {searchQuery || categoryFilter || filterType !== 'all'
                ? 'No memories match your filters'
                : 'No memories yet'}
            </p>
            <p className="text-xs text-white/30 mt-1">
              {searchQuery || categoryFilter || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Memories are automatically extracted from conversations'}
            </p>
          </div>
        ) : (
          filteredMemories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={handleEditMemory}
              onDelete={handleDeleteMemory}
            />
          ))
        )}
      </div>

      {/* Footer stats */}
      {stats && (
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <div className="flex items-center gap-1">
              <Brain className="h-3.5 w-3.5" />
              <span>{stats.active} active</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {stats.globalCount}
              </span>
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {stats.total - stats.globalCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
