'use client'
import { useUIStore } from '@/stores/ui-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function NavigatorPane() {
  const { leftPanelTab, setLeftPanelTab } = useUIStore()

  return (
    <div className="p-4 flex flex-col h-full">
      <Tabs value={leftPanelTab} onValueChange={(value) => setLeftPanelTab(value as 'files' | 'history')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="files" className="flex-1 mt-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">PROJECT FILES</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📁</span>
                <span>apps</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer ml-4">
                <span>📁</span>
                <span>web</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer ml-4">
                <span>📁</span>
                <span>orchestrator</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📁</span>
                <span>packages</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📁</span>
                <span>supabase</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📄</span>
                <span>package.json</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📄</span>
                <span>turbo.json</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📄</span>
                <span>README.md</span>
              </div>
              <div className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                <span>📄</span>
                <span>.gitignore</span>
              </div>
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
  )
} 