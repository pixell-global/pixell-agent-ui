'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  MoreHorizontal, 
  Play, 
  Pause, 
  Square, 
  Eye, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface JobData {
  id: string
  name: string
  description?: string
  status: 'running' | 'queued' | 'completed' | 'failed' | 'paused'
  progress: number
  startTime: string
  endTime?: string
  duration?: string
  agentId: string
  agentName: string
  priority: 'low' | 'medium' | 'high'
  tags?: string[]
  error?: string
}

interface JobsTableProps {
  jobs: JobData[]
  onJobAction?: (action: 'view' | 'pause' | 'resume' | 'stop', jobId: string) => void
  maxHeight?: string
  showActions?: boolean
  className?: string
}

const statusConfig = {
  running: {
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    icon: Play,
    label: 'Running'
  },
  queued: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    icon: Clock,
    label: 'Queued'
  },
  completed: {
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: CheckCircle,
    label: 'Completed'
  },
  failed: {
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: XCircle,
    label: 'Failed'
  },
  paused: {
    color: 'bg-gray-500',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-50',
    icon: Pause,
    label: 'Paused'
  }
}

const priorityConfig = {
  low: { color: 'bg-gray-100 text-gray-600', label: 'Low' },
  medium: { color: 'bg-blue-100 text-blue-600', label: 'Medium' },
  high: { color: 'bg-red-100 text-red-600', label: 'High' }
}

const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const diffMs = end.getTime() - start.getTime()
  
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

const formatTime = (timeString: string): string => {
  const date = new Date(timeString)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

export const JobsTable: React.FC<JobsTableProps> = ({ 
  jobs, 
  onJobAction,
  maxHeight = "400px",
  showActions = true,
  className 
}) => {
  const handleAction = (action: 'view' | 'pause' | 'resume' | 'stop', jobId: string) => {
    onJobAction?.(action, jobId)
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Jobs</CardTitle>
          <Badge variant="outline" className="text-sm">
            {jobs.length} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }} className="w-full">
          <div className="px-6 pb-6">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No jobs found</p>
                <p className="text-sm">Jobs will appear here when they are created</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const statusInfo = statusConfig[job.status]
                  const StatusIcon = statusInfo.icon
                  const priorityInfo = priorityConfig[job.priority]
                  const duration = formatDuration(job.startTime, job.endTime)

                  return (
                    <div
                      key={job.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      {/* Status indicator and icon */}
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", statusInfo.color)} />
                        <StatusIcon className={cn("h-4 w-4", statusInfo.textColor)} />
                      </div>

                      {/* Job info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{job.name}</h4>
                            {job.description && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {job.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", priorityInfo.color)}
                            >
                              {priorityInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {statusInfo.label}
                            </Badge>
                          </div>
                        </div>

                        {/* Progress bar for running jobs */}
                        {job.status === 'running' && job.progress > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span>{job.progress}%</span>
                            </div>
                            <Progress value={job.progress} className="h-2" />
                          </div>
                        )}

                        {/* Job metadata */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{job.agentName}</span>
                          <span>•</span>
                          <span>Started {formatTime(job.startTime)}</span>
                          <span>•</span>
                          <span>Duration {duration}</span>
                          {job.error && (
                            <>
                              <span>•</span>
                              <span className="text-red-600 truncate max-w-32" title={job.error}>
                                Error: {job.error}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Tags */}
                        {job.tags && job.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {job.tags.slice(0, 3).map((tag) => (
                              <Badge 
                                key={tag} 
                                variant="secondary" 
                                className="text-xs px-2 py-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {job.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs px-2 py-0">
                                +{job.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {showActions && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAction('view', job.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {job.status === 'running' && (
                              <DropdownMenuItem onClick={() => handleAction('pause', job.id)}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            )}
                            {job.status === 'paused' && (
                              <DropdownMenuItem onClick={() => handleAction('resume', job.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </DropdownMenuItem>
                            )}
                            {(job.status === 'running' || job.status === 'paused') && (
                              <DropdownMenuItem 
                                onClick={() => handleAction('stop', job.id)}
                                className="text-red-600"
                              >
                                <Square className="h-4 w-4 mr-2" />
                                Stop
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}