'use client'

import React from 'react'
import { NavigatorPane } from '@/components/navigator/navigator-pane'
import { useWorkspaceStore } from '@/stores/workspace-store'

export default function NavigatorDemo() {
  const fileTree = useWorkspaceStore(state => state.fileTree)
  const selectedFiles = useWorkspaceStore(state => state.selectedFiles)
  const isConnected = useWorkspaceStore(state => state.isConnected)
  const isLoading = useWorkspaceStore(state => state.isLoading)

  return (
    <div className="h-screen flex">
      {/* Navigator Pane */}
      <div className="w-80 border-r bg-background">
        <div className="border-b p-3 bg-muted/30">
          <h2 className="font-semibold text-sm">Navigator Pane Demo</h2>
          <p className="text-xs text-muted-foreground">
            File management with Zustand store
          </p>
        </div>
        <NavigatorPane />
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Navigator Pane Implementation</h1>
            <p className="text-muted-foreground">
              This demonstrates Phase 2 of the Navigator Pane from the implementation steps,
              featuring filesystem CLI integration and Zustand state management.
            </p>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Connection Status</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Loading State</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <span className="text-sm">{isLoading ? 'Loading...' : 'Ready'}</span>
              </div>
            </div>
          </div>

          {/* File Tree Stats */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">File Tree Statistics</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total Items</div>
                <div className="font-medium">{fileTree.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Selected Files</div>
                <div className="font-medium">{selectedFiles.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">File Types</div>
                <div className="font-medium">
                  {Array.from(new Set(fileTree.map(f => f.type))).join(', ')}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Selected Files ({selectedFiles.length})</h3>
              <div className="space-y-2">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">({file.path})</span>
                    <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                      {file.contextMention}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Implemented Features</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✅ File tree navigation with expand/collapse</li>
              <li>✅ Create file button with templates</li>
              <li>✅ Create folder button</li>
              <li>✅ Refresh button with loading state</li>
              <li>✅ Search functionality</li>
              <li>✅ Drag & drop file upload</li>
              <li>✅ File context integration (@file mentions)</li>
              <li>✅ Zustand state management</li>
              <li>✅ Filesystem CLI integration</li>
              <li>✅ Upload progress tracking</li>
            </ul>
          </div>

          {/* API Endpoints */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">API Endpoints</h3>
            <div className="space-y-2 text-sm">
              <div>
                <code className="bg-muted px-2 py-1 rounded">GET /api/files/list</code>
                <span className="ml-2 text-muted-foreground">List files and folders</span>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">POST /api/files/create</code>
                <span className="ml-2 text-muted-foreground">Create files and folders</span>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">GET /api/files/content</code>
                <span className="ml-2 text-muted-foreground">Read file content</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 