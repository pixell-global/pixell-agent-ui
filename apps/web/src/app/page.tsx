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
          <div className="mt-2 text-sm text-green-600 font-medium">
            🎉 Phase 2: Multi-Agent Orchestration
          </div>
        </div>
      </div>
    )
  }

  // Phase 2 demo runs with multi-agent orchestration
  return <AgentWorkspaceLayout />
}
