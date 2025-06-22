'use client'

import React, { useState, useEffect } from 'react'
import { FileNode } from '@/stores/workspace-store'
import { 
  Download, 
  Trash2, 
  FolderOpen,
  ChevronRight,
  Home,
  Building,
  TrendingUp
} from 'lucide-react'

interface TempFileContextMenuProps {
  node: FileNode
  position: { x: number; y: number }
  onClose: () => void
  onDownload: (node: FileNode) => void
  onDelete: (node: FileNode) => void
  onMoveTo: (node: FileNode, targetPath: string) => void
  availableDirectories: { path: string; name: string; icon: React.ReactNode }[]
}

export const TempFileContextMenu: React.FC<TempFileContextMenuProps> = ({
  node,
  position,
  onClose,
  onDownload,
  onDelete,
  onMoveTo,
  availableDirectories
}) => {
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  useEffect(() => {
    const handleClickOutside = () => onClose()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <>
      <div
        className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-48"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Download */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
          onClick={() => handleAction(() => onDownload(node))}
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        
        {/* Add to... */}
        <div className="relative">
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 justify-between"
            onMouseEnter={() => setShowMoveSubmenu(true)}
            onMouseLeave={() => setShowMoveSubmenu(false)}
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Add to...
            </div>
            <ChevronRight className="h-4 w-4" />
          </button>
          
          {/* Move submenu */}
          {showMoveSubmenu && (
            <div
              className="absolute left-full top-0 ml-1 bg-background border rounded-md shadow-lg py-1 min-w-40 z-60"
              onMouseEnter={() => setShowMoveSubmenu(true)}
              onMouseLeave={() => setShowMoveSubmenu(false)}
            >
              {availableDirectories.map((dir) => (
                <button
                  key={dir.path}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => handleAction(() => onMoveTo(node, dir.path))}
                >
                  {dir.icon}
                  {dir.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t border-border mx-2 my-1" />
        
        {/* Delete */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive"
          onClick={() => handleAction(() => onDelete(node))}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </>
  )
} 