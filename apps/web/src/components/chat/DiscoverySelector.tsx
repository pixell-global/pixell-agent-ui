'use client'

import React, { useState, useCallback } from 'react'
import { Search, Check, Users, Hash, MessageSquare, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { DiscoveredItem, SelectionResponse } from '@pixell/protocols'

interface DiscoverySelectorProps {
  discoveryType: string // 'subreddits' | 'hashtags' | 'channels' | etc.
  items: DiscoveredItem[]
  onSelect: (response: SelectionResponse) => void
  onCancel?: () => void
  minSelect?: number
  maxSelect?: number
  message?: string
  isSubmitting?: boolean
  className?: string
}

// Icon mapping for different discovery types
const DISCOVERY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  subreddits: MessageSquare,
  hashtags: Hash,
  channels: Users,
  default: Sparkles,
}

// Format metadata for display based on discovery type
function formatMetadata(discoveryType: string, metadata?: Record<string, any>): string[] {
  if (!metadata) return []

  const result: string[] = []

  switch (discoveryType) {
    case 'subreddits':
      if (metadata.subscribers) {
        result.push(`${formatNumber(metadata.subscribers)} members`)
      }
      if (metadata.posts_per_day) {
        result.push(`${metadata.posts_per_day} posts/day`)
      }
      break
    case 'hashtags':
      if (metadata.views) {
        result.push(`${formatNumber(metadata.views)} views`)
      }
      if (metadata.videos) {
        result.push(`${formatNumber(metadata.videos)} videos`)
      }
      if (metadata.engagement) {
        result.push(`${(metadata.engagement * 100).toFixed(1)}% engagement`)
      }
      break
    case 'channels':
      if (metadata.subscribers) {
        result.push(`${formatNumber(metadata.subscribers)} subscribers`)
      }
      if (metadata.avg_views) {
        result.push(`${formatNumber(metadata.avg_views)} avg views`)
      }
      break
    default:
      Object.entries(metadata).forEach(([key, value]) => {
        if (typeof value === 'number') {
          result.push(`${formatNumber(value)} ${key}`)
        } else if (typeof value === 'string') {
          result.push(`${key}: ${value}`)
        }
      })
  }

  return result
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

export function DiscoverySelector({
  discoveryType,
  items,
  onSelect,
  onCancel,
  minSelect = 1,
  maxSelect,
  message,
  isSubmitting = false,
  className = '',
}: DiscoverySelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [expanded, setExpanded] = useState(true)

  const Icon = DISCOVERY_ICONS[discoveryType] || DISCOVERY_ICONS.default

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        // Check max limit
        if (maxSelect && next.size >= maxSelect) {
          return prev
        }
        next.add(id)
      }
      return next
    })
  }, [maxSelect])

  const selectAll = useCallback(() => {
    const limit = maxSelect ?? items.length
    const ids = items.slice(0, limit).map(item => item.id)
    setSelectedIds(new Set(ids))
  }, [items, maxSelect])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleSubmit = useCallback(() => {
    onSelect({
      type: 'selection_response',
      selectedIds: Array.from(selectedIds),
    })
  }, [selectedIds, onSelect])

  // Filter items by search
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchFilter.toLowerCase())
  )

  const canSubmit = selectedIds.size >= minSelect

  return (
    <Card className={`border-purple-500/30 bg-purple-500/10 shadow-lg max-w-lg ${className}`}>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-purple-400" />
            <CardTitle className="text-sm font-medium text-white/90">
              Select {discoveryType.charAt(0).toUpperCase() + discoveryType.slice(1)}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white/50 hover:text-white/90 hover:bg-white/5"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
        {message && (
          <p className="text-xs text-white/70 mt-1">{message}</p>
        )}
      </CardHeader>

      {expanded && (
        <>
          <CardContent className="py-2 px-3 space-y-2">
            {/* Search filter */}
            {items.length > 5 && (
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder={`Filter ${discoveryType}...`}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-7 h-7 text-xs bg-white/5 border-white/10 text-white/90 placeholder:text-white/40 focus:border-purple-500/50"
                />
              </div>
            )}

            {/* Selection controls */}
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>
                {selectedIds.size} selected
                {minSelect > 1 && ` (min ${minSelect})`}
                {maxSelect && ` (max ${maxSelect})`}
              </span>
              <div className="flex gap-2">
                <button
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  onClick={selectAll}
                  disabled={isSubmitting}
                >
                  Select all
                </button>
                <span className="text-white/20">|</span>
                <button
                  className="text-white/50 hover:text-white/70 transition-colors"
                  onClick={clearSelection}
                  disabled={isSubmitting}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Item list */}
            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id)
                const metadataStrings = formatMetadata(discoveryType, item.metadata)

                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    disabled={isSubmitting}
                    className={`
                      w-full text-left px-2 py-1.5 rounded-lg border transition-all
                      ${isSelected
                        ? 'border-purple-500/50 bg-purple-500/20'
                        : 'border-white/10 hover:border-purple-500/30 hover:bg-white/5'
                      }
                      ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`
                          flex-shrink-0 w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-all
                          ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-white/30'}
                        `}
                      >
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-white/90 truncate">
                            {item.name}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-white/50 truncate">{item.description}</p>
                        )}
                        {metadataStrings.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {metadataStrings.map((str, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs px-1 py-0 bg-purple-500/20 text-purple-300 border-0"
                              >
                                {str}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}

              {filteredItems.length === 0 && (
                <p className="text-center text-xs text-white/40 py-4">
                  No {discoveryType} found matching "{searchFilter}"
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between gap-2 py-2 px-3 border-t border-white/10">
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
                className="h-7 text-xs text-white/50 hover:text-white/70 hover:bg-white/5"
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="bg-purple-500 hover:bg-purple-600 text-white h-7 text-xs ml-auto"
            >
              {isSubmitting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <>
                  Continue ({selectedIds.size})
                </>
              )}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
