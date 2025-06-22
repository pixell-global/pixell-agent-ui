import React, { useState, useEffect, useMemo } from 'react'
import { File, Folder } from 'lucide-react'
import { useWorkspaceStore, selectFileTree, type FileNode, type FileReference } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

interface FileAutocompleteProps {
  query: string
  onSelect: (file: FileReference) => void
  onClose: () => void
  isVisible: boolean
}

export const FileAutocomplete: React.FC<FileAutocompleteProps> = ({
  query,
  onSelect,
  onClose,
  isVisible
}) => {
  const fileTree = useWorkspaceStore(selectFileTree)
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  // Flatten file tree for searching
  const flattenFiles = (nodes: FileNode[]): FileNode[] => {
    const flat: FileNode[] = []
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        flat.push(node)
        if (node.children) {
          traverse(node.children)
        }
      }
    }
    traverse(nodes)
    return flat
  }
  
  const filteredFiles = useMemo(() => {
    if (!query.trim()) return []
    
    const allFiles = flattenFiles(fileTree)
    const searchTerm = query.toLowerCase()
    
    return allFiles
      .filter(file => 
        file.name.toLowerCase().includes(searchTerm) ||
        file.path.toLowerCase().includes(searchTerm)
      )
      .slice(0, 10) // Limit results
      .sort((a, b) => {
        // Prioritize exact name matches
        const aNameMatch = a.name.toLowerCase().startsWith(searchTerm)
        const bNameMatch = b.name.toLowerCase().startsWith(searchTerm)
        
        if (aNameMatch && !bNameMatch) return -1
        if (!aNameMatch && bNameMatch) return 1
        
        // Then by path length (shorter paths first)
        return a.path.length - b.path.length
      })
  }, [fileTree, query])
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isVisible || filteredFiles.length === 0) return
    
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
          handleSelect(filteredFiles[selectedIndex])
        }
        break
        
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }
  
  const handleSelect = async (file: FileNode) => {
    let content = ''
    
    // Read file content for small text files
    if (file.type === 'file' && file.size && file.size < 100000) { // 100KB limit
      try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(file.path)}`)
        if (response.ok) {
          content = await response.text()
        }
      } catch (error) {
        console.error('Failed to read file content:', error)
      }
    }
    
    const fileRef: FileReference = {
      id: file.id,
      name: file.name,
      path: file.path,
      type: file.type,
      size: file.size,
      content,
      contextMention: `@${file.name}`
    }
    
    onSelect(fileRef)
    onClose()
  }
  
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredFiles])
  
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e as any)
    }
    
    if (isVisible) {
      document.addEventListener('keydown', handleGlobalKeyDown)
      return () => document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isVisible, handleKeyDown])
  
  if (!isVisible || filteredFiles.length === 0) {
    return null
  }
  
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto z-50">
      {filteredFiles.map((file, index) => (
        <div
          key={file.id}
          className={cn(
            "flex items-center px-3 py-2 cursor-pointer transition-colors",
            index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
          )}
          onClick={() => handleSelect(file)}
        >
          <div className="w-4 h-4 mr-2 flex items-center justify-center">
            {file.type === 'folder' ? (
              <Folder className="w-3 h-3" />
            ) : (
              <File className="w-3 h-3" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-muted-foreground truncate">{file.path}</div>
          </div>
          
          {file.size && (
            <div className="text-xs text-muted-foreground ml-2">
              {formatFileSize(file.size)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
} 