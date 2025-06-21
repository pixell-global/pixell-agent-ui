'use client'
import { useUIStore } from '@/stores/ui-store'
import { NavigatorPane } from '@/components/navigator/navigator-pane'
import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { ActivityPane } from '@/components/activity/activity-pane'
import { useWebSocket } from '@/lib/websocket-manager'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { designTokens } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@/components/ui/button'
import { PanelLeft, PanelRight, Activity } from 'lucide-react'
import { useEffect } from 'react'

export function AgentWorkspaceLayout() {
  const { 
    leftPanelVisible, 
    rightPanelVisible, 
    toggleLeftPanel, 
    toggleRightPanel
  } = useUIStore()
  
  const { connect } = useWebSocket()
  const { isConnected } = useWorkspaceStore()
  
  // Connect to WebSocket on mount
  useEffect(() => {
    connect()
  }, [connect])

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Pixell Agent Framework</h1>
          <div className="flex items-center gap-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Phase 1 Testing
          </div>
          
          <div className={cn(
            "flex items-center gap-2 px-2 py-1 rounded text-xs",
            isConnected ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-yellow-500"
            )}></div>
            {isConnected ? "Connected" : "Connecting..."}
          </div>
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
        <PanelGroup direction="horizontal">
          {/* Left Panel - Navigator */}
          {leftPanelVisible && (
            <>
              <Panel 
                defaultSize={12} 
                minSize={10} 
                maxSize={25}
                className="bg-muted/10 border-r"
              >
                <NavigatorPane />
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
            </>
          )}
          
          {/* Center Panel - Chat Workspace */}
          <Panel 
            defaultSize={leftPanelVisible && rightPanelVisible ? 60 : leftPanelVisible || rightPanelVisible ? 75 : 100}
            minSize={30}
            className="min-w-0"
          >
            <ChatWorkspace />
          </Panel>
          
          {/* Right Panel - Activity Pane */}
          {rightPanelVisible && (
            <>
              <PanelResizeHandle className="w-px bg-border hover:bg-blue-500 hover:w-1 transition-all duration-200 active:bg-blue-600" />
              <Panel 
                defaultSize={28} 
                minSize={20} 
                maxSize={45}
                className="bg-muted/10 border-l"
              >
                <div className="h-full overflow-y-auto">
                  <ActivityPane />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
} 