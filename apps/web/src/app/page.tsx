'use client'
import { useSupabase } from '@/hooks/use-supabase'
import { useRealtimeAgents } from '@/hooks/use-realtime-agents'
import { useRealtimeTasks } from '@/hooks/use-realtime-tasks'
import { AgentWorkspaceLayout } from '@/components/layout/AgentWorkspaceLayout'

export default function HomePage() {
  const { user, loading } = useSupabase()
  
  // Initialize real-time subscriptions (demo mode with placeholder user ID)
  useRealtimeAgents(user?.id || 'demo-user')
  useRealtimeTasks(user?.id || 'demo-user')

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading Pixell Agent Framework...</p>
        </div>
      </div>
    )
  }

  // For Phase 1 demo, show workspace without authentication
  // if (!user) {
  //   return (
  //     <div className="h-screen flex items-center justify-center">
  //       <div className="text-center max-w-md">
  //         <h1 className="text-2xl font-bold mb-4">Welcome to Pixell Agent Framework</h1>
  //         <p className="text-muted-foreground mb-6">
  //           Please log in to start building and orchestrating AI agent workflows.
  //         </p>
  //         <div className="text-sm text-muted-foreground">
  //           <p>Authentication will be implemented in the next phase.</p>
  //           <p className="mt-2">For now, the demo runs without authentication.</p>
  //         </div>
  //       </div>
  //     </div>
  //   )
  // }

  return <AgentWorkspaceLayout />
}
