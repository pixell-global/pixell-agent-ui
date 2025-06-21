import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  Upload, 
  Plus,
  MoreHorizontal,
  Download,
  Trash2,
  Copy,
  Eye
} from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { StorageAdapter, FileMetadata, UploadProgress } from '@/types/storage'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

interface EnhancedFileTreeProps {
  storageAdapter: StorageAdapter
  onFileSelect?: (file: FileMetadata) => void
  onFolderToggle?: (folder: FileMetadata) => void
  maxFileSize?: number
  allowedTypes?: string[]
  enableContextMenu?: boolean
  enableDragAndDrop?: boolean
  enableSearch?: boolean
}

interface TreeNode extends FileMetadata {
  children?: TreeNode[]
  isExpanded?: boolean
  level?: number
}

export const EnhancedFileTree: React.FC<EnhancedFileTreeProps> = ({
  storageAdapter,
  onFileSelect,
  onFolderToggle,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = ['.txt', '.md', '.json', '.ts', '.js', '.py', '.yml', '.yaml'],
  enableContextMenu = true,
  enableDragAndDrop = true,
  enableSearch = true
}) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map())
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [contextMenuNode, setContextMenuNode] = useState<TreeNode | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParent, setNewFolderParent] = useState<TreeNode | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  
  // Workspace store integration
  const { updateFileNode } = useWorkspaceStore()

  // Load initial file tree
  useEffect(() => {
    loadFileTree()
  }, [])

  const loadFileTree = async () => {
    setLoading(true)
    try {
      const files = await storageAdapter.list('/')
      const tree = buildTree(files)
      setTreeData(tree)
    } catch (error) {
      console.error('Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildTree = (files: FileMetadata[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>()
    const rootNodes: TreeNode[] = []

    // Create nodes for all files and folders
    files.forEach(file => {
      const node: TreeNode = {
        ...file,
        children: file.type === 'folder' ? [] : undefined,
        isExpanded: false,
        level: 0
      }
      nodeMap.set(file.path, node)
    })

    // Build tree structure
    files.forEach(file => {
      const node = nodeMap.get(file.path)!
      const pathParts = file.path.split('/').filter(Boolean)
      
      if (pathParts.length === 1) {
        // Root level
        rootNodes.push(node)
      } else {
        // Find parent
        const parentPath = pathParts.slice(0, -1).join('/')
        const parent = nodeMap.get(parentPath)
        if (parent && parent.children) {
          parent.children.push(node)
          node.level = pathParts.length - 1
        }
      }
    })

    return rootNodes.sort((a, b) => {
      // Folders first, then files
      if (a.type === 'folder' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'folder') return 1
      return a.name.localeCompare(b.name)
    })
  }

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes

    return nodes.reduce<TreeNode[]>((filtered, node) => {
      const matchesQuery = node.name.toLowerCase().includes(query.toLowerCase())
      const filteredChildren = node.children ? filterTree(node.children, query) : []
      
      if (matchesQuery || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
          isExpanded: filteredChildren.length > 0 // Auto-expand if children match
        })
      }
      
      return filtered
    }, [])
  }

  const toggleFolder = useCallback(async (node: TreeNode) => {
    if (node.type !== 'folder') return

    const newExpanded = !node.isExpanded
    
    // Update tree state
    setTreeData(prevTree => 
      updateTreeNode(prevTree, node.path, { isExpanded: newExpanded })
    )

    // Load children if expanding and not loaded yet
    if (newExpanded && (!node.children || node.children.length === 0)) {
      try {
        const children = await storageAdapter.list(node.path)
        const childNodes = children.map(child => ({
          ...child,
          children: child.type === 'folder' ? [] : undefined,
          isExpanded: false,
          level: (node.level || 0) + 1
        }))

        setTreeData(prevTree => 
          updateTreeNode(prevTree, node.path, { children: childNodes })
        )
      } catch (error) {
        console.error('Failed to load folder contents:', error)
      }
    }

    onFolderToggle?.(node)
  }, [onFolderToggle, storageAdapter])

  const updateTreeNode = (
    nodes: TreeNode[], 
    targetPath: string, 
    updates: Partial<TreeNode>
  ): TreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return { ...node, ...updates }
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeNode(node.children, targetPath, updates)
        }
      }
      return node
    })
  }

  const handleFileSelect = (node: TreeNode) => {
    if (node.type === 'file') {
      setSelectedNode(node)
      onFileSelect?.(node)
    } else {
      toggleFolder(node)
    }
  }

  const handleFileUpload = async (files: FileList, targetPath: string = '/') => {
    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      // Validate file
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} is too large`)
        continue
      }
      
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (allowedTypes.length > 0 && !allowedTypes.includes(extension) && !allowedTypes.includes('*')) {
        console.error(`File type not supported: ${file.name}`)
        continue
      }

      const uploadId = crypto.randomUUID()
      const progressInfo: UploadProgress = {
        id: uploadId,
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      }

      setUploadProgress(prev => new Map(prev.set(uploadId, progressInfo)))

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev.get(uploadId)
            if (current && current.progress < 90) {
              const updated = { ...current, progress: current.progress + 10 }
              return new Map(prev.set(uploadId, updated))
            }
            return prev
          })
        }, 200)

        const result = await storageAdapter.upload(file, targetPath)
        
        clearInterval(progressInterval)

        if (result.success && result.file) {
          // Update progress to complete
          setUploadProgress(prev => new Map(prev.set(uploadId, {
            ...progressInfo,
            progress: 100,
            status: 'completed'
          })))

          // Add to tree
          const newNode: TreeNode = {
            ...result.file,
            level: targetPath.split('/').filter(Boolean).length
          }

          setTreeData(prevTree => addNodeToTree(prevTree, newNode, targetPath))

          // Remove progress after delay
          setTimeout(() => {
            setUploadProgress(prev => {
              const newMap = new Map(prev)
              newMap.delete(uploadId)
              return newMap
            })
          }, 2000)
        } else {
          throw new Error(result.error || 'Upload failed')
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error)
        setUploadProgress(prev => new Map(prev.set(uploadId, {
          ...progressInfo,
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed'
        })))
      }
    }
  }

  const addNodeToTree = (nodes: TreeNode[], newNode: TreeNode, parentPath: string): TreeNode[] => {
    if (parentPath === '/') {
      return [...nodes, newNode].sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1
        if (a.type === 'file' && b.type === 'folder') return 1
        return a.name.localeCompare(b.name)
      })
    }

    return nodes.map(node => {
      if (node.path === parentPath && node.children) {
        return {
          ...node,
          children: [...node.children, newNode].sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1
            if (a.type === 'file' && b.type === 'folder') return 1
            return a.name.localeCompare(b.name)
          })
        }
      }
      if (node.children) {
        return {
          ...node,
          children: addNodeToTree(node.children, newNode, parentPath)
        }
      }
      return node
    })
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetPath: string = '/') => {
    e.preventDefault()
    dragCounterRef.current = 0
    
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files, targetPath)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    const parentPath = newFolderParent?.path || '/'
    const folderPath = `${parentPath}/${newFolderName}`.replace(/\/+/g, '/')

    try {
      await storageAdapter.createFolder(folderPath)
      
      const newNode: TreeNode = {
        id: crypto.randomUUID(),
        name: newFolderName,
        path: folderPath,
        size: 0,
        type: 'folder',
        lastModified: new Date().toISOString(),
        children: [],
        isExpanded: false,
        level: (newFolderParent?.level || 0) + 1
      }

      setTreeData(prevTree => addNodeToTree(prevTree, newNode, parentPath))
      
      setShowNewFolderDialog(false)
      setNewFolderName('')
      setNewFolderParent(null)
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleDeleteNode = async () => {
    if (!contextMenuNode) return

    try {
      await storageAdapter.delete(contextMenuNode.path)
      
      setTreeData(prevTree => removeNodeFromTree(prevTree, contextMenuNode.path))
      
      setShowDeleteDialog(false)
      setContextMenuNode(null)
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const removeNodeFromTree = (nodes: TreeNode[], targetPath: string): TreeNode[] => {
    return nodes.filter(node => {
      if (node.path === targetPath) {
        return false
      }
      if (node.children) {
        node.children = removeNodeFromTree(node.children, targetPath)
      }
      return true
    })
  }

  const renderNode = (node: TreeNode): React.ReactNode => {
    const isFolder = node.type === 'folder'
    const isExpanded = node.isExpanded
    const hasChildren = node.children && node.children.length > 0
    const isSelected = selectedNode?.path === node.path
    
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center py-1 px-2 hover:bg-accent cursor-pointer group",
            "transition-colors duration-150",
            isSelected && "bg-accent"
          )}
          style={{ paddingLeft: `${(node.level || 0) * 16 + 8}px` }}
          onClick={() => handleFileSelect(node)}
          onDrop={isFolder ? (e) => handleDrop(e, node.path) : undefined}
          onDragOver={isFolder ? handleDragOver : undefined}
          onDragEnter={isFolder ? handleDragEnter : undefined}
          onDragLeave={isFolder ? handleDragLeave : undefined}
        >
          {isFolder && (
            <div className="w-4 h-4 mr-1 flex items-center justify-center">
              {hasChildren && (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )
              )}
            </div>
          )}
          
          <div className="w-4 h-4 mr-2 flex items-center justify-center">
            {isFolder ? (
              <Folder className="w-3 h-3" />
            ) : (
              <File className="w-3 h-3" />
            )}
          </div>
          
          <span className="text-sm truncate flex-1">{node.name}</span>
          
          {enableContextMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setContextMenuNode(node)
                  }}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {node.type === 'file' && (
                  <>
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {node.type === 'folder' && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setNewFolderParent(node)
                        setShowNewFolderDialog(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Files
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Path
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {isFolder && isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderNode(child))}
          </div>
        )}
      </div>
    )
  }

  const filteredTree = filterTree(treeData, searchQuery)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading files...</div>
      </div>
    )
  }

  return (
    <div className="file-tree">
      {enableSearch && (
        <div className="p-3 border-b">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress.size > 0 && (
        <div className="p-3 border-b space-y-2">
          {Array.from(uploadProgress.values()).map(progress => (
            <div key={progress.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">{progress.fileName}</span>
                <span>{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="h-1" />
            </div>
          ))}
        </div>
      )}

      {/* File tree */}
      <div 
        className="overflow-auto"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, '/')}
      >
        {filteredTree.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Folder className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files found</p>
            {enableDragAndDrop && (
              <p className="text-xs">Drag and drop files to upload</p>
            )}
          </div>
        ) : (
          filteredTree.map(node => renderNode(node))
        )}
      </div>

      {/* Toolbar */}
      <div className="p-3 border-t flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewFolderDialog(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Folder
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFileUpload(e.target.files)
          }
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {contextMenuNode?.type}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{contextMenuNode?.name}"? 
              {contextMenuNode?.type === 'folder' && ' This will delete all contents.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNode}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New folder dialog */}
      <AlertDialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for the new folder
              {newFolderParent && ` in "${newFolderParent.name}"`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder()
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateFolder}>Create</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 