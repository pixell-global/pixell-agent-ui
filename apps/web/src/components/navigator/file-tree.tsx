import React from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { useWorkspaceStore, selectFileTree, type FileNode } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

export const FileTree: React.FC = () => {
  const fileTree = useWorkspaceStore(selectFileTree)
  const expandFolder = useWorkspaceStore(state => state.expandFolder)
  const collapseFolder = useWorkspaceStore(state => state.collapseFolder)
  const addFileReference = useWorkspaceStore(state => state.addFileReference)

  const handleFolderToggle = (path: string, isExpanded: boolean) => {
    if (isExpanded) {
      collapseFolder(path)
    } else {
      expandFolder(path)
    }
  }

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'file') {
      addFileReference({
        id: node.id,
        name: node.name,
        path: node.path,
        type: 'file',
        size: node.size,
        contextMention: `@${node.name}`
      })
    }
  }

  const renderFileIcon = (type: string, name: string) => {
    if (type === 'folder') {
      return <Folder className="w-4 h-4 text-blue-500" />
    }
    
    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <File className="w-4 h-4 text-yellow-500" />
      case 'json':
        return <File className="w-4 h-4 text-green-500" />
      case 'md':
        return <File className="w-4 h-4 text-blue-500" />
      default:
        return <File className="w-4 h-4 text-gray-500" />
    }
  }

  const renderNode = (node: FileNode, depth = 0) => {
    const isFolder = node.type === 'folder'
    const isExpanded = node.isExpanded || false

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 hover:bg-muted/50 cursor-pointer",
            "text-sm"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              handleFolderToggle(node.path, isExpanded)
            } else {
              handleFileClick(node)
            }
          }}
        >
          {isFolder && (
            <div className="flex items-center justify-center w-4 h-4">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </div>
          )}
          {!isFolder && <div className="w-4" />}
          
          {renderFileIcon(node.type, node.name)}
          
          <span className="truncate flex-1">{node.name}</span>
          
          {node.size && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>

        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
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

  return (
    <div className="space-y-1">
      {fileTree.map(node => renderNode(node))}
    </div>
  )
} 