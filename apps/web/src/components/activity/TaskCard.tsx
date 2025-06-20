'use client'
import { Task } from '@/stores/task-store'
import { getStatusColor } from '@/lib/design-tokens'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, Play, CheckCircle, XCircle, Pause } from 'lucide-react'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const statusColor = getStatusColor(task.status)

  const getStatusIcon = () => {
    switch (task.status) {
      case 'running':
        return <Play className="h-3 w-3" />
      case 'succeeded':
        return <CheckCircle className="h-3 w-3" />
      case 'failed':
        return <XCircle className="h-3 w-3" />
      case 'paused':
        return <Pause className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-sm">
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm truncate">{task.name}</h4>
            <Badge 
              variant="outline" 
              className="text-xs flex items-center gap-1"
              style={{
                color: statusColor,
                borderColor: statusColor
              }}
            >
              {getStatusIcon()}
              {task.status}
            </Badge>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          
          {task.status === 'running' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Progress</span>
                <span>{task.progress}%</span>
              </div>
              <Progress value={task.progress} className="h-1" />
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {new Date(task.createdAt).toLocaleTimeString()}
            </span>
            {task.agentId && (
              <span className="truncate ml-2">
                Agent: {task.agentId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 