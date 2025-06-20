'use client'
import { useAgentStore } from '@/stores/agent-store'
import { useTaskStore } from '@/stores/task-store'
import { Card, CardContent } from '@/components/ui/card'
import { Activity, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

export function LiveMetrics() {
  const { agents } = useAgentStore()
  const { tasks, getTasksByStatus } = useTaskStore()

  const runningAgents = agents.filter(agent => agent.status === 'running').length
  const runningTasks = getTasksByStatus('running').length
  const succeededTasks = getTasksByStatus('succeeded').length
  const failedTasks = getTasksByStatus('failed').length

  const metrics = [
    {
      label: 'Active Agents',
      value: runningAgents,
      total: agents.length,
      icon: Activity,
      color: 'hsl(142 76% 36%)', // green
    },
    {
      label: 'Running Tasks',
      value: runningTasks,
      total: tasks.length,
      icon: Clock,
      color: 'hsl(217 91% 60%)', // blue
    },
    {
      label: 'Completed',
      value: succeededTasks,
      total: tasks.length,
      icon: CheckCircle,
      color: 'hsl(142 76% 36%)', // green
    },
    {
      label: 'Failed',
      value: failedTasks,
      total: tasks.length,
      icon: AlertTriangle,
      color: 'hsl(0 84% 60%)', // red
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.label} className="transition-all duration-200 hover:shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Icon 
                  className="h-4 w-4" 
                  style={{ color: metric.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-semibold">
                      {metric.value}
                    </span>
                    {metric.total > 0 && (
                      <span className="text-xs text-muted-foreground">
                        /{metric.total}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {metric.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
} 