'use client'

import React, { useState, useEffect } from 'react'
import { Search, X, Filter, Archive } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ActivityFilters as ActivityFiltersType, ActivityCounts, ActivityStatus, ActivityType } from '@/stores/workspace-store'

interface FilterChipProps {
  label: string
  value: string
  count?: number
  selected: boolean
  onToggle: () => void
}

function FilterChip({ label, value, count, selected, onToggle }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn(
          'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs rounded-full',
          selected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-foreground'
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

interface ActivityFiltersProps {
  filters: ActivityFiltersType
  counts: ActivityCounts | null
  onFiltersChange: (filters: Partial<ActivityFiltersType>) => void
  onReset: () => void
  className?: string
}

export function ActivityFilters({
  filters,
  counts,
  onFiltersChange,
  onReset,
  className,
}: ActivityFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const [agents, setAgents] = useState<{ id: string; activityCount: number }[]>([])

  // Fetch agents for filter dropdown
  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/activities/agents')
        if (response.ok) {
          const data = await response.json()
          setAgents(data.agents || [])
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error)
      }
    }
    fetchAgents()
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ search: searchInput })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, filters.search, onFiltersChange])

  const toggleStatus = (status: ActivityStatus) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status]
    onFiltersChange({ status: newStatuses })
  }

  const toggleType = (type: ActivityType) => {
    const newTypes = filters.type.includes(type)
      ? filters.type.filter(t => t !== type)
      : [...filters.type, type]
    onFiltersChange({ type: newTypes })
  }

  const toggleAgent = (agentId: string) => {
    const newAgents = filters.agent.includes(agentId)
      ? filters.agent.filter(a => a !== agentId)
      : [...filters.agent, agentId]
    onFiltersChange({ agent: newAgents })
  }

  const toggleArchived = () => {
    onFiltersChange({ archived: !filters.archived })
  }

  const hasActiveFilters = filters.status.length > 0 ||
    filters.type.length > 0 ||
    filters.agent.length > 0 ||
    filters.search ||
    filters.archived

  const statusOptions: { value: ActivityStatus; label: string }[] = [
    { value: 'running', label: 'Running' },
    { value: 'pending', label: 'Pending' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const typeOptions: { value: ActivityType; label: string }[] = [
    { value: 'task', label: 'Tasks' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'workflow', label: 'Workflows' },
  ]

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search activities..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter chips - Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-3 w-3" />
          Status
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              value={value}
              count={counts?.byStatus[value]}
              selected={filters.status.includes(value)}
              onToggle={() => toggleStatus(value)}
            />
          ))}
        </div>
      </div>

      {/* Filter chips - Type */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-3 w-3" />
          Type
        </div>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              value={value}
              count={counts?.byType[value]}
              selected={filters.type.includes(value)}
              onToggle={() => toggleType(value)}
            />
          ))}
        </div>
      </div>

      {/* Filter chips - Agent (if any) */}
      {agents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Filter className="h-3 w-3" />
            Agent
          </div>
          <div className="flex flex-wrap gap-2">
            {agents.map(({ id, activityCount }) => (
              <FilterChip
                key={id}
                label={id}
                value={id}
                count={activityCount}
                selected={filters.agent.includes(id)}
                onToggle={() => toggleAgent(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Archive toggle and reset */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          type="button"
          onClick={toggleArchived}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filters.archived
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived
          {counts?.archived !== undefined && counts.archived > 0 && (
            <span className={cn(
              'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs rounded-full',
              filters.archived ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-foreground'
            )}>
              {counts.archived}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="h-3.5 w-3.5 mr-1" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
