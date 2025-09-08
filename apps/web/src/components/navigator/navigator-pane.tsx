import React, { useState, useEffect } from 'react'
import { Search, Folder, Plus, History, Files, RefreshCw, FileText, FolderPlus, Upload, HardDrive, X, RotateCcw, ChevronLeft } from 'lucide-react'
import { useWorkspaceStore, FileNode } from '@/stores/workspace-store'
import { FileTree } from './file-tree'
import { HistoryPane } from './history-pane'
import { CreateFolderDialog } from './create-folder-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface NavigatorPaneProps {
  className?: string
}

export const NavigatorPane: React.FC<NavigatorPaneProps> = ({ className }) => {
  const toggleLeftPanelCollapsed = useUIStore(state => state.toggleLeftPanelCollapsed)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [activeTab, setActiveTab] = useState('files')
  const [isLoading, setIsLoading] = useState(false)
  const [useRealFiles, setUseRealFiles] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [usedStorage, setUsedStorage] = useState(0) // Will be calculated from actual files
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // Storage limit is configurable via CLI: `pixell config-storage --limit <number>`
  const [storageLimit] = useState(() => {
    // In a real implementation, this would read from CLI config or environment
    // For now, we'll use environment variable or default to 10GB
    const envLimit = process.env.NEXT_PUBLIC_STORAGE_LIMIT
    return envLimit ? parseInt(envLimit) : 10
  })
  
  // Get current folder from workspace store
  const currentFolder = useWorkspaceStore(state => state.currentFolder)
  const setFileTree = useWorkspaceStore(state => state.setFileTree)
  const addFileNode = useWorkspaceStore(state => state.addFileNode)
  const fileTree = useWorkspaceStore(state => state.fileTree)

  // Calculate storage usage from file tree
  const calculateStorageUsage = (files: FileNode[]): number => {
    let totalBytes = 0
    
    const traverseFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.size) {
          totalBytes += node.size
        }
        if (node.type === 'folder' && node.children) {
          traverseFiles(node.children)
        }
      }
    }
    
    traverseFiles(files)
    return totalBytes / (1024 * 1024 * 1024) // Convert to GB
  }
  
  // Load real workspace files
  const loadWorkspaceFiles = async () => {
    setIsLoading(true)
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime()
      // Load from workspace root - the API will handle the workspace-files path
      const response = await fetch(`/api/files/list?path=&_t=${timestamp}`)
      if (response.ok) {
        const data = await response.json()
        console.log('API Response:', data)
        if (data.success) {
          if (data.files && data.files.length > 0) {
            setFileTree(data.files)
            setUseRealFiles(true)
            setUsedStorage(calculateStorageUsage(data.files))
            console.log('Loaded files from filesystem:', data.files.length, 'items')
          } else {
            console.log('No files returned from API, checking if real files exist...')
            // Try to create some structure to show actual workspace-files
            setFileTree([])
            setUseRealFiles(true)
            setUsedStorage(0)
          }
        } else {
          throw new Error(data.error || 'Failed to load files')
        }
      } else {
        throw new Error(`API request failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to load workspace files:', error)
      // Don't fallback to sample data - show real structure even if empty
      setFileTree([])
      setUseRealFiles(true)
      setUsedStorage(0)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Initialize file tree
  useEffect(() => {
    if (fileTree.length === 0) {
      loadWorkspaceFiles()
    }
  }, [fileTree.length])

  // Update storage usage when file tree changes
  useEffect(() => {
    if (fileTree.length > 0) {
      setUsedStorage(calculateStorageUsage(fileTree))
    }
  }, [fileTree])

  const handleCreateFile = async () => {
    const fileName = prompt('Enter file name:')
    if (fileName) {
      try {
        const filePath = selectedFolder ? `${selectedFolder}/${fileName}` : fileName
        
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
          addFileNode(selectedFolder || '/', newFile)
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

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:')
    if (folderName) {
      try {
        const folderPath = selectedFolder ? `${selectedFolder}/${folderName}` : folderName
        
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
          addFileNode(selectedFolder || '/', newFolder)
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

  const handleUploadFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files) {
        Array.from(target.files).forEach(file => {
          // Add to file tree using proper store method
          // Storage usage will be automatically calculated via useEffect
          const newFile: FileNode = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            type: 'file',
            path: selectedFolder ? `${selectedFolder}/${file.name}` : file.name,
            size: file.size,
            lastModified: new Date().toISOString()
          }
          addFileNode(selectedFolder || '/', newFile)
        })
      }
    }
    input.click()
  }



  const handleRefresh = async () => {
    setIsLoading(true)
    // Clear the current file tree to force a fresh reload
    setFileTree([])
    // Force reload from filesystem
    await loadWorkspaceFiles()
    console.log('File tree refreshed')
  }

  const storagePercentage = (usedStorage / storageLimit) * 100

  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      {/* Pane header with collapse */}
      <div className="flex items-center justify-between px-2 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground">Navigator</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0" 
          onClick={toggleLeftPanelCollapsed}
          title="Collapse navigator"
          aria-label="Collapse navigator"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex justify-center mt-2 mb-2">
          <TabsList className="grid grid-cols-2 w-auto min-w-48">
            <TabsTrigger value="files" className="flex items-center justify-center gap-2 px-4">
              <Files className="h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center justify-center gap-2 px-4">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Toolbar - Only show for Files tab */}
        {activeTab === 'files' && (
          <div className="w-full py-2">
            <div className="bg-muted/5 px-4 py-1 border-b mx-4">
              <div className="flex items-center justify-center gap-2">              
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleCreateFolder}
                  className="h-8 w-8 p-0"
                  title="Create Folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUploadFile}
                  className="h-8 w-8 p-0"
                  title="Upload Files"
                >
                  <Upload className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSearchPanel(!showSearchPanel)}
                  className={`h-8 w-8 p-0 ${showSearchPanel ? 'bg-accent' : ''}`}
                  title="Search Files"
                >
                  <Search className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="h-8 w-8 p-0"
                  title="Refresh Files"
                  disabled={isLoading}
                >
                  <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              {selectedFolder && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Creating in: {selectedFolder}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Search Panel - Only show for Files tab */}
        {activeTab === 'files' && showSearchPanel && (
          <div className="w-full border-b bg-background px-4 py-2">
            <div className="relative">
              <Input
                placeholder="Search files by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm h-8"
              />
            </div>
          </div>
        )}

        {/* Files Tab */}
        <TabsContent value="files" className="flex-1 overflow-hidden m-0">
          <div className="h-full overflow-y-auto">
            <div className="p-4">
              <FileTree 
                onFileSelect={(file) => {
                  if (file.type === 'folder') {
                    setSelectedFolder(selectedFolder === file.name ? null : file.name)
                  } else {
                    const ext = file.name.split('.').pop()?.toLowerCase() || ''
                    const textLike = ['txt','csv','rtf','md','json','ts','js','yml','yaml']
                    if (textLike.includes(ext)) {
                      // Open as editor tab
                      import('@/stores/tab-store').then(({ useTabStore }) => {
                        useTabStore.getState().openEditorTab({ path: file.path, title: file.name })
                      })
                    }
                  }
                }}
                onFolderToggle={(folder) => {
                  console.log('Folder toggled:', folder)
                }}
                onFilesDownload={(files) => {
                  // Keep download logging for non-text files only
                }}
                searchTerm={searchTerm}
              />
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <HistoryPane className="h-full" />
        </TabsContent>
      </Tabs>

      {/* Storage Info */}
      <div className="p-4 border-t bg-muted/5">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Storage</span>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usedStorage.toFixed(1)} GB used</span>
            <span>{storageLimit} GB total</span>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                storagePercentage > 90 ? 'bg-red-500' : 
                storagePercentage > 75 ? 'bg-yellow-500' : 
                'bg-blue-500'
              }`}
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>
          
          <div className="text-xs text-muted-foreground">
            {(storageLimit - usedStorage).toFixed(1)} GB available
          </div>
        </div>
      </div>

      {/* Create Folder Dialog */}
      <CreateFolderDialog 
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        currentFolder={currentFolder}
      />
    </div>
  )
} 