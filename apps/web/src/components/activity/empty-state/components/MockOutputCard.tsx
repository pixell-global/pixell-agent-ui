'use client'

import React from 'react'
import { FileText, FileSpreadsheet, FileJson, Download } from 'lucide-react'
import type { MockOutputData } from '../mock-data'

interface MockOutputCardProps {
  output: MockOutputData
}

function getFileIcon(type: MockOutputData['type']) {
  switch (type) {
    case 'pdf':
      return FileText
    case 'excel':
    case 'csv':
      return FileSpreadsheet
    case 'json':
      return FileJson
    default:
      return FileText
  }
}

export function MockOutputCard({ output }: MockOutputCardProps) {
  const FileIcon = getFileIcon(output.type)

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-pixell-yellow/5 border border-dashed border-pixell-yellow/20 opacity-70">
      <FileIcon className="w-4 h-4 text-green-500/70 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-white/70 truncate">{output.name}</div>
        <div className="text-[8px] text-white/30">{output.size}</div>
      </div>
      <Download className="w-3.5 h-3.5 text-pixell-yellow/50 flex-shrink-0" />
    </div>
  )
}
