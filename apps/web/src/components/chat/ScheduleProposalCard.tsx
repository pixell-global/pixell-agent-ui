'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  Clock,
  Check,
  X,
  Pencil,
  Loader2,
  Bot,
  Repeat,
  ChevronDown,
  FileText,
  Sparkles,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TIMEZONES } from '@/components/schedule/SchedulePicker'
import type { ScheduleProposal, ScheduleResponse, ScheduleResponseAction } from '@pixell/protocols'

interface ScheduleProposalCardProps {
  proposal: ScheduleProposal
  onRespond: (response: ScheduleResponse) => void
  onEdit?: (proposal: ScheduleProposal) => void
  isSubmitting?: boolean
  className?: string
}

/**
 * Detect user's timezone from browser
 */
function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Find the best matching timezone from our list
 */
function findMatchingTimezone(detected: string): string {
  // First try exact match
  const exact = TIMEZONES.find(tz => tz.value === detected)
  if (exact) return exact.value

  // Fall back to UTC if no match
  return detected
}

export function ScheduleProposalCard({
  proposal,
  onRespond,
  onEdit,
  isSubmitting = false,
  className = '',
}: ScheduleProposalCardProps) {
  // Auto-detect user's timezone on mount
  const detectedTimezone = useMemo(() => {
    const detected = detectUserTimezone()
    return findMatchingTimezone(detected)
  }, [])

  // Use proposal timezone, falling back to detected timezone
  const [selectedTimezone, setSelectedTimezone] = useState(
    proposal.timezone || detectedTimezone
  )

  // Update if proposal changes
  useEffect(() => {
    if (proposal.timezone) {
      setSelectedTimezone(proposal.timezone)
    }
  }, [proposal.timezone])

  const handleAction = (action: ScheduleResponseAction, cancelReason?: string) => {
    const response: ScheduleResponse = {
      type: 'schedule_response',
      proposalId: proposal.proposalId,
      action,
      cancelReason,
      // Include selected timezone in modifications
      modifications: {
        timezone: selectedTimezone,
      },
    }
    onRespond(response)
  }

  const handleConfirm = () => handleAction('confirm')
  const handleCancel = () => handleAction('cancel', 'User declined the schedule')

  const handleEdit = () => {
    if (onEdit) {
      onEdit(proposal)
    }
  }

  // Format schedule type for display
  const getScheduleTypeIcon = () => {
    switch (proposal.scheduleType) {
      case 'cron':
        return <Repeat size={16} className="text-purple-400" />
      case 'interval':
        return <Clock size={16} className="text-purple-400" />
      case 'one_time':
        return <Calendar size={16} className="text-purple-400" />
      default:
        return <Clock size={16} className="text-purple-400" />
    }
  }

  const getScheduleTypeBadge = () => {
    switch (proposal.scheduleType) {
      case 'cron':
        return 'Recurring'
      case 'interval':
        return 'Interval'
      case 'one_time':
        return 'One-time'
      default:
        return proposal.scheduleType
    }
  }

  // Get timezone label for display
  const getTimezoneLabel = (value: string) => {
    const tz = TIMEZONES.find(t => t.value === value)
    return tz?.label || value
  }

  // Check if we have execution plan details
  const hasExecutionPlan = proposal.executionPlan || proposal.taskExplanation
  const hasExpectedOutputs = proposal.expectedOutputs && proposal.expectedOutputs.length > 0

  return (
    <Card
      className={`
        border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-600/5
        shadow-lg shadow-purple-500/5
        ${className}
      `}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Calendar size={20} className="text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white/90">
                Schedule Proposal
              </CardTitle>
              <p className="text-sm text-white/60 mt-0.5">{proposal.name}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-purple-500/50 text-purple-300 text-xs"
          >
            {getScheduleTypeBadge()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Agent info - enhanced with name and description */}
        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Bot size={16} className="text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">
                {proposal.agentName || proposal.agentId}
              </span>
            </div>
            {proposal.agentDescription && (
              <p className="text-xs text-white/50 mt-1 line-clamp-2">
                {proposal.agentDescription}
              </p>
            )}
          </div>
        </div>

        {/* Schedule display with inline timezone selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-purple-500/10 p-3 rounded-lg">
            {getScheduleTypeIcon()}
            <span className="text-sm font-medium text-white/90">
              {proposal.scheduleDisplay}
            </span>
          </div>

          {/* Inline timezone selector */}
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-white/40" />
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger className="flex-1 h-8 text-xs bg-white/5 border-white/10 hover:border-white/20">
                <SelectValue placeholder="Select timezone">
                  {getTimezoneLabel(selectedTimezone)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value} className="text-xs">
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* What will happen - from taskExplanation or executionPlan */}
        {hasExecutionPlan && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" />
              <span className="text-xs text-white/50 uppercase tracking-wide">
                What will happen
              </span>
            </div>
            <div className="text-sm text-white/80 bg-white/5 p-3 rounded-lg">
              {proposal.taskExplanation ? (
                <p>{proposal.taskExplanation}</p>
              ) : proposal.executionPlan ? (
                <div className="space-y-2">
                  {proposal.executionPlan.parameters?.subreddits && (
                    <p>
                      <span className="text-white/50">Subreddits: </span>
                      {proposal.executionPlan.parameters.subreddits.map((s: string) => `r/${s}`).join(', ')}
                    </p>
                  )}
                  {proposal.executionPlan.parameters?.keywords && (
                    <p>
                      <span className="text-white/50">Keywords: </span>
                      {proposal.executionPlan.parameters.keywords.join(', ')}
                    </p>
                  )}
                  {proposal.executionPlan.parameters?.timeRange && (
                    <p>
                      <span className="text-white/50">Time range: </span>
                      Past {proposal.executionPlan.parameters.timeRange}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* What you will receive - from expectedOutputs */}
        {hasExpectedOutputs && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-green-400" />
              <span className="text-xs text-white/50 uppercase tracking-wide">
                What you will receive
              </span>
            </div>
            <div className="space-y-1">
              {proposal.expectedOutputs!.map((output, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm text-white/70 bg-white/5 px-3 py-2 rounded"
                >
                  <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                    {output.type}
                  </Badge>
                  <span>{output.name}</span>
                  {output.description && (
                    <span className="text-white/40 text-xs ml-auto">
                      {output.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task prompt (collapsed by default if we have execution plan) */}
        {!hasExecutionPlan && (
          <div className="space-y-1">
            <span className="text-xs text-white/50 uppercase tracking-wide">
              Task
            </span>
            <p className="text-sm text-white/80 bg-white/5 p-3 rounded-lg line-clamp-3">
              {proposal.prompt}
            </p>
          </div>
        )}

        {/* Rationale (if provided) */}
        {proposal.rationale && (
          <div className="text-sm text-white/60 italic border-l-2 border-purple-500/30 pl-3">
            {proposal.rationale}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <X size={16} className="mr-1" />
          Decline
        </Button>

        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            disabled={isSubmitting}
            className="border-white/20 hover:border-white/40"
          >
            <Pencil size={16} className="mr-1" />
            Edit
          </Button>
        )}

        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="mr-1 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check size={16} className="mr-1" />
              Confirm
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
