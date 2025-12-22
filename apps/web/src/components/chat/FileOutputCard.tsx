'use client'

import React from 'react'
import { FileText, FileCode, Table, File, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { FileOutput } from '@/types'

interface FileOutputCardProps {
  output: FileOutput
  onOpen?: (path: string) => void
  onDownload?: (path: string) => void
  isLoading?: boolean
  className?: string
}

const formatIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  html: FileCode,
  csv: Table,
  json: FileCode,
  txt: FileText,
  pdf: File,
  xlsx: Table,
}

const formatLabels: Record<string, string> = {
  html: 'HTML Report',
  csv: 'CSV Data',
  json: 'JSON Data',
  txt: 'Text File',
  pdf: 'PDF Document',
  xlsx: 'Excel Spreadsheet',
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileOutputCard({
  output,
  onOpen,
  onDownload,
  isLoading = false,
  className = ''
}: FileOutputCardProps) {
  const Icon = formatIcons[output.format] || File
  const label = formatLabels[output.format] || 'File'

  const handleOpen = () => {
    if (onOpen) {
      onOpen(output.path)
    }
  }

  const handleDownload = async () => {
    if (onDownload) {
      onDownload(output.path)
    } else {
      // Default download behavior via API
      try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(output.path)}`)
        if (!response.ok) throw new Error('Failed to download file')

        const data = await response.json()
        const content = data.content || ''

        // Create blob and trigger download
        const blob = new Blob([content], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = output.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Download failed:', error)
      }
    }
  }

  return (
    <Card className={`bg-white/5 border-white/10 ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* File icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-pixell-yellow/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-pixell-yellow" />
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">
                {output.name}
              </span>
              <span className="text-xs text-white/40 uppercase">
                {output.format}
              </span>
            </div>
            {output.summary && (
              <p className="text-xs text-white/60 mt-0.5 line-clamp-1">
                {output.summary}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/40">
                {label}
              </span>
              {output.size && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-xs text-white/40">
                    {formatFileSize(output.size)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {onOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpen}
                disabled={isLoading}
                className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
                title="Open in viewer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading}
              className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
