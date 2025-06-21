import React from 'react'
import { FolderPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFolder: string
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  open,
  onOpenChange,
  currentFolder
}) => {
  const [folderName, setFolderName] = React.useState('')
  const [isCreating, setIsCreating] = React.useState(false)
  const refreshFileTree = useWorkspaceStore(state => state.setFileTree)

  const handleCreate = async () => {
    if (!folderName.trim()) return

    setIsCreating(true)
    try {
      const folderPath = currentFolder === '/' 
        ? `/${folderName}`
        : `${currentFolder}/${folderName}`

      const formData = new FormData()
      formData.append('action', 'create-folder')
      formData.append('path', currentFolder)
      formData.append('name', folderName)

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        // Refresh file tree
        const listResponse = await fetch('/api/files/list')
        if (listResponse.ok) {
          const data = await listResponse.json()
          refreshFileTree(data.files || [])
        }
        
        // Reset form and close
        setFolderName('')
        onOpenChange(false)
      } else {
        console.error('Failed to create folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setIsCreating(false)
    }
  }

  React.useEffect(() => {
    if (!open) {
      setFolderName('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4" />
            Create New Folder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="mt-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate()
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!folderName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Folder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}