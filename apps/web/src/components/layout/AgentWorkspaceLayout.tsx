'use client'
import { useUIStore } from '@/stores/ui-store'
import { NavigatorPane } from '@/components/navigator/navigator-pane'
import { CollapsedNavigator } from '@/components/navigator/collapsed-navigator'
import { CollapsedActivityPane } from '@/components/activity/collapsed-activity-pane'
import { WorkspaceTabs } from '@/components/workspace/WorkspaceTabs'
import { WorkspaceContainer } from '@/components/workspace/WorkspaceContainer'
import { ActivityPane } from '@/components/activity/activity-pane'
import { useWebSocket } from '@/lib/websocket-manager'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useEffect, useState } from 'react'
import { UserMenu } from '@/components/auth/UserMenu'

export function AgentWorkspaceLayout() {
  const {
    leftPanelCollapsed,
    rightPanelCollapsed,
  } = useUIStore()

  const { connect } = useWebSocket()

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
        <div className="flex items-center gap-3">
          <img
            src="/assets/TypeLogo_Pixell_white.svg"
            alt="Pixell"
            className="h-7 w-auto"
          />
        </div>

        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {mounted && (
        <PanelGroup id="workspace-panels" direction="horizontal">
          {/* Left Panel - Navigator (always rendered, collapsed or expanded) */}
          <Panel
            defaultSize={leftPanelCollapsed ? 2 : 18}
            minSize={leftPanelCollapsed ? 2 : 15}
            maxSize={leftPanelCollapsed ? 2 : 30}
            className={cn("bg-muted/10", !leftPanelCollapsed && "border-r")}
          >
            {leftPanelCollapsed ? <CollapsedNavigator /> : <NavigatorPane />}
          </Panel>
          {!leftPanelCollapsed && (
            <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
          )}

          {/* Center Panel - Active Workspace (Chat or Editor) */}
          <Panel
            defaultSize={leftPanelCollapsed && rightPanelCollapsed ? 96 : leftPanelCollapsed || rightPanelCollapsed ? 78 : 60}
            minSize={30}
            className="min-w-0 flex flex-col"
          >
            <WorkspaceTabs />
            <div className="flex-1 overflow-hidden">
              <WorkspaceContainer />
            </div>
          </Panel>

          {/* Right Panel - Activity Pane (always rendered, collapsed or expanded) */}
          {!rightPanelCollapsed && (
            <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
          )}
          <Panel
            defaultSize={rightPanelCollapsed ? 2 : 20}
            minSize={rightPanelCollapsed ? 2 : 15}
            maxSize={rightPanelCollapsed ? 2 : 55}
            className={cn("bg-muted/10", !rightPanelCollapsed && "border-l")}
          >
            {rightPanelCollapsed ? (
              <CollapsedActivityPane />
            ) : (
              <div className="h-full overflow-y-auto">
                <ActivityPane />
              </div>
            )}
          </Panel>
        </PanelGroup>
        )}
      </div>
    </div>
  );
} 