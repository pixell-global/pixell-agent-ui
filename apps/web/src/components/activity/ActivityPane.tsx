'use client'
import { useTaskStore } from '@/stores/task-store'
import { TaskDAG } from './TaskDAG'
import { TaskCard } from './TaskCard'
import { LiveMetrics } from './LiveMetrics'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ActivityPane() {
  const { tasks, getTasksByStatus } = useTaskStore()
  const runningTasks = getTasksByStatus('running')
  const queuedTasks = getTasksByStatus('queued')
  
  return (
    <div className="p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4">Activity</h2>
      
      <ScrollArea className="flex-1">
        <div className="space-y-6">
          {/* Live Metrics */}
          <div>
            <h3 className="font-medium mb-3">Live Metrics</h3>
            <LiveMetrics />
          </div>
          
          {/* Running Tasks */}
          {runningTasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Running Tasks</h3>
              <div className="space-y-2">
                {runningTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
          
          {/* Queued Tasks */}
          {queuedTasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Queued Tasks</h3>
              <div className="space-y-2">
                {queuedTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
          
          {/* Task DAG */}
          {tasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Task Execution Graph</h3>
              <TaskDAG />
            </div>
          )}
          
          {/* Empty State */}
          {tasks.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>No active tasks</p>
              <p className="text-sm mt-2">
                Task activity will appear here when agents start working
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
} 