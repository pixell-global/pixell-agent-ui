'use client'
import { useTaskStore } from '@/stores/task-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStatusColor } from '@/lib/design-tokens'
import { useMemo } from 'react'

export function TaskDAG() {
  const { getTaskDAG } = useTaskStore()
  const { nodes, edges } = useMemo(() => getTaskDAG(), [getTaskDAG])
  
  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          <p>No tasks to visualize</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {nodes.map((task) => {
            const statusColor = getStatusColor(task.status)
            const hasParent = edges.some(edge => edge.to === task.id)
            const hasChildren = edges.some(edge => edge.from === task.id)
            
            return (
              <div key={task.id} className="relative">
                {/* Connection lines (simplified) */}
                {hasParent && (
                  <div className="absolute -top-3 left-1/2 w-px h-3 bg-border transform -translate-x-1/2" />
                )}
                
                {/* Task node */}
                <div className="bg-background border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {task.name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{
                        color: statusColor,
                        borderColor: statusColor
                      }}
                    >
                      {task.status}
                    </Badge>
                  </div>
                  
                  {task.status === 'running' && (
                    <div className="w-full bg-muted rounded-full h-1">
                      <div 
                        className="bg-primary h-1 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Started: {new Date(task.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                
                {/* Connection to children */}
                {hasChildren && (
                  <div className="absolute -bottom-3 left-1/2 w-px h-3 bg-border transform -translate-x-1/2" />
                )}
              </div>
            )
          })}
        </div>
        
        {edges.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            {edges.length} dependencies
          </div>
        )}
      </CardContent>
    </Card>
  )
} 