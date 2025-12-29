'use client'

import React, { useState, useEffect, useRef } from 'react'
import { File, Folder, Search, AlertTriangle, CheckCircle } from 'lucide-react'
import { FileNode } from '@/types'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'
import { findPartialMatches, isValidMentionText } from '@/lib/mention-processor'
import { isFileSupported } from '@/lib/file-mention-loader'

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
          e.stopImmediatePropagation()  // Prevent other handlers from firing
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
      return <Folder className="h-4 w-4 text-blue-400" />
    }

    // Different colors based on file type and support status
    const supported = isFileSupported(node.name)
    const ext = node.name.split('.').pop()?.toLowerCase()

    let colorClass = 'text-white/40'
    if (supported) {
      switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
          colorClass = 'text-yellow-400'
          break
        case 'json':
          colorClass = 'text-green-400'
          break
        case 'md':
          colorClass = 'text-blue-400'
          break
        case 'py':
          colorClass = 'text-green-500'
          break
        case 'xlsx':
        case 'xls':
          colorClass = 'text-green-500'
          break
        case 'pdf':
          colorClass = 'text-red-400'
          break
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
          colorClass = 'text-purple-400'
          break
        default:
          colorClass = supported ? 'text-green-400' : 'text-white/30'
      }
    }

    return <File className={`h-4 w-4 ${colorClass}`} />
  }

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] bg-pixell-black border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto min-w-72 backdrop-blur-sm"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-sm text-white/60">
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
                "flex items-center w-full px-3 py-2 text-left hover:bg-white/5 text-sm transition-colors",
                index === selectedIndex && "bg-blue-500/20 border-r-2 border-blue-400",
                !supported && "opacity-60"
              )}
              onClick={() => onSelect(file)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-white/90 truncate">
                      {file.name}
                    </div>
                    {supported ? (
                      <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-white/50 truncate">
                    {file.path}
                    {file.size && file.type === 'file' && (
                      <span className="ml-2">• {formatFileSize(file.size)}</span>
                    )}
                    {!supported && (
                      <span className="ml-2 text-orange-400">• Unsupported type</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {filteredFiles.length === 0 && searchTerm && (
        <div className="p-4 text-center text-white/50 text-sm">
          No files found matching &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  )
} 