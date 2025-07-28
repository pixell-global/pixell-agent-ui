import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Activity, CheckCircle, Clock, Zap, AlertCircle, Wifi, WifiOff, Wand2 } from 'lucide-react'
import { useWorkspaceStore, selectKPIMetrics, selectRecentJobs } from '@/stores/workspace-store'
import { useWebSocket } from '@/lib/websocket-manager'
import { useRealtimeKPI } from '@/hooks/use-realtime-kpi'
import { useSupabase } from '@/hooks/use-supabase'
import { KPIWidget, ActiveJobsKPI, SuccessRateKPI, AverageRuntimeKPI, QueuedJobsKPI } from '@/components/kpi/KPIWidget'
import { A2ATableDemo } from '@/components/a2a_task/a2a_task'
import { JobsTable } from '@/components/kpi/JobsTable'
import { cn } from '@/lib/utils'
import { coreAgentService } from '@/services/coreAgentService'

export interface ActivityPaneRef {
  triggerUIGeneration: (data: any) => void
}

export const ActivityPane = forwardRef<ActivityPaneRef>((props, ref) => {
  const { 
    liveMetrics, 
    tasks, 
    isConnected,
    agents,
    setKPIMetrics,
    setRecentJobs
  } = useWorkspaceStore()
  
  const { user } = useSupabase()
  const { connect } = useWebSocket()
  
  // UI 생성 관련 상태
  const [uiQuery, setUiQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedUI, setGeneratedUI] = useState<{
    title: string
    html: string
  } | null>(null)
  
  // Use realtime KPI data
  const kpiData = useRealtimeKPI(user?.id || 'demo-user')
  const kpiMetrics = useWorkspaceStore(selectKPIMetrics)
  const recentJobs = useWorkspaceStore(selectRecentJobs)

  // Connect to WebSocket on mount
  useEffect(() => {
    connect()
  }, [connect])
  
  // ref를 통해 외부에서 호출할 수 있는 함수들 노출
  useImperativeHandle(ref, () => ({
    triggerUIGeneration: handleGenerateUI
  }))
  
  // UI 생성 함수
  const handleGenerateUI = async (data?: any) => {
    // 버튼 클릭 시에는 uiQuery 체크, 직접 호출 시에는 스킵
    if (!data && !uiQuery.trim()) return
    
    setIsGenerating(true)
    try {
      // ChatWorkspace에서 직접 받은 데이터를 사용하거나, 없으면 API 호출
      let result = data
      
      if (!result) {
        const apiResult = await coreAgentService.getActivity()
        console.log('🔍 API에서 받은 데이터:', apiResult)
        
        if (Array.isArray(apiResult) && apiResult.length > 0) {
          result = apiResult[apiResult.length - 1]
        }
      }
      
      console.log('🔍 ActivityPane에서 처리할 result:', result)
      
      if (result && result.contents && result.contents.data) {
        console.log('✅ UI 데이터 파싱 성공')
        setGeneratedUI({
          title: result.contents.data.title || 'Generated UI',
          html: result.contents.data.html || ''
        })
      } else {
        console.log('❌ UI 데이터 파싱 실패 - 예상 구조와 다름')
        console.log('기대하는 구조: result.contents.data.{html, title}')
        console.log('실제 구조:', result)
      }
    } catch (error) {
      console.error('UI 생성 실패:', error)
    } finally {
      setIsGenerating(false)
    }
  }
  
  // Update workspace store with KPI data
  useEffect(() => {
    if (kpiData.metrics) {
      setKPIMetrics(kpiData.metrics)
    }
    if (kpiData.recentJobs) {
      setRecentJobs(kpiData.recentJobs)
    }
  }, [kpiData.metrics, kpiData.recentJobs, setKPIMetrics, setRecentJobs])

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
          {/* UI Generation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                UI 생성
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="생성하고 싶은 UI를 설명해주세요..."
                    value={uiQuery}
                    onChange={(e) => setUiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isGenerating) {
                        handleGenerateUI()
                      }
                    }}
                    disabled={isGenerating}
                  />
                  <Button 
                    onClick={() => handleGenerateUI()}
                    disabled={!uiQuery.trim() || isGenerating}
                    size="sm"
                  >
                    {isGenerating ? '생성 중...' : '생성'}
                  </Button>
                </div>
                
                {/* 생성된 UI 표시 */}
                {generatedUI && (
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <div className="text-sm font-medium mb-2">{generatedUI.title}</div>
                    <div 
                      className="bg-white border rounded p-3 max-h-96 overflow-auto"
                      dangerouslySetInnerHTML={{ __html: generatedUI.html }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPI Widgets Grid */}
          {kpiMetrics && (
            <div className="grid gap-3">
            </div>
          )}

          {/* Jobs Table */}
          {recentJobs.length > 0 && (
            <JobsTable 
              jobs={recentJobs}
              maxHeight="300px"
              onJobAction={(action, jobId) => {
                console.log(`Job action: ${action} on ${jobId}`)
                // Handle job actions here
              }}
            />
          )}

          {/* Legacy Live Metrics (fallback) */}
          {liveMetrics && !kpiMetrics && (
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
})

ActivityPane.displayName = 'ActivityPane' 