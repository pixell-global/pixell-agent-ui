import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Activity, CheckCircle, Clock, Zap, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWebSocket } from '@/lib/websocket-manager'
import { cn } from '@/lib/utils'

export function ActivityPane() {
  const { 
    liveMetrics, 
    tasks, 
    isConnected,
    agents 
  } = useWorkspaceStore()
  
  const { connect } = useWebSocket()

  // Connect to WebSocket on mount
  useEffect(() => {
    connect()
  }, [connect])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-yellow-500'
      case 'succeeded': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'queued': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      <div className="flex items-center gap-2 p-3 border-b">
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-600">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Disconnected</span>
          </>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Live Metrics */}
          {liveMetrics && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="text-lg font-semibold">{liveMetrics.activeAgents}</div>
                      <div className="text-xs text-muted-foreground">Active Agents</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-lg font-semibold">{liveMetrics.tasksCompleted}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div className="text-lg font-semibold">{liveMetrics.tasksRunning}</div>
                      <div className="text-xs text-muted-foreground">Running</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <div>
                      <div className="text-lg font-semibold">{liveMetrics.tasksQueued}</div>
                      <div className="text-xs text-muted-foreground">Queued</div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">System Health</span>
                    <span className={cn("text-xs font-medium", getHealthColor(liveMetrics.systemHealth))}>
                      {liveMetrics.systemHealth.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Uptime</span>
                    <span className="text-xs">{liveMetrics.uptime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Tasks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Tasks</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {tasks.length > 0 ? (
                  tasks.slice(0, 10).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className={cn("w-2 h-2 rounded-full", getStatusColor(task.status))} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{task.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {task.agentName} • {task.status}
                        </div>
                        {task.status === 'running' && task.progress > 0 && (
                          <div className="mt-1">
                            <div className="w-full bg-muted rounded-full h-1">
                              <div 
                                className="bg-primary h-1 rounded-full transition-all duration-300" 
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No recent tasks
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agents Status */}
          {agents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Agents</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        agent.status === 'running' ? 'bg-green-500' :
                        agent.status === 'idle' ? 'bg-blue-500' :
                        agent.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.type}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {agent.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  )
} 