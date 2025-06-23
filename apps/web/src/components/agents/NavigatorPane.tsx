'use client'
import { useUIStore } from '@/stores/ui-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  FolderPlus, 
  Upload, 
  FileText,
  HardDrive
} from 'lucide-react'
import { useState } from 'react'

interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  parent?: string
  children?: FileItem[]
}

export function NavigatorPane() {
  const { leftPanelTab, setLeftPanelTab } = useUIStore()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [usedStorage, setUsedStorage] = useState(5.2) // Mock: 5.2GB used
  // Storage limit is configurable via CLI: `pixell config-storage --limit <number>`
  const [storageLimit] = useState(() => {
    // In a real implementation, this would read from CLI config or environment
    // For now, we'll use environment variable or default to 50GB
    const envLimit = process.env.NEXT_PUBLIC_STORAGE_LIMIT
    return envLimit ? parseInt(envLimit) : 50
  })
  
  // Mock file structure
  const [files, setFiles] = useState<FileItem[]>([
    { id: '1', name: 'apps', type: 'folder' },
    { id: '2', name: 'packages', type: 'folder' },
    { id: '3', name: 'supabase', type: 'folder' },
    { id: '4', name: 'package.json', type: 'file' },
    { id: '5', name: 'turbo.json', type: 'file' },
    { id: '6', name: 'README.md', type: 'file' },
    { id: '7', name: '.gitignore', type: 'file' }
  ])

  const handleCreateFile = () => {
    const fileName = prompt('Enter file name:')
    if (fileName) {
      const newFile: FileItem = {
        id: Date.now().toString(),
        name: fileName,
        type: 'file',
        parent: selectedFolder || undefined
      }
      setFiles(prev => [...prev, newFile])
    }
  }

  const handleCreateFolder = () => {
    const folderName = prompt('Enter folder name:')
    if (folderName) {
      const newFolder: FileItem = {
        id: Date.now().toString(),
        name: folderName,
        type: 'folder',
        parent: selectedFolder || undefined
      }
      setFiles(prev => [...prev, newFolder])
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
          const newFile: FileItem = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            type: 'file',
            parent: selectedFolder || undefined
          }
          setFiles(prev => [...prev, newFile])
          
          // Mock storage usage update
          setUsedStorage(prev => prev + (file.size / (1024 * 1024 * 1024)))
        })
      }
    }
    input.click()
  }

  const handleUploadFolder = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files) {
        const folderStructure = new Map<string, FileItem>()
        
        Array.from(target.files).forEach(file => {
          const pathParts = file.webkitRelativePath.split('/')
          pathParts.forEach((part, index) => {
            if (index === pathParts.length - 1) {
              // It's a file
              const newFile: FileItem = {
                id: Date.now().toString() + Math.random(),
                name: part,
                type: 'file',
                parent: pathParts.slice(0, -1).join('/') || selectedFolder || undefined
              }
              setFiles(prev => [...prev, newFile])
            } else {
              // It's a folder
              const folderPath = pathParts.slice(0, index + 1).join('/')
              if (!folderStructure.has(folderPath)) {
                const newFolder: FileItem = {
                  id: Date.now().toString() + Math.random(),
                  name: part,
                  type: 'folder',
                  parent: index > 0 ? pathParts.slice(0, index).join('/') : selectedFolder || undefined
                }
                folderStructure.set(folderPath, newFolder)
                setFiles(prev => [...prev, newFolder])
              }
            }
          })
          
          // Mock storage usage update
          setUsedStorage(prev => prev + (file.size / (1024 * 1024 * 1024)))
        })
      }
    }
    input.click()
  }

  const storagePercentage = (usedStorage / storageLimit) * 100

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-3 border-b bg-muted/10">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateFile}
            className="h-8 w-8 p-0"
            title="Create File"
          >
            <FileText className="h-4 w-4" />
          </Button>
          
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
            onClick={handleUploadFolder}
            className="h-8 w-8 p-0"
            title="Upload Folder"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {selectedFolder && (
          <div className="mt-2 text-xs text-muted-foreground">
            Creating in: {selectedFolder}
          </div>
        )}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 p-4 overflow-hidden">
      <Tabs value={leftPanelTab} onValueChange={(value) => setLeftPanelTab(value as 'files' | 'history')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="files" className="flex-1 mt-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">PROJECT FILES</h3>
            <div className="space-y-1 text-sm">
                {files.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer"
                    onClick={() => {
                      if (item.type === 'folder') {
                        setSelectedFolder(selectedFolder === item.name ? null : item.name)
                      }
                    }}
                  >
                    <span>{item.type === 'folder' ? '📁' : '📄'}</span>
                    <span className={selectedFolder === item.name ? 'font-semibold' : ''}>
                      {item.name}
                    </span>
              </div>
                ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="flex-1 mt-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold mb-4">Chat History</h2>
            <div className="text-center text-muted-foreground py-8">
              <p>Chat history will appear here</p>
              <p className="text-sm mt-2">Previous conversations and sessions</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>

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
    </div>
  )
} 