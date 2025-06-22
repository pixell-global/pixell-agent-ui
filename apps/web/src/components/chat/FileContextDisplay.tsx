'use client'

import React from 'react'
import { File, Folder, X, Eye } from 'lucide-react'
import { FileReference } from '@/types'

interface FileContextDisplayProps {
  files: FileReference[]
  onRemoveFile?: (fileId: string) => void
  showContent?: boolean
  className?: string
}

export function FileContextDisplay({ 
  files, 
  onRemoveFile,
  showContent = false,
  className = '' 
}: FileContextDisplayProps) {
  const [expandedFiles, setExpandedFiles] = React.useState<Set<string>>(new Set())

  const toggleFileContent = (fileId: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId)
    } else {
      newExpanded.add(fileId)
    }
    setExpandedFiles(newExpanded)
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return ''
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  if (files.length === 0) return null

  return (
    <div className={`file-context-display ${className}`}>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <div key={file.id} className="file-context-chip">
            {/* File Chip */}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {file.type === 'folder' ? (
                  <Folder size={14} className="text-blue-600 flex-shrink-0" />
                ) : (
                  <File size={14} className="text-blue-600 flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-900 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-blue-600 truncate">
                    {file.path}
                  </div>
                </div>
                
                {file.size && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    {formatFileSize(file.size)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Show content toggle */}
                {file.content && showContent && (
                  <button
                    onClick={() => toggleFileContent(file.id)}
                    className="p-1 rounded hover:bg-blue-100 text-blue-600"
                    aria-label={`${expandedFiles.has(file.id) ? 'Hide' : 'Show'} file content`}
                  >
                    <Eye size={14} />
                  </button>
                )}

                {/* Remove file button */}
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(file.id)}
                    className="p-1 rounded hover:bg-blue-100 text-blue-600"
                    aria-label="Remove file reference"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* File Content Preview */}
            {file.content && showContent && expandedFiles.has(file.id) && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">
                    File Content Preview
                  </span>
                  <button
                    onClick={() => toggleFileContent(file.id)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Hide
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto max-h-32">
                  {file.content.length > 500 
                    ? file.content.slice(0, 500) + '...' 
                    : file.content
                  }
                </pre>
                {file.content.length > 500 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Content truncated ({file.content.length} characters total)
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {files.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {files.length} file{files.length !== 1 ? 's' : ''} referenced
        </div>
      )}
    </div>
  )
} 