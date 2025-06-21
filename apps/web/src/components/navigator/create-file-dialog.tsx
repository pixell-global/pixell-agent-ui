import React from 'react'
import { X, File } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface CreateFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFolder: string
}

const FILE_TEMPLATES = [
  { name: 'Text File', extension: 'txt', content: '' },
  { name: 'JavaScript', extension: 'js', content: '// JavaScript file\n' },
  { name: 'TypeScript', extension: 'ts', content: '// TypeScript file\n' },
  { name: 'React Component', extension: 'jsx', content: 'import React from \'react\'\n\nconst Component = () => {\n  return (\n    <div>\n      \n    </div>\n  )\n}\n\nexport default Component\n' },
  { name: 'Markdown', extension: 'md', content: '# Title\n\nContent here...\n' },
  { name: 'JSON', extension: 'json', content: '{\n  \n}\n' },
  { name: 'CSS', extension: 'css', content: '/* CSS styles */\n' },
  { name: 'Python', extension: 'py', content: '# Python script\n' },
  { name: 'HTML', extension: 'html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>\n' },
  { name: 'YAML', extension: 'yml', content: '# YAML file\n' },
]

export const CreateFileDialog: React.FC<CreateFileDialogProps> = ({
  open,
  onOpenChange,
  currentFolder
}) => {
  const [fileName, setFileName] = React.useState('')
  const [selectedTemplate, setSelectedTemplate] = React.useState(FILE_TEMPLATES[0])
  const [isCreating, setIsCreating] = React.useState(false)
  const refreshFileTree = useWorkspaceStore(state => state.setFileTree)

  const handleCreate = async () => {
    if (!fileName.trim()) return

    setIsCreating(true)
    try {
      const filePath = currentFolder === '/' 
        ? `/${fileName}.${selectedTemplate.extension}`
        : `${currentFolder}/${fileName}.${selectedTemplate.extension}`

      const formData = new FormData()
      formData.append('action', 'write')
      formData.append('path', filePath)
      formData.append('content', selectedTemplate.content)

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
        setFileName('')
        setSelectedTemplate(FILE_TEMPLATES[0])
        onOpenChange(false)
      } else {
        console.error('Failed to create file')
      }
    } catch (error) {
      console.error('Error creating file:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleTemplateSelect = (template: typeof FILE_TEMPLATES[0]) => {
    setSelectedTemplate(template)
  }

  React.useEffect(() => {
    if (!open) {
      setFileName('')
      setSelectedTemplate(FILE_TEMPLATES[0])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="w-4 h-4" />
            Create New File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="fileName">File Name</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter file name"
                className="flex-1"
              />
              <span className="flex items-center text-sm text-muted-foreground">
                .{selectedTemplate.extension}
              </span>
            </div>
          </div>

          <div>
            <Label>Template</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {FILE_TEMPLATES.map((template) => (
                <button
                  key={template.extension}
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-2 text-left text-sm rounded border transition-colors ${
                    selectedTemplate.extension === template.extension
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-muted-foreground">.{template.extension}</div>
                </button>
              ))}
            </div>
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
              disabled={!fileName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create File'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 