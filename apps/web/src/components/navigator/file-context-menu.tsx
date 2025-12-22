import React, { useState, useEffect } from 'react'
import { FileNode } from '@/stores/workspace-store'
import { 
  Edit3, 
  Trash2, 
  Copy, 
  FolderPlus, 
  FileText, 
  Eye, 
  Info 
} from 'lucide-react'

interface FileContextMenuProps {
  node: FileNode
  position: { x: number; y: number }
  onClose: () => void
  onRename: (node: FileNode) => void
  onDelete: (node: FileNode) => void
  onCopyPath: (node: FileNode) => void
  onCreateFile?: (parentNode: FileNode) => void
  onCreateFolder?: (parentNode: FileNode) => void
  onView?: (node: FileNode) => void
  onInfo: (node: FileNode) => void
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  node,
  position,
  onClose,
  onRename,
  onDelete,
  onCopyPath,
  onCreateFile,
  onCreateFolder,
  onView,
  onInfo
}) => {
  const isFolder = node.type === 'folder'

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
    <div
      className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-48"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* File-specific actions */}
      {!isFolder && (
        <>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
            onClick={() => handleAction(() => onView?.(node))}
          >
            <Eye className="h-4 w-4" />
            Open
          </button>
          <div className="border-t border-border mx-2" />
        </>
      )}
      
              {/* Folder-specific actions */}
        {isFolder && (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              onClick={() => handleAction(() => onCreateFolder?.(node))}
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
            <div className="border-t border-border mx-2" />
          </>
        )}
      
      {/* Common actions */}
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => onRename(node))}
      >
        <Edit3 className="h-4 w-4" />
        Rename
      </button>
      
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => onCopyPath(node))}
      >
        <Copy className="h-4 w-4" />
        Copy Path
      </button>
      
      <div className="border-t border-border mx-2" />
      
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => onInfo(node))}
      >
        <Info className="h-4 w-4" />
        Properties
      </button>
      
      <div className="border-t border-border mx-2" />
      
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/20 hover:text-red-400 flex items-center gap-2 transition-colors"
        onClick={() => handleAction(() => onDelete(node))}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  )
} 