'use client'
import { useUIStore } from '@/stores/ui-store'
import { NavigatorPane } from '@/components/agents/NavigatorPane'
import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { ActivityPane } from '@/components/activity/ActivityPane'
import { designTokens } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'

export function AgentWorkspaceLayout() {
  const { leftPanelVisible, rightPanelVisible } = useUIStore()

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between flex-shrink-0">
        <h1 className="text-lg font-semibold">Pixell Agent Framework</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">v0.1.0</span>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className={cn(
          "w-80 border-r bg-muted/10 transition-all duration-300",
          !leftPanelVisible && "w-0 overflow-hidden"
        )}>
                     <NavigatorPane />
        </div>
        
        {/* Center Panel */}
        <div className="flex-1 min-w-0">
          <ChatWorkspace />
        </div>
        
        {/* Right Panel */}
        <div className={cn(
          "w-80 border-l bg-muted/10 transition-all duration-300",
          !rightPanelVisible && "w-0 overflow-hidden"
        )}>
          <ActivityPane />
        </div>
      </div>
    </div>
  );
} 