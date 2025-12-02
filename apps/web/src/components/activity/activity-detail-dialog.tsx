'use client'

import React, { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  XCircle,
  RotateCcw,
  Clock,
  Calendar,
  Workflow,
  CheckCircle,
  AlertCircle,
  Ban,
  Loader2,
  Archive,
  User,
  MessageSquare,
  ChevronRight,
  Check,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Activity, ActivityStep, ActivityApprovalRequest, ActivityStatus, ActivityType } from '@/stores/workspace-store'

interface ActivityDetailDialogProps {
  activity: Activity | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
  onApprove?: (activityId: string, approvalId: string, response?: any) => void
  onDeny?: (activityId: string, approvalId: string, reason?: string) => void
}

const statusConfig: Record<ActivityStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-blue-500', label: 'Pending' },
  running: { icon: Loader2, color: 'text-yellow-500', label: 'Running' },
  paused: { icon: Pause, color: 'text-orange-500', label: 'Paused' },
  completed: { icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-red-500', label: 'Failed' },
  cancelled: { icon: Ban, color: 'text-gray-500', label: 'Cancelled' },
}

const typeConfig: Record<ActivityType, { icon: React.ElementType; label: string }> = {
  task: { icon: CheckCircle, label: 'Task' },
  scheduled: { icon: Calendar, label: 'Scheduled' },
  workflow: { icon: Workflow, label: 'Workflow' },
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function StepItem({ step, index }: { step: ActivityStep; index: number }) {
  const getStepIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'skipped':
        return <ChevronRight className="h-4 w-4 text-gray-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 mt-0.5">
        {getStepIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{step.name}</span>
          <Badge variant="secondary" className="text-xs">
            Step {index + 1}
          </Badge>
        </div>
        {step.description && (
          <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
        )}
        {step.errorMessage && (
          <p className="text-xs text-red-500 mt-1">{step.errorMessage}</p>
        )}
      </div>
    </div>
  )
}

function ApprovalRequestItem({
  request,
  onApprove,
  onDeny,
}: {
  request: ActivityApprovalRequest
  onApprove: () => void
  onDeny: () => void
}) {
  if (request.status !== 'pending') {
    return (
      <div className="flex items-start gap-3 py-2 opacity-50">
        <div className="flex-shrink-0 mt-0.5">
          {request.status === 'approved' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : request.status === 'denied' ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Clock className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{request.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{request.status}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-3 px-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
      <div className="flex-shrink-0 mt-0.5">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{request.title}</p>
        {request.description && (
          <p className="text-xs text-muted-foreground mt-1">{request.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" onClick={onApprove}>
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={onDeny}>
            <X className="h-3 w-3 mr-1" />
            Deny
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ActivityDetailDialog({
  activity,
  open,
  onOpenChange,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onArchive,
  onUnarchive,
  onApprove,
  onDeny,
}: ActivityDetailDialogProps) {
  const [fullActivity, setFullActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch full activity details when dialog opens
  useEffect(() => {
    if (open && activity) {
      setLoading(true)
      fetch(`/api/activities/${activity.id}`)
        .then((res) => res.json())
        .then((data) => {
          setFullActivity(data.activity)
        })
        .catch((error) => {
          console.error('Failed to fetch activity details:', error)
          setFullActivity(activity)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [open, activity?.id])

  if (!activity) return null

  const displayActivity = fullActivity || activity
  const status = statusConfig[displayActivity.status]
  const type = typeConfig[displayActivity.activityType]
  const StatusIcon = status.icon
  const TypeIcon = type.icon
  const isArchived = !!displayActivity.archivedAt

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className={cn('flex items-center justify-center w-10 h-10 rounded-full bg-muted')}>
              <StatusIcon className={cn('h-5 w-5', status.color, displayActivity.status === 'running' && 'animate-spin')} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg truncate">{displayActivity.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {type.label}
                </Badge>
                <Badge variant={displayActivity.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                  {status.label}
                </Badge>
                {isArchived && (
                  <Badge variant="outline" className="text-xs">
                    <Archive className="h-3 w-3 mr-1" />
                    Archived
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Description */}
            {displayActivity.description && (
              <div>
                <p className="text-sm">{displayActivity.description}</p>
              </div>
            )}

            {/* Progress (for running activities) */}
            {displayActivity.status === 'running' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {displayActivity.progressMessage || 'In progress...'}
                  </span>
                  <span className="font-medium">{displayActivity.progress}%</span>
                </div>
                <Progress value={displayActivity.progress} />
              </div>
            )}

            {/* Approval Requests */}
            {displayActivity.approvalRequests && displayActivity.approvalRequests.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Approval Requests</h4>
                {displayActivity.approvalRequests.map((request) => (
                  <ApprovalRequestItem
                    key={request.id}
                    request={request}
                    onApprove={() => onApprove?.(displayActivity.id, request.id)}
                    onDeny={() => onDeny?.(displayActivity.id, request.id)}
                  />
                ))}
              </div>
            )}

            {/* Steps */}
            {displayActivity.steps && displayActivity.steps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Steps</h4>
                <div className="space-y-1">
                  {displayActivity.steps
                    .sort((a, b) => a.stepOrder - b.stepOrder)
                    .map((step, index) => (
                      <StepItem key={step.id} step={step} index={index} />
                    ))}
                </div>
              </div>
            )}

            {/* Error message */}
            {displayActivity.errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Error</h4>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{displayActivity.errorMessage}</p>
                {displayActivity.errorCode && (
                  <p className="text-xs text-red-500 mt-1">Code: {displayActivity.errorCode}</p>
                )}
              </div>
            )}

            <Separator />

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {displayActivity.agentId && (
                <div>
                  <span className="text-muted-foreground">Agent</span>
                  <p className="font-medium">{displayActivity.agentId}</p>
                </div>
              )}

              {displayActivity.conversationId && (
                <div>
                  <span className="text-muted-foreground">Conversation</span>
                  <p className="font-medium truncate">{displayActivity.conversationId.slice(0, 8)}...</p>
                </div>
              )}

              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium">{new Date(displayActivity.createdAt).toLocaleString()}</p>
              </div>

              {displayActivity.startedAt && (
                <div>
                  <span className="text-muted-foreground">Started</span>
                  <p className="font-medium">{new Date(displayActivity.startedAt).toLocaleString()}</p>
                </div>
              )}

              {displayActivity.completedAt && (
                <div>
                  <span className="text-muted-foreground">Completed</span>
                  <p className="font-medium">{new Date(displayActivity.completedAt).toLocaleString()}</p>
                </div>
              )}

              {displayActivity.actualDurationMs && (
                <div>
                  <span className="text-muted-foreground">Duration</span>
                  <p className="font-medium">{formatDuration(displayActivity.actualDurationMs)}</p>
                </div>
              )}

              {displayActivity.activityType === 'scheduled' && displayActivity.scheduleCron && (
                <div>
                  <span className="text-muted-foreground">Schedule</span>
                  <p className="font-medium font-mono text-xs">{displayActivity.scheduleCron}</p>
                </div>
              )}

              {displayActivity.scheduleNextRun && (
                <div>
                  <span className="text-muted-foreground">Next Run</span>
                  <p className="font-medium">{new Date(displayActivity.scheduleNextRun).toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Tags */}
            {displayActivity.tags && displayActivity.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {displayActivity.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t flex-shrink-0">
          {displayActivity.status === 'running' && onPause && (
            <Button variant="outline" onClick={() => onPause(displayActivity.id)}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}

          {displayActivity.status === 'paused' && onResume && (
            <Button onClick={() => onResume(displayActivity.id)}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}

          {['pending', 'running', 'paused'].includes(displayActivity.status) && onCancel && (
            <Button variant="destructive" onClick={() => onCancel(displayActivity.id)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}

          {['failed', 'cancelled'].includes(displayActivity.status) && onRetry && (
            <Button onClick={() => onRetry(displayActivity.id)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}

          {['completed', 'failed', 'cancelled'].includes(displayActivity.status) && !isArchived && onArchive && (
            <Button variant="outline" onClick={() => onArchive(displayActivity.id)}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}

          {isArchived && onUnarchive && (
            <Button variant="outline" onClick={() => onUnarchive(displayActivity.id)}>
              <Archive className="h-4 w-4 mr-2" />
              Unarchive
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
