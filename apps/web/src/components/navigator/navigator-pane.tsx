import React from 'react'
import { Plus, FolderPlus, RefreshCw, Search } from 'lucide-react'
import { useWorkspaceStore, selectFileTree, selectCurrentFolder, selectIsLoading } from '@/stores/workspace-store'
import { FileTree } from './file-tree'
import { CreateFileDialog } from './create-file-dialog'
import { CreateFolderDialog } from './create-folder-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const NavigatorPane: React.FC = () => {
  const fileTree = useWorkspaceStore(selectFileTree)
  const currentFolder = useWorkspaceStore(selectCurrentFolder)
  const isLoading = useWorkspaceStore(selectIsLoading)
  const setSearchQuery = useWorkspaceStore(state => state.setSearchQuery)
  const refreshFileTree = useWorkspaceStore(state => state.setFileTree)
  
  const [showCreateFile, setShowCreateFile] = React.useState(false)
  const [showCreateFolder, setShowCreateFolder] = React.useState(false)
  const [searchInput, setSearchInput] = React.useState('')

  const handleRefresh = async () => {
    try {
      const response = await fetch('/api/files/list')
      if (response.ok) {
        const data = await response.json()
        refreshFileTree(data.files || [])
      }
    } catch (error) {
      console.error('Failed to refresh file tree:', error)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    setSearchQuery(value)
  }

  React.useEffect(() => {
    // Load initial file tree
    handleRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateFile(true)}
          className="flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          File
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateFolder(true)}
          className="flex items-center gap-1"
        >
          <FolderPlus className="w-3 h-3" />
          Folder
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading files...
          </div>
        ) : fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
            <FolderPlus className="w-8 h-8 mb-2" />
            <p className="text-sm">No files found</p>
            <p className="text-xs">Create your first file or folder to get started</p>
          </div>
        ) : (
          <FileTree />
        )}
      </div>

      {/* Dialogs */}
      <CreateFileDialog
        open={showCreateFile}
        onOpenChange={setShowCreateFile}
        currentFolder={currentFolder}
      />
      
      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        currentFolder={currentFolder}
      />
    </div>
  )
} 