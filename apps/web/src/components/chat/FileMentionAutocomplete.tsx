'use client'

import React, { useState, useEffect, useRef } from 'react'
import { File, Folder, Search, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { FileNode } from '@/types'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'
import { findPartialMatches, isValidMentionText } from '@/lib/mention-processor'
import { isFileSupported, formatFileSize } from '@/lib/file-mention-loader'

interface FileMentionAutocompleteProps {
  searchTerm: string
  onSelect: (file: FileNode) => void
  onClose: () => void
  position: { top: number; left: number }
  visible: boolean
}

export function FileMentionAutocomplete({
  searchTerm,
  onSelect,
  onClose,
  position,
  visible
}: FileMentionAutocompleteProps) {
  const fileTree = useWorkspaceStore(state => state.fileTree)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Use the enhanced file matching from mention processor
  const filteredFiles = React.useMemo(() => {
    if (!searchTerm.trim()) {
      // Show recent/common files when no search term
      return fileTree
        .filter(node => node.type === 'file' && isFileSupported(node.name))
        .slice(0, 8)
    }
    
    // Validate search term
    if (!isValidMentionText(searchTerm)) {
      return []
    }
    
    // Use smart matching from mention processor
    return findPartialMatches(searchTerm, fileTree, 10)
  }, [fileTree, searchTerm])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm, filteredFiles.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredFiles[selectedIndex]) {
            onSelect(filteredFiles[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, selectedIndex, filteredFiles, onSelect, onClose])

  if (!visible || filteredFiles.length === 0) {
    return null
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'folder') {
      return <Folder className="h-4 w-4 text-blue-500" />
    }
    
    // Different colors based on file type and support status
    const supported = isFileSupported(node.name)
    const ext = node.name.split('.').pop()?.toLowerCase()
    
    let colorClass = 'text-gray-500'
    if (supported) {
      switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
          colorClass = 'text-yellow-500'
          break
        case 'json':
          colorClass = 'text-green-500'
          break
        case 'md':
          colorClass = 'text-blue-500'
          break
        case 'py':
          colorClass = 'text-green-600'
          break
        case 'xlsx':
        case 'xls':
          colorClass = 'text-green-700'
          break
        case 'pdf':
          colorClass = 'text-red-500'
          break
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
          colorClass = 'text-purple-500'
          break
        default:
          colorClass = supported ? 'text-green-500' : 'text-gray-400'
      }
    }
    
    return <File className={`h-4 w-4 ${colorClass}`} />
  }

  return (
    <div
      ref={listRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-72"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Search className="h-4 w-4" />
          <span>Mention files</span>
        </div>
      </div>
      
      <div className="py-1">
        {filteredFiles.map((file, index) => {
          const supported = isFileSupported(file.name)
          return (
            <button
              key={file.id}
              className={cn(
                "flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 text-sm transition-colors",
                index === selectedIndex && "bg-blue-50 border-r-2 border-blue-500",
                !supported && "opacity-60"
              )}
              onClick={() => onSelect(file)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900 truncate">
                      {file.name}
                    </div>
                    {supported ? (
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {file.path}
                    {file.size && file.type === 'file' && (
                      <span className="ml-2">• {formatFileSize(file.size)}</span>
                    )}
                    {!supported && (
                      <span className="ml-2 text-orange-600">• Unsupported type</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      
      {filteredFiles.length === 0 && searchTerm && (
        <div className="p-4 text-center text-gray-500 text-sm">
          No files found matching &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  )
} 