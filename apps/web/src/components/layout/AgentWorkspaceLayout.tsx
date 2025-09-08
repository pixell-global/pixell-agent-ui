'use client'
import { useUIStore } from '@/stores/ui-store'
import { NavigatorPane } from '@/components/navigator/navigator-pane'
import { CollapsedNavigator } from '@/components/navigator/collapsed-navigator'
import { WorkspaceTabs } from '@/components/workspace/WorkspaceTabs'
import { WorkspaceContainer } from '@/components/workspace/WorkspaceContainer'
import { ActivityPane, ActivityPaneRef } from '@/components/activity/activity-pane'
import { useWebSocket } from '@/lib/websocket-manager'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { designTokens } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@/components/ui/button'
import { } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { UserMenu } from '@/components/auth/UserMenu'

export function AgentWorkspaceLayout() {
  const { 
    leftPanelVisible, 
    leftPanelCollapsed,
    rightPanelVisible, 
    toggleLeftPanel, 
    toggleRightPanel
  } = useUIStore()
  
  const { connect } = useWebSocket()
  const { isConnected } = useWorkspaceStore()
  
  // ActivityPane의 ref 생성
  const activityPaneRef = useRef<ActivityPaneRef>(null as any)
  const [mounted, setMounted] = useState(false)
  
  // Connect to WebSocket on mount
  useEffect(() => {
    connect()
  }, [connect])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <img 
            src="/@Logo_Pixell_Linkedin.png?v=1" 
            alt="Pixell Agent Framework" 
            className="h-10 w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <WorkspaceTabs />
        {mounted && (
        <PanelGroup id="workspace-panels" direction="horizontal">
          {/* Left Panel - Navigator */}
          {(leftPanelVisible || leftPanelCollapsed) && (
            <>
              <Panel 
                defaultSize={leftPanelCollapsed ? 3 : 18} 
                minSize={leftPanelCollapsed ? 3 : 15} 
                maxSize={leftPanelCollapsed ? 3 : 30}
                className="bg-muted/10 border-r"
              >
                {leftPanelCollapsed ? <CollapsedNavigator /> : <NavigatorPane />}
              </Panel>
              {!leftPanelCollapsed && (
                <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
              )}
            </>
          )}
          
          {/* Center Panel - Active Workspace (Chat or Editor) */}
          <Panel 
            defaultSize={
              (leftPanelVisible || leftPanelCollapsed) && rightPanelVisible ? 40 : 
              (leftPanelVisible || leftPanelCollapsed) || rightPanelVisible ? 60 : 100
            }
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
        )}
      </div>
    </div>
  );
} 