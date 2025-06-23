'use client'

import React, { useState, useEffect, useRef } from 'react'
import { File, Folder, Search } from 'lucide-react'
import { FileNode } from '@/types'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

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

  // Flatten file tree and filter by search term
  const getFilteredFiles = (nodes: FileNode[], searchTerm: string): FileNode[] => {
    const allFiles: FileNode[] = []
    
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' || node.type === 'folder') {
          allFiles.push(node)
        }
        if (node.type === 'folder' && node.children) {
          traverse(node.children)
        }
      }
    }
    
    traverse(nodes)
    
    // Filter by search term
    if (!searchTerm.trim()) {
      return allFiles.slice(0, 10) // Show first 10 files if no search
    }
    
    return allFiles
      .filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 10) // Limit to 10 results
  }

  const filteredFiles = getFilteredFiles(fileTree, searchTerm)

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
    return <File className="h-4 w-4 text-gray-500" />
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
        {filteredFiles.map((file, index) => (
          <button
            key={file.id}
            className={cn(
              "flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 text-sm",
              index === selectedIndex && "bg-blue-50 border-r-2 border-blue-500"
            )}
            onClick={() => onSelect(file)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getFileIcon(file)}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {file.path}
                  {file.size && file.type === 'file' && (
                    <span className="ml-2">• {formatFileSize(file.size)}</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {filteredFiles.length === 0 && searchTerm && (
        <div className="p-4 text-center text-gray-500 text-sm">
          No files found matching &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  )
} 