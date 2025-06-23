import React, { useRef, useCallback, useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, Upload, Search, Home, Building, TrendingUp } from 'lucide-react'
import { useWorkspaceStore, selectFileTree, type FileNode } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'
import { FileContextMenu } from './file-context-menu'
import { TempFileContextMenu } from './temp-file-context-menu'

interface FileTreeProps {
  onFileSelect?: (file: FileNode) => void
  onFolderToggle?: (folder: FileNode) => void
  maxFileSize?: number
  allowedTypes?: string[]
  onFilesDownload?: (files: FileNode[]) => void
  searchTerm?: string
}

export const FileTree: React.FC<FileTreeProps> = ({
  onFileSelect,
  onFolderToggle,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = ['.txt', '.md', '.json', '.ts', '.js', '.py', '.yml', '.yaml'],
  onFilesDownload,
  searchTerm = ''
}) => {
  const fileTree = useWorkspaceStore(selectFileTree)
  const updateFileNode = useWorkspaceStore(state => state.updateFileNode)
  const addFileNode = useWorkspaceStore(state => state.addFileNode)
  const removeFileNode = useWorkspaceStore(state => state.removeFileNode)
  const addUploadProgress = useWorkspaceStore(state => state.addUploadProgress)
  const updateUploadProgress = useWorkspaceStore(state => state.updateUploadProgress)
  const removeUploadProgress = useWorkspaceStore(state => state.removeUploadProgress)
  const addFileReference = useWorkspaceStore(state => state.addFileReference)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    node: FileNode
    position: { x: number; y: number }
    isTemp?: boolean
  } | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [lastSelectedFile, setLastSelectedFile] = useState<string | null>(null)

  // Filter file tree based on search term
  const filterFileTree = (nodes: FileNode[], searchTerm: string): FileNode[] => {
    if (!searchTerm.trim()) return nodes

    const filtered: FileNode[] = []
    
    for (const node of nodes) {
      if (node.type === 'file') {
        // Include files that match the search term
        if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          filtered.push(node)
        }
      } else if (node.type === 'folder' && node.children) {
        // For folders, recursively filter children
        const filteredChildren = filterFileTree(node.children, searchTerm)
        
        // Include folder if it has matching children OR if folder name matches
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          filtered.push({
            ...node,
            children: filteredChildren,
            isExpanded: searchTerm.trim() ? true : node.isExpanded // Auto-expand when searching
          })
        }
      }
    }
    
    return filtered
  }

  // Get filtered file tree
  const filteredFileTree = searchTerm ? filterFileTree(fileTree, searchTerm) : fileTree

  // Get all files in display order for range selection
  const getAllFilesInOrder = (): FileNode[] => {
    const allFiles: FileNode[] = []
    
    const traverseTree = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          allFiles.push(node)
        }
        if (node.type === 'folder' && node.isExpanded && node.children) {
          traverseTree(node.children)
        }
      }
    }
    
    traverseTree(filteredFileTree)
    return allFiles
  }

  // Download files
  const downloadFiles = async (files: FileNode[]) => {
    if (files.length === 0) return

    for (const file of files) {
      try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(file.path)}`)
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
        }
      } catch (error) {
        console.error(`Failed to download ${file.name}:`, error)
      }
    }
    
    // Notify parent component
    onFilesDownload?.(files)
  }
  
  const handleFileUpload = async (files: FileList, targetPath: string) => {
    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      // Validate file
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} is too large (max ${maxFileSize / 1024 / 1024}MB)`)
        continue
      }
      
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(extension)) {
        console.error(`File type not supported: ${file.name}`)
        continue
      }
      
      const uploadId = crypto.randomUUID()
      addUploadProgress(uploadId, file.name, 0)
      
      try {
        // Simulate upload with progress
        await uploadFileWithProgress(file, targetPath, (progress) => {
          updateUploadProgress(uploadId, progress)
        })
        
        // Add file to tree after successful upload
        const newFile: FileNode = {
          id: crypto.randomUUID(),
          name: file.name,
          path: `${targetPath}/${file.name}`,
          type: 'file',
          size: file.size,
          lastModified: new Date().toISOString()
        }
        
        addFileNode(targetPath, newFile)
        removeUploadProgress(uploadId)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        removeUploadProgress(uploadId)
      }
    }
  }
  
  const uploadFileWithProgress = async (
    file: File, 
    targetPath: string, 
    onProgress: (progress: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', targetPath)
      
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          onProgress(progress)
        }
      })
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve()
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      })
      
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'))
      })
      
      xhr.open('POST', '/api/files/create')
      xhr.send(formData)
    })
  }
  
  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files, targetPath)
    }
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }
  
  const toggleFolder = (folder: FileNode) => {
    updateFileNode(folder.path, { isExpanded: !folder.isExpanded })
    onFolderToggle?.(folder)
  }
  
  const handleFileSelection = async (file: FileNode, event: React.MouseEvent) => {
    if (file.type === 'folder') {
      toggleFolder(file)
      return
    }

    // Handle multi-select for files
    const isCtrlOrCmd = event.ctrlKey || event.metaKey
    const isShift = event.shiftKey
    
    const newSelectedFiles = new Set(selectedFiles)
    
    if (isShift && lastSelectedFile) {
      // Range selection
      const allFiles = getAllFilesInOrder()
      const lastIndex = allFiles.findIndex(f => f.path === lastSelectedFile)
      const currentIndex = allFiles.findIndex(f => f.path === file.path)
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        
        // Clear previous selection if not holding Ctrl/Cmd
        if (!isCtrlOrCmd) {
          newSelectedFiles.clear()
        }
        
        // Add range to selection
        for (let i = start; i <= end; i++) {
          newSelectedFiles.add(allFiles[i].path)
        }
      }
    } else if (isCtrlOrCmd) {
      // Toggle individual selection
      if (newSelectedFiles.has(file.path)) {
        newSelectedFiles.delete(file.path)
      } else {
        newSelectedFiles.add(file.path)
      }
    } else {
      // Single selection
      newSelectedFiles.clear()
      newSelectedFiles.add(file.path)
    }
    
    setSelectedFiles(newSelectedFiles)
    setLastSelectedFile(file.path)
    
    // Get selected file objects for download
    const selectedFileObjects = getAllFilesInOrder().filter(f => newSelectedFiles.has(f.path))
    
    // Download selected files
    if (selectedFileObjects.length > 0) {
      await downloadFiles(selectedFileObjects)
    }
    
    // Add to file references for chat context (for single selection)
    if (selectedFileObjects.length === 1) {
      const selectedFile = selectedFileObjects[0]
      let content = ''
      if (selectedFile.size && selectedFile.size < 100000) { // 100KB limit
        try {
          const response = await fetch(`/api/files/content?path=${encodeURIComponent(selectedFile.path)}`)
          if (response.ok) {
            content = await response.text()
          }
        } catch (error) {
          console.error('Failed to read file content:', error)
        }
      }
      
      addFileReference({
        id: selectedFile.id,
        name: selectedFile.name,
        path: selectedFile.path,
        type: selectedFile.type,
        size: selectedFile.size,
        content,
        contextMention: `@${selectedFile.name}`
      })
      
      onFileSelect?.(selectedFile)
    }
  }

  // Context menu handlers
  const handleRightClick = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    const isInTempFolder = node.path.includes('/.temp/') || node.path.startsWith('.temp/')
    setContextMenu({
      node,
      position: { x: e.clientX, y: e.clientY },
      isTemp: isInTempFolder
    })
  }

  const handleRename = (node: FileNode) => {
    const newName = prompt('Enter new name:', node.name)
    if (newName && newName !== node.name) {
      const newPath = node.path.replace(node.name, newName)
      updateFileNode(node.path, { name: newName, path: newPath })
    }
  }

  const handleDelete = (node: FileNode) => {
    if (confirm(`Are you sure you want to delete "${node.name}"?`)) {
      removeFileNode(node.path)
    }
  }

  const handleCopyPath = (node: FileNode) => {
    navigator.clipboard.writeText(node.path)
  }

  const handleCreateFile = async (parentNode: FileNode) => {
    const fileName = prompt('Enter file name:')
    if (fileName) {
      try {
        const filePath = `${parentNode.path}/${fileName}`
        
        // Call the file creation API
        const response = await fetch('/api/files/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: filePath,
            content: '',
            type: 'file'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          // Add to file tree with actual file data
          const newFile: FileNode = {
            id: crypto.randomUUID(),
            name: fileName,
            type: 'file',
            path: filePath,
            size: result.size || 0,
            lastModified: result.lastModified || new Date().toISOString()
          }
          addFileNode(parentNode.path, newFile)
          console.log('File created successfully:', fileName)
        } else {
          console.error('Failed to create file:', result.error)
          alert(`Failed to create file: ${result.error}`)
        }
      } catch (error) {
        console.error('Error creating file:', error)
        alert('Failed to create file. Please try again.')
      }
    }
  }

  const handleCreateFolder = async (parentNode: FileNode) => {
    const folderName = prompt('Enter folder name:')
    if (folderName) {
      try {
        const folderPath = `${parentNode.path}/${folderName}`
        
        // Call the folder creation API
        const response = await fetch('/api/files/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: folderPath,
            type: 'folder'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          // Add to file tree with actual folder data
          const newFolder: FileNode = {
            id: crypto.randomUUID(),
            name: folderName,
            type: 'folder',
            path: folderPath,
            lastModified: new Date().toISOString(),
            isExpanded: false,
            children: []
          }
          addFileNode(parentNode.path, newFolder)
          console.log('Folder created successfully:', folderName)
        } else {
          console.error('Failed to create folder:', result.error)
          alert(`Failed to create folder: ${result.error}`)
        }
      } catch (error) {
        console.error('Error creating folder:', error)
        alert('Failed to create folder. Please try again.')
      }
    }
  }

  const handleView = (node: FileNode) => {
    if (node.type === 'file') {
      // Simulate a regular click for file selection
      const mockEvent = {
        ctrlKey: false,
        metaKey: false,
        shiftKey: false
      } as React.MouseEvent
      handleFileSelection(node, mockEvent)
    }
  }

  const handleInfo = (node: FileNode) => {
    const info = [
      `Name: ${node.name}`,
      `Path: ${node.path}`,
      `Type: ${node.type}`,
      node.size ? `Size: ${formatFileSize(node.size)}` : '',
      `Last Modified: ${new Date(node.lastModified).toLocaleString()}`
    ].filter(Boolean).join('\n')
    
    alert(info)
  }

  // Temp file handlers
  const handleTempFileDownload = async (node: FileNode) => {
    try {
      // Normalize the file path (remove leading slash if present)
      const normalizedPath = node.path.startsWith('/') ? node.path.substring(1) : node.path
      
      const response = await fetch(`/api/files/content?path=${encodeURIComponent(normalizedPath)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.content) {
          // Create blob from content
          const blob = new Blob([data.content], { type: 'text/plain' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = node.name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
          console.log(`Downloaded temp file: ${node.name}`)
        } else {
          throw new Error(data.error || 'Failed to read file content')
        }
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error(`Failed to download ${node.name}:`, error)
      alert(`Failed to download ${node.name}. Please try again.`)
    }
  }

  const handleTempFileDelete = async (node: FileNode) => {
    if (confirm(`Are you sure you want to delete "${node.name}" from temporary files?`)) {
      try {
        // Normalize the file path (remove leading slash if present)
        const normalizedPath = node.path.startsWith('/') ? node.path.substring(1) : node.path
        
        const response = await fetch(`/api/files?path=${encodeURIComponent(normalizedPath)}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          removeFileNode(node.path)
          console.log(`Deleted temp file: ${node.name}`)
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Delete failed')
        }
      } catch (error) {
        console.error(`Failed to delete ${node.name}:`, error)
        alert(`Failed to delete ${node.name}. Please try again.`)
      }
    }
  }

  const handleTempFileMoveTo = async (node: FileNode, targetPath: string) => {
    try {
      console.log('Moving temp file:', node.path, 'to:', targetPath)
      
      // Normalize the file path (remove leading slash if present)
      const normalizedPath = node.path.startsWith('/') ? node.path.substring(1) : node.path
      console.log('Normalized path:', normalizedPath)
      
      // First, get the file content
      const response = await fetch(`/api/files/content?path=${encodeURIComponent(normalizedPath)}`)
      console.log('Content API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Content API error:', errorText)
        throw new Error(`Failed to read file content: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Content API data:', data)
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to read file content')
      }
      
      const content = data.content
      const newPath = targetPath === '/' ? node.name : `${targetPath}/${node.name}`
      console.log('Moving to new path:', newPath)
      
      // Create the file in the new location
      const createResponse = await fetch('/api/files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: newPath,
          content: content,
          type: 'file'
        })
      })
      
      const createResult = await createResponse.json()
      
      if (createResult.success) {
        // Delete the original temp file
        await fetch(`/api/files?path=${encodeURIComponent(normalizedPath)}`, {
          method: 'DELETE'
        })
        
        // Update the file tree
        removeFileNode(node.path)
        
        // Add the new file to the target location
        const newFile: FileNode = {
          id: crypto.randomUUID(),
          name: node.name,
          type: 'file',
          path: newPath,
          size: createResult.size || node.size,
          lastModified: createResult.lastModified || new Date().toISOString()
        }
        addFileNode(targetPath, newFile)
        
        console.log(`Moved ${node.name} from temp to ${targetPath}`)
        alert(`Successfully moved ${node.name} to ${targetPath === '/' ? 'root' : targetPath}`)
      } else {
        throw new Error(createResult.error || 'Failed to create file')
      }
    } catch (error) {
      console.error(`Failed to move ${node.name}:`, error)
      alert(`Failed to move ${node.name}. Please try again.`)
    }
  }

  // Available directories for temp file movement
  const getAvailableDirectories = () => {
    const directories = [
      { path: '/', name: 'Root', icon: <Home className="h-4 w-4" /> },
      { path: '/business', name: 'Business', icon: <Building className="h-4 w-4" /> },
      { path: '/marketing', name: 'Marketing', icon: <TrendingUp className="h-4 w-4" /> }
    ]

    // Add any other directories found in the file tree
    const addDirectoriesFromTree = (nodes: FileNode[], parentPath = '') => {
      nodes.forEach(node => {
        if (node.type === 'folder' && !node.name.startsWith('.')) {
          const fullPath = parentPath + '/' + node.name
          if (!directories.find(d => d.path === fullPath)) {
            directories.push({
              path: fullPath,
              name: node.name,
              icon: <Folder className="h-4 w-4" />
            })
          }
          if (node.children) {
            addDirectoriesFromTree(node.children, fullPath)
          }
        }
      })
    }

    addDirectoriesFromTree(fileTree)
    return directories.filter(dir => !dir.path.includes('.temp'))
  }
  
  const renderFileIcon = (type: string, name: string, isInTemp = false) => {
    if (type === 'folder') {
      return <Folder className={cn("w-4 h-4", isInTemp ? "text-gray-400" : "text-blue-500")} />
    }
    
    const ext = name.split('.').pop()?.toLowerCase()
    const greyColor = "text-gray-400"
    
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <File className={cn("w-4 h-4", isInTemp ? greyColor : "text-yellow-500")} />
      case 'json':
        return <File className={cn("w-4 h-4", isInTemp ? greyColor : "text-green-500")} />
      case 'md':
        return <File className={cn("w-4 h-4", isInTemp ? greyColor : "text-blue-500")} />
      case 'py':
        return <File className={cn("w-4 h-4", isInTemp ? greyColor : "text-green-600")} />
      case 'yml':
      case 'yaml':
        return <File className={cn("w-4 h-4", isInTemp ? greyColor : "text-purple-500")} />
      default:
        return <File className={cn("w-4 h-4", isInTemp ? greyColor : "text-gray-500")} />
    }
  }
  
  const renderNode = (node: FileNode, depth = 0, isInTempFolder = false): React.ReactNode => {
    const isFolder = node.type === 'folder'
    const isExpanded = node.isExpanded
    const hasChildren = node.children && node.children.length > 0
    const isTempFolder = node.name === '.temp'
    const isInTemp = isInTempFolder || isTempFolder
    
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center py-1 px-2 hover:bg-accent cursor-pointer",
            "transition-colors duration-150",
            selectedFiles.has(node.path) && node.type === 'file' ? "bg-accent" : "",
            isInTemp && "opacity-60" // Make temp files and folders more transparent
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => handleFileSelection(node, e)}
          onContextMenu={(e) => handleRightClick(e, node)}
          onDrop={isFolder ? (e) => handleDrop(e, node.path) : undefined}
          onDragOver={isFolder ? handleDragOver : undefined}
        >
          {isFolder && (
            <div className="w-4 h-4 mr-1 flex items-center justify-center">
              {hasChildren && (
                isExpanded ? (
                  <ChevronDown className={cn("w-3 h-3", isInTemp && "text-gray-400")} />
                ) : (
                  <ChevronRight className={cn("w-3 h-3", isInTemp && "text-gray-400")} />
                )
              )}
            </div>
          )}
          
          <div className="w-4 h-4 mr-2 flex items-center justify-center">
            {renderFileIcon(node.type, node.name, isInTemp)}
          </div>
          
          <span className={cn(
            "text-sm truncate flex-1",
            isInTemp && "text-gray-500" // Make temp file names greyish
          )}>
            {node.name}
            {isTempFolder && <span className="ml-1 text-xs text-gray-400">(temporary)</span>}
          </span>
          
          {node.uploadProgress !== undefined && (
            <div className="ml-2 w-12 h-1 bg-gray-200 rounded">
              <div 
                className="h-full bg-blue-500 rounded transition-all duration-300"
                style={{ width: `${node.uploadProgress}%` }}
              />
            </div>
          )}
          
          {node.size !== undefined && node.uploadProgress === undefined && (
            <span className={cn(
              "text-xs text-muted-foreground ml-2 text-[10px]",
              isInTemp && "text-gray-400" // Make temp file sizes more grey
            )}>
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
        
        {isFolder && isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1, isInTemp))}
          </div>
        )}
      </div>
    )
  }
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 KB'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }
  
  return (
    <div className="file-tree">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFileUpload(e.target.files, '/')
          }
        }}
      />
      
      <div className="space-y-1">
        {filteredFileTree.map(node => renderNode(node))}
      </div>
      
      {filteredFileTree.length === 0 && searchTerm && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No files found</p>
          <p className="text-xs">Try adjusting your search term</p>
        </div>
      )}
      
      {fileTree.length === 0 && !searchTerm && (
        <div className="text-center py-8 text-muted-foreground">
          <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No files yet</p>
          <p className="text-xs">Drag & drop files to upload</p>
        </div>
      )}

      {contextMenu && !contextMenu.isTemp && (
        <FileContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onRename={handleRename}
          onDelete={handleDelete}
          onCopyPath={handleCopyPath}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onView={handleView}
          onInfo={handleInfo}
        />
      )}

      {contextMenu && contextMenu.isTemp && (
        <TempFileContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onDownload={handleTempFileDownload}
          onDelete={handleTempFileDelete}
          onMoveTo={handleTempFileMoveTo}
          availableDirectories={getAvailableDirectories()}
        />
      )}
    </div>
  )
} 