import React, { useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react'
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
import { renderUISpec } from '../../../components/agent-ui/renderer'

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
  const [uiSpec, setUiSpec] = useState<any | null>(null)
  const rendererContainerRef = useRef<HTMLDivElement>(null)
  const rendererUnmountRef = useRef<null | (() => void)>(null)
  
  // Use realtime KPI data
  const kpiData = useRealtimeKPI(user?.id || 'demo-user')
  const kpiMetrics = useWorkspaceStore(selectKPIMetrics)
  const recentJobs = useWorkspaceStore(selectRecentJobs)

  // Mount/unmount Dynamic UI renderer when uiSpec changes
  useEffect(() => {
    if (!rendererContainerRef.current) return
    if (rendererUnmountRef.current) {
      rendererUnmountRef.current()
      rendererUnmountRef.current = null
    }
    if (uiSpec) {
      console.debug('[ActivityPane] Mounting UI spec', uiSpec)
      const { unmount } = renderUISpec(rendererContainerRef.current, uiSpec, {
        capabilitySet: { components: Array.isArray(uiSpec?.manifest?.capabilities) ? uiSpec.manifest.capabilities : undefined },
        debug: true,
      })
      rendererUnmountRef.current = unmount
    }
    return () => {
      if (rendererUnmountRef.current) {
        rendererUnmountRef.current()
        rendererUnmountRef.current = null
      }
    }
  }, [uiSpec])
  
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
    if (!data && !uiQuery.trim()) return
    
    setIsGenerating(true)
    try {
      let result = data
      
      if (!result) {
        const apiResult = await coreAgentService.getActivity()
        console.log('🔍 API에서 받은 데이터:', apiResult)
        
        if (Array.isArray(apiResult) && apiResult.length > 0) {
          result = apiResult[apiResult.length - 1]
        }
      }
      
      console.log('🔍 ActivityPane에서 처리할 result:', result)
      
      setGeneratedUI(null)
      setUiSpec(null)

      const contents = result?.contents || result
      const dataObj = contents?.data || {}

      const candidateUI = dataObj?.ui || contents?.ui || null
      if (candidateUI) {
        console.log('🟦 Raw UI payload from agent app:', JSON.stringify(candidateUI, null, 2))
      } else {
        console.log('🟨 No candidateUI field found. contents keys:', Object.keys(contents || {}), 'data keys:', Object.keys(dataObj || {}))
      }
      const envelope: any = candidateUI ? {
        manifest: candidateUI.manifest || contents?.manifest || result?.manifest || { id: 'app.v1', name: 'App', version: '1.0.0', capabilities: [] },
        data: candidateUI.data || dataObj || {},
        actions: candidateUI.actions || contents?.actions || {},
        view: candidateUI.view || contents?.view || result?.view,
        theme: candidateUI.theme || contents?.theme || result?.theme || undefined,
      } : null

      if (envelope && envelope.view) {
        console.log('🟩 Normalized UI envelope passed to renderer:', JSON.stringify({
          manifest: envelope.manifest,
          view: envelope.view,
          data: Array.isArray(envelope.data) ? `array(length=${envelope.data.length})` : typeof envelope.data,
          actions: Object.keys(envelope.actions || {}),
          theme: envelope.theme ? 'present' : 'none'
        }, null, 2))
        console.log('✅ Dynamic UI spec detected. Rendering via renderer.')
        setUiSpec(envelope)
      } else if (typeof dataObj?.html === 'string' || typeof contents?.html === 'string') {
        console.log('✅ Raw HTML detected. Rendering in iframe.')
        setGeneratedUI({
          title: dataObj?.title || contents?.title || 'Generated UI',
          html: (dataObj?.html as string) || (contents?.html as string) || ''
        })
      } else {
        console.log('❌ UI 데이터 파싱 실패 - 예상 구조와 다름')
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

      <div className="flex-1 p-4">
        {/* UI Generation */}
        <Card className="h-full">
          <CardContent className="pt-0 h-full overflow-auto">
            <div className="h-full">                
              {/* 생성된 UI 표시 */}
              {uiSpec ? (
                <div className="h-full flex flex-col">
                  <div className="bg-white border rounded p-3 flex-1 overflow-auto">
                    <div ref={rendererContainerRef} className="w-full h-full" />
                  </div>
                </div>
              ) : generatedUI ? (
                <div className="h-full flex flex-col">
                  <div className="bg-white border rounded p-3 flex-1 overflow-hidden">
                    <iframe 
                      srcDoc={generatedUI.html}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin"
                      title={generatedUI.title}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
})

ActivityPane.displayName = 'ActivityPane' 