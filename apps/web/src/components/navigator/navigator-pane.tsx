import React, { useState, useEffect } from 'react'
import { Search, Folder, Plus, History, Files, RefreshCw, FileText, FolderPlus, Upload, HardDrive, X, RotateCcw, ChevronLeft, Brain } from 'lucide-react'
import { useWorkspaceStore, FileNode } from '@/stores/workspace-store'
import { FileTree } from './file-tree'
import { HistoryPane } from './history-pane'
import { MemoryPane } from './memory-pane'
import { CreateFolderDialog } from './create-folder-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

// Use real files from S3 storage (mock data disabled)
const USE_MOCK_DATA = false

interface NavigatorPaneProps {
  className?: string
}

export const NavigatorPane: React.FC<NavigatorPaneProps> = ({ className }) => {
  const toggleLeftPanelCollapsed = useUIStore(state => state.toggleLeftPanelCollapsed)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [activeTab, setActiveTab] = useState('files')
  const [isLoading, setIsLoading] = useState(true)  // Start loading immediately
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
  const updateFileNode = useWorkspaceStore(state => state.updateFileNode)
  const fileTree = useWorkspaceStore(state => state.fileTree)
  const fileTreeNeedsRefresh = useWorkspaceStore(state => state.fileTreeNeedsRefresh)
  const clearFileTreeRefreshFlag = useWorkspaceStore(state => state.clearFileTreeRefreshFlag)

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
  
  // Load real workspace files from S3 storage
  const loadWorkspaceFiles = async () => {
    setIsLoading(true)
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime()

      // Create abort controller with 10 second timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      // Load from user's S3 storage path (recursive to pre-load all folder contents)
      const response = await fetch(`/api/files/list?path=/&recursive=true&_t=${timestamp}`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

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
      // Handle specific error types for better debugging
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('File list request timed out after 10 seconds')
      } else {
        console.error('Failed to load workspace files:', error)
      }
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

  // Auto-refresh file tree when triggered via WebSocket (e.g., agent creates file)
  useEffect(() => {
    if (fileTreeNeedsRefresh) {
      console.log('🔄 Auto-refreshing file tree (triggered by WebSocket)')
      loadWorkspaceFiles()
      clearFileTreeRefreshFlag()
    }
  }, [fileTreeNeedsRefresh, clearFileTreeRefreshFlag])

  // Load folder contents on demand (lazy loading)
  const loadFolderContents = async (folder: FileNode) => {
    if (!folder.path) return

    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/files/list?path=${encodeURIComponent(folder.path)}&_t=${timestamp}`)

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.files) {
          // Update the folder's children in the store
          updateFileNode(folder.path, {
            children: data.files,
            isExpanded: true
          })
        }
      }
    } catch (error) {
      console.error('Failed to load folder contents:', error)
    }
  }

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

  const handleUploadFile = async () => {
    console.log('🚀 handleUploadFile 함수 호출됨!')
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async (e) => {
      console.log('📁 파일 선택됨!')
      const target = e.target as HTMLInputElement
      if (target.files) {
        const filesArray = Array.from(target.files)
        
        try {
          // 각 파일을 workspace-files에 업로드
          for (const file of filesArray) {
            console.log('업로드할 파일:', file.name, '크기:', file.size)
            
            const formData = new FormData()
            formData.append('file', file)
            formData.append('path', selectedFolder || '')  // 빈 문자열로 변경하여 루트에 저장
            
            console.log('FormData 전송:', {
              fileName: file.name,
              path: selectedFolder || '',
              fileSize: file.size
            })
            
            const response = await fetch('/api/files/create', {
              method: 'POST',
              body: formData
            })
            
            console.log('API 응답 상태:', response.status)
            
            if (response.ok) {
              const result = await response.json()
              console.log('API 응답 결과:', result)
              
              if (result.success) {
                console.log('파일 업로드 성공:', result.path)
                
                // Add to file tree using proper store method
                const newFile: FileNode = {
                  id: Date.now().toString() + Math.random(),
                  name: file.name,
                  type: 'file',
                  path: selectedFolder ? `${selectedFolder}/${file.name}` : file.name,
                  size: file.size,
                  lastModified: new Date().toISOString()
                }
                addFileNode(selectedFolder || '/', newFile)
              } else {
                console.error('업로드 실패:', result.error)
                alert(`파일 업로드 실패: ${result.error}`)
              }
            } else {
              const error = await response.json()
              console.error('HTTP 에러:', response.status, error)
              alert(`파일 업로드 실패 (${response.status}): ${error.error}`)
            }
          }
        } catch (error) {
          console.error('File upload failed:', error)
          alert(`파일 업로드 에러: ${error}`)
        }
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
    <div className={cn("flex flex-col h-full bg-background border-r border-white/10", className)}>
      {/* Pane header with collapse */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-white/10 bg-background">
        <span className="text-sm font-medium text-white/90">Navigator</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/10"
          onClick={toggleLeftPanelCollapsed}
          title="Collapse navigator"
          aria-label="Collapse navigator"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex justify-center mt-2 mb-2 px-2">
          <TabsList className="grid grid-cols-3 w-full bg-white/[0.02] border border-white/10">
            <TabsTrigger value="files" className="flex items-center justify-center gap-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs">
              <Files className="h-3.5 w-3.5" />
              Files
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center justify-center gap-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex items-center justify-center gap-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs">
              <Brain className="h-3.5 w-3.5" />
              Memory
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Toolbar - Only show for Files tab */}
        {activeTab === 'files' && (
          <div className="w-full py-2">
            <div className="px-4 py-1 border-b border-white/10 mx-2">
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateFolder}
                  className="h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10"
                  title="Create Folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUploadFile}
                  className="h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10"
                  title="Upload Files"
                >
                  <Upload className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSearchPanel(!showSearchPanel)}
                  className={`h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10 ${showSearchPanel ? 'bg-white/10 text-white' : ''}`}
                  title="Search Files"
                >
                  <Search className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10"
                  title="Refresh Files"
                  disabled={isLoading}
                >
                  <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {selectedFolder && (
                <div className="mt-2 text-xs text-white/50">
                  Creating in: {selectedFolder}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Search Panel - Only show for Files tab */}
        {activeTab === 'files' && showSearchPanel && (
          <div className="w-full border-b border-white/10 px-4 py-2">
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
                    const viewerTypes = ['html', 'htm']

                    if (viewerTypes.includes(ext)) {
                      // Open HTML files in editor tab (viewer tab is not implemented in TabState)
                      import('@/stores/tab-store').then(({ useTabStore }) => {
                        useTabStore.getState().openEditorTab({ path: file.path, title: file.name })
                      })
                    } else if (textLike.includes(ext)) {
                      // Open as editor tab
                      import('@/stores/tab-store').then(({ useTabStore }) => {
                        useTabStore.getState().openEditorTab({ path: file.path, title: file.name })
                      })
                    }
                  }
                }}
                onFolderToggle={(folder) => {
                  // Lazy load folder contents if not already loaded
                  if (!folder.children || folder.children.length === 0) {
                    loadFolderContents(folder)
                  }
                }}
                onFilesDownload={(files) => {
                  // Keep download logging for non-text files only
                }}
                searchTerm={searchTerm}
                isLoading={isLoading}
              />
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <HistoryPane className="h-full" />
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory" className="flex-1 overflow-hidden m-0">
          <MemoryPane className="h-full" />
        </TabsContent>
      </Tabs>

      {/* Storage Info */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="h-4 w-4 text-white/50" />
          <span className="text-sm font-medium text-white/90">Storage</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/50">
            <span>{usedStorage.toFixed(1)} GB used</span>
            <span>{storageLimit} GB total</span>
          </div>

          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                storagePercentage > 90 ? 'bg-red-500' :
                storagePercentage > 75 ? 'bg-yellow-500' :
                'bg-pixell-yellow'
              }`}
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>

          <div className="text-xs text-white/40">
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