'use client'

import { FileSpreadsheet } from 'lucide-react'
import type { ActivityOutput } from '@/types'
import { OutputFileItem } from '../items'

interface OutputSectionProps {
  outputs: ActivityOutput[]
  size?: 'sm' | 'md'
  onDownload?: (output: ActivityOutput) => void
}

export function OutputSection({ outputs, size = 'sm', onDownload }: OutputSectionProps) {
  if (outputs.length === 0) return null

  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="p-2">
      <div className={`flex items-center gap-1 mb-1.5 text-pixell-yellow/80`}>
        <FileSpreadsheet className={iconSize} />
        <span className={textSize}>Output</span>
      </div>
      <div className="space-y-1">
        {outputs.map((output, index) => (
          <OutputFileItem
            key={`${output.id}-${index}`}
            output={output}
            size={size}
            onDownload={onDownload}
          />
        ))}
      </div>
    </div>
  )
}
