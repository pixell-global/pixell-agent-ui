import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

interface CollapsedNavigatorProps {
  className?: string
}

export const CollapsedNavigator: React.FC<CollapsedNavigatorProps> = ({ className }) => {
  const toggleLeftPanelCollapsed = useUIStore(state => state.toggleLeftPanelCollapsed)

  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      {/* Expand button at top */}
      <div className="flex items-center justify-center h-9 border-b bg-card/60">
        <button
          onClick={toggleLeftPanelCollapsed}
          title="Expand navigator"
          aria-label="Expand navigator"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
