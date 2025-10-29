import React from 'react'
import { Button } from '@/components/ui/button'
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
      <div className="flex items-center justify-center py-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0" 
          onClick={toggleRightPanelCollapsed}
          title="Expand activity"
          aria-label="Expand activity"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
