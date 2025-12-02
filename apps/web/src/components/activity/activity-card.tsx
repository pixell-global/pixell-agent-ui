'use client'

import React from 'react'
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
  MoreHorizontal,
  Archive,
  Eye,
  Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Activity, ActivityStatus, ActivityType } from '@/stores/workspace-store'

interface ActivityCardProps {
  activity: Activity
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
  onClick?: (activity: Activity) => void
  className?: string
}

const statusConfig: Record<ActivityStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-blue-500 bg-blue-50', label: 'Pending' },
  running: { icon: Loader2, color: 'text-yellow-500 bg-yellow-50', label: 'Running' },
  paused: { icon: Pause, color: 'text-orange-500 bg-orange-50', label: 'Paused' },
  completed: { icon: CheckCircle, color: 'text-green-500 bg-green-50', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-red-500 bg-red-50', label: 'Failed' },
  cancelled: { icon: Ban, color: 'text-gray-500 bg-gray-50', label: 'Cancelled' },
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

function formatRelativeTime(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return 'Just now'
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
  return `${Math.floor(diffSecs / 86400)}d ago`
}

export function ActivityCard({
  activity,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onArchive,
  onUnarchive,
  onClick,
  className,
}: ActivityCardProps) {
  const status = statusConfig[activity.status]
  const type = typeConfig[activity.activityType]
  const StatusIcon = status.icon
  const TypeIcon = type.icon

  const hasPendingApprovals = activity.approvalRequests?.some(r => r.status === 'pending')
  const isArchived = !!activity.archivedAt

  const handleClick = () => {
    onClick?.(activity)
  }

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 p-4 rounded-lg border bg-card transition-colors hover:bg-accent/50 cursor-pointer',
        isArchived && 'opacity-60',
        className
      )}
      onClick={handleClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status icon */}
          <div className={cn('flex items-center justify-center w-8 h-8 rounded-full', status.color.split(' ')[1])}>
            <StatusIcon className={cn('h-4 w-4', status.color.split(' ')[0], activity.status === 'running' && 'animate-spin')} />
          </div>

          {/* Title and type */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">{activity.name}</h3>
              {hasPendingApprovals && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  <Bell className="h-3 w-3 mr-0.5" />
                  Approval
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TypeIcon className="h-3 w-3" />
              <span>{type.label}</span>
              {activity.agentId && (
                <>
                  <span>•</span>
                  <span className="truncate">{activity.agentId}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => handleAction(e as any, () => onClick?.(activity))}>
              <Eye className="h-4 w-4 mr-2" />
              View details
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {activity.status === 'running' && onPause && (
              <DropdownMenuItem onClick={(e) => handleAction(e as any, () => onPause(activity.id))}>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </DropdownMenuItem>
            )}

            {activity.status === 'paused' && onResume && (
              <DropdownMenuItem onClick={(e) => handleAction(e as any, () => onResume(activity.id))}>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </DropdownMenuItem>
            )}

            {['pending', 'running', 'paused'].includes(activity.status) && onCancel && (
              <DropdownMenuItem
                onClick={(e) => handleAction(e as any, () => onCancel(activity.id))}
                className="text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </DropdownMenuItem>
            )}

            {['failed', 'cancelled'].includes(activity.status) && onRetry && (
              <DropdownMenuItem onClick={(e) => handleAction(e as any, () => onRetry(activity.id))}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </DropdownMenuItem>
            )}

            {['completed', 'failed', 'cancelled'].includes(activity.status) && !isArchived && onArchive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => handleAction(e as any, () => onArchive(activity.id))}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </>
            )}

            {isArchived && onUnarchive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => handleAction(e as any, () => onUnarchive(activity.id))}>
                  <Archive className="h-4 w-4 mr-2" />
                  Unarchive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description (if any) */}
      {activity.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {activity.description}
        </p>
      )}

      {/* Progress bar (for running activities) */}
      {activity.status === 'running' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {activity.progressMessage || 'In progress...'}
            </span>
            <span className="font-medium">{activity.progress}%</span>
          </div>
          <Progress value={activity.progress} className="h-1.5" />
        </div>
      )}

      {/* Scheduled info */}
      {activity.activityType === 'scheduled' && activity.scheduleNextRun && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Next run: {new Date(activity.scheduleNextRun).toLocaleString()}</span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatRelativeTime(activity.createdAt)}</span>

        {activity.actualDurationMs && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(activity.actualDurationMs)}
          </span>
        )}

        {activity.status === 'failed' && activity.errorMessage && (
          <span className="text-red-500 truncate max-w-[200px]" title={activity.errorMessage}>
            {activity.errorMessage}
          </span>
        )}
      </div>

      {/* Tags */}
      {activity.tags && activity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activity.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {activity.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{activity.tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
