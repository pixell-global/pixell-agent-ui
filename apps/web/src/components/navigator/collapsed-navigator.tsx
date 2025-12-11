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
      {/* Expand button */}
      <div className="flex items-center justify-center h-full">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 rotate-90" 
          onClick={toggleLeftPanelCollapsed}
          title="Expand navigator"
          aria-label="Expand navigator"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
