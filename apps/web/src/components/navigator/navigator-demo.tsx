import React from 'react'
import { NavigatorPane } from './navigator-pane'
import { FileAutocomplete } from './file-autocomplete'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const NavigatorDemo: React.FC = () => {
  const [showAutocomplete, setShowAutocomplete] = React.useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = React.useState('')

  return (
    <div className="h-screen flex bg-background">
      {/* Navigator Pane */}
      <div className="w-80 h-full">
        <NavigatorPane />
      </div>
      
      {/* Demo Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Phase 2: Navigator Pane Implementation</CardTitle>
              <CardDescription>
                File management with drag & drop uploads, file context integration, and conversation history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">✅ Implemented Features</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• File tree navigation with expand/collapse</li>
                    <li>• Drag & drop file uploads with progress</li>
                    <li>• File context integration (@filename mentions)</li>
                    <li>• File search and autocomplete</li>
                    <li>• Folder creation with validation</li>
                    <li>• Conversation history with search</li>
                    <li>• Tabbed interface (Files/History)</li>
                    <li>• Zustand state management integration</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">🎯 Key Benefits</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Fast file context for AI conversations</li>
                    <li>• Visual progress tracking for uploads</li>
                    <li>• Efficient file organization</li>
                    <li>• Quick access to conversation history</li>
                    <li>• Keyboard navigation support</li>
                    <li>• Responsive design with proper spacing</li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">🔗 Integration Points</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  The Navigator Pane integrates seamlessly with the chat workspace for file context sharing:
                </p>
                
                {/* File Autocomplete Demo */}
                <div className="relative">
                  <div className="p-3 border rounded-md bg-muted/30">
                    <p className="text-sm mb-2">Try file autocomplete (type to search):</p>
                    <input
                      type="text"
                      placeholder="Type filename to see autocomplete..."
                      value={autocompleteQuery}
                      onChange={(e) => {
                        setAutocompleteQuery(e.target.value)
                        setShowAutocomplete(e.target.value.length > 0)
                      }}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                    
                    {showAutocomplete && (
                      <FileAutocomplete
                        query={autocompleteQuery}
                        isVisible={showAutocomplete}
                        onSelect={(file) => {
                          console.log('Selected file:', file)
                          setShowAutocomplete(false)
                          setAutocompleteQuery('')
                        }}
                        onClose={() => setShowAutocomplete(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Implementation</CardTitle>
              <CardDescription>
                Phase 2 architecture follows the implementation steps with proper Zustand integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">State Management</h4>
                  <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                    <pre>{`// Zustand store integration
const fileTree = useWorkspaceStore(selectFileTree)
const addFileReference = useWorkspaceStore(
  state => state.addFileReference
)

// File upload with progress tracking
const addUploadProgress = useWorkspaceStore(
  state => state.addUploadProgress
)`}</pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">File Context Flow</h4>
                  <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                    <pre>{`// File selection → Context integration
const selectFile = async (file: FileNode) => {
  const content = await readFileContent(file.path)
  
  addFileReference({
    id: file.id,
    name: file.name,
    path: file.path,
    content,
    contextMention: '@' + file.name
  })
}`}</pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 