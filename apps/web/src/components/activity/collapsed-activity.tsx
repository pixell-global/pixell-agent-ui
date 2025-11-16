import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

interface CollapsedActivityProps {
  className?: string
}

export const CollapsedActivity: React.FC<CollapsedActivityProps> = ({ className }) => {
  const toggleRightPanelCollapsed = useUIStore(state => state.toggleRightPanelCollapsed)

  return (
    <div className={cn('relative h-full bg-background border-l', className)}>
      {/* Slim gutter with top-centered button */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
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
