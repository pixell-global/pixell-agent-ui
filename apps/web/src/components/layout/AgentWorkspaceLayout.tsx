'use client'
import { useUIStore } from '@/stores/ui-store'
import { NavigatorPane } from '@/components/navigator/navigator-pane'
import { WorkspaceTabs } from '@/components/workspace/WorkspaceTabs'
import { WorkspaceContainer } from '@/components/workspace/WorkspaceContainer'
import { ActivityPane, ActivityPaneRef } from '@/components/activity/activity-pane'
import { useWebSocket } from '@/lib/websocket-manager'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { designTokens } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@/components/ui/button'
import { PanelLeft, PanelRight, Activity } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function AgentWorkspaceLayout() {
  const { 
    leftPanelVisible, 
    rightPanelVisible, 
    toggleLeftPanel, 
    toggleRightPanel
  } = useUIStore()
  
  const { connect } = useWebSocket()
  const { isConnected } = useWorkspaceStore()
  
  // ActivityPane의 ref 생성
  const activityPaneRef = useRef<ActivityPaneRef>(null as any)
  
  // Connect to WebSocket on mount
  useEffect(() => {
    connect()
  }, [connect])

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <img 
            src="/@Logo_Pixell_Linkedin.png?v=1" 
            alt="Pixell Agent Framework" 
            className="h-10 w-auto"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLeftPanel}
            className={cn("h-8 w-8 p-0", leftPanelVisible && "bg-accent")}
            title="Toggle Navigator Panel"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleRightPanel}
            className={cn("h-8 w-8 p-0", rightPanelVisible && "bg-accent")}
            title="Toggle Activity Panel"
          >
            <Activity className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-2" />
          <span className="text-sm text-muted-foreground">v0.1.0</span>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <WorkspaceTabs />
        <PanelGroup direction="horizontal">
          {/* Left Panel - Navigator */}
          {leftPanelVisible && (
            <>
              <Panel 
                defaultSize={18} 
                minSize={15} 
                maxSize={30}
                className="bg-muted/10 border-r"
              >
                <NavigatorPane />
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
            </>
          )}
          
          {/* Center Panel - Active Workspace (Chat or Editor) */}
          <Panel 
            defaultSize={leftPanelVisible && rightPanelVisible ? 40 : leftPanelVisible || rightPanelVisible ? 60 : 100}
            minSize={30}
            className="min-w-0"
          >
            <WorkspaceContainer activityPaneRef={activityPaneRef} />
          </Panel>
          
          {/* Right Panel - Activity Pane */}
          {rightPanelVisible && (
            <>
              <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
              <Panel 
                defaultSize={40} 
                minSize={30} 
                maxSize={55}
                className="bg-muted/10 border-l"
              >
                <div className="h-full overflow-y-auto">
                  <ActivityPane ref={activityPaneRef} />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
} 