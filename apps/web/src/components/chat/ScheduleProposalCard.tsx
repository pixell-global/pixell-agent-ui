'use client'

import React, { useState } from 'react'
import {
  Calendar,
  Clock,
  Check,
  X,
  Pencil,
  Loader2,
  Bot,
  Repeat,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ScheduleProposal, ScheduleResponse, ScheduleResponseAction } from '@pixell/protocols'

interface ScheduleProposalCardProps {
  proposal: ScheduleProposal
  onRespond: (response: ScheduleResponse) => void
  onEdit?: (proposal: ScheduleProposal) => void
  isSubmitting?: boolean
  className?: string
}

export function ScheduleProposalCard({
  proposal,
  onRespond,
  onEdit,
  isSubmitting = false,
  className = '',
}: ScheduleProposalCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  const handleAction = (action: ScheduleResponseAction, cancelReason?: string) => {
    const response: ScheduleResponse = {
      type: 'schedule_response',
      proposalId: proposal.proposalId,
      action,
      cancelReason,
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
        {/* Agent info */}
        <div className="flex items-center gap-2 text-sm">
          <Bot size={14} className="text-white/40" />
          <span className="text-white/60">Agent:</span>
          <Badge variant="secondary" className="text-xs">
            {proposal.agentId}
          </Badge>
        </div>

        {/* Schedule display */}
        <div className="flex items-center gap-2 bg-purple-500/10 p-3 rounded-lg">
          {getScheduleTypeIcon()}
          <span className="text-sm font-medium text-white/90">
            {proposal.scheduleDisplay}
          </span>
          {proposal.timezone && proposal.timezone !== 'UTC' && (
            <span className="text-xs text-white/50 ml-auto">
              ({proposal.timezone})
            </span>
          )}
        </div>

        {/* Prompt preview */}
        <div className="space-y-1">
          <span className="text-xs text-white/50 uppercase tracking-wide">
            Task
          </span>
          <p className="text-sm text-white/80 bg-white/5 p-3 rounded-lg line-clamp-3">
            {proposal.prompt}
          </p>
        </div>

        {/* Rationale (if provided) */}
        {proposal.rationale && (
          <div className="space-y-1">
            <span className="text-xs text-white/50 uppercase tracking-wide">
              Why this schedule?
            </span>
            <p className="text-sm text-white/70 italic">
              "{proposal.rationale}"
            </p>
          </div>
        )}

        {/* Toggle details */}
        {(proposal.nextRunsPreview || proposal.description) && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        )}

        {/* Expanded details */}
        {showDetails && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Description */}
            {proposal.description && (
              <div className="space-y-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Description
                </span>
                <p className="text-sm text-white/70">{proposal.description}</p>
              </div>
            )}

            {/* Next runs preview */}
            {proposal.nextRunsPreview && proposal.nextRunsPreview.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Next runs
                </span>
                <div className="space-y-1">
                  {proposal.nextRunsPreview.slice(0, 3).map((run, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-white/70"
                    >
                      <Clock size={12} className="text-white/40" />
                      {new Date(run).toLocaleString()}
                    </div>
                  ))}
                  {proposal.nextRunsPreview.length > 3 && (
                    <p className="text-xs text-white/50">
                      ...and {proposal.nextRunsPreview.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Cron expression (for advanced users) */}
            {proposal.cron && (
              <div className="space-y-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Cron expression
                </span>
                <code className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded font-mono">
                  {proposal.cron}
                </code>
              </div>
            )}

            {/* Interval details */}
            {proposal.interval && (
              <div className="space-y-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Interval
                </span>
                <p className="text-sm text-white/70">
                  Every {proposal.interval.value} {proposal.interval.unit}
                </p>
              </div>
            )}

            {/* Bounds */}
            {(proposal.startAt || proposal.endAt) && (
              <div className="space-y-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">
                  Date bounds
                </span>
                <div className="text-sm text-white/70 space-y-0.5">
                  {proposal.startAt && (
                    <p>
                      Starts: {new Date(proposal.startAt).toLocaleDateString()}
                    </p>
                  )}
                  {proposal.endAt && (
                    <p>
                      Ends: {new Date(proposal.endAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warning about tier limits - optional messaging */}
        {proposal.message && (
          <div className="flex items-start gap-2 text-xs text-white/50 bg-white/5 p-2 rounded">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{proposal.message}</span>
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
