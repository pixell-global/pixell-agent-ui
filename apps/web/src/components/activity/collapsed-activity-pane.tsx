import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

interface CollapsedActivityPaneProps {
  className?: string
}

export const CollapsedActivityPane: React.FC<CollapsedActivityPaneProps> = ({ className }) => {
  const toggleRightPanelCollapsed = useUIStore(state => state.toggleRightPanelCollapsed)

  return (
    <div className={cn("flex flex-col h-full bg-background border-l", className)}>
      {/* Expand button at top */}
      <div className="flex items-center justify-center h-9 border-b bg-card/60">
        <button
          onClick={toggleRightPanelCollapsed}
          title="Expand activity"
          aria-label="Expand activity"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
