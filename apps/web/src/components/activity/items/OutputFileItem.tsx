'use client'

import { FileSpreadsheet, FileText, FileImage, File, Download } from 'lucide-react'
import type { ActivityOutput } from '@/types'

interface OutputFileItemProps {
  output: ActivityOutput
  size?: 'sm' | 'md'
  onDownload?: (output: ActivityOutput) => void
}

function getFileIcon(type: ActivityOutput['type']) {
  switch (type) {
    case 'csv':
    case 'excel':
      return FileSpreadsheet
    case 'text':
    case 'json':
      return FileText
    case 'image':
      return FileImage
    default:
      return File
  }
}

export function OutputFileItem({ output, size = 'sm', onDownload }: OutputFileItemProps) {
  const FileIcon = getFileIcon(output.type)
  const buttonPadding = size === 'sm' ? 'p-1.5' : 'p-2'
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const subTextSize = size === 'sm' ? 'text-[8px]' : 'text-[10px]'

  const handleClick = () => {
    if (onDownload) {
      onDownload(output)
    } else if (output.downloadUrl) {
      window.open(output.downloadUrl, '_blank')
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-2 ${buttonPadding} rounded-md bg-pixell-yellow/10 border border-pixell-yellow/30 hover:bg-pixell-yellow/20 transition-colors group`}
    >
      <FileIcon className={`${iconSize} text-green-500 flex-shrink-0`} />
      <div className="flex-1 min-w-0 text-left">
        <div className={`${textSize} text-white font-medium truncate`}>{output.name}</div>
        <div className={`${subTextSize} text-white/40`}>{output.sizeFormatted}</div>
      </div>
      <Download
        className={`${iconSize} text-pixell-yellow group-hover:scale-110 transition-transform flex-shrink-0`}
      />
    </button>
  )
}
