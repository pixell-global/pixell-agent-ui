import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  message?: string
  className?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Analyzing your workspace...',
  className
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full p-6', className)}>
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
