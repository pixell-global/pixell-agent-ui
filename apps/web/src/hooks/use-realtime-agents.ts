'use client'
import { useSupabase } from './use-supabase'
import { useAgentStore } from '@/stores/agent-store'
import { useEffect } from 'react'
import type { Agent } from '@/stores/agent-store'
import type { Database } from '@/lib/supabase'

// Type for agent rows from database
type AgentRow = Database['public']['Tables']['agents']['Row']

export function useRealtimeAgents(userId: string) {
  const { client } = useSupabase()
  const { setAgents, addAgent, updateAgent, removeAgent, setLoading, setError } = useAgentStore()

  useEffect(() => {
    if (!userId || userId === 'demo-user') {
      // In demo mode, set empty state but don't fetch from database
      setAgents([])
      setLoading(false)
      return
    }

    // Initial fetch
    const fetchAgents = async () => {
      setLoading(true)
      try {
        const { data, error } = await client
          .from('agents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Transform database rows to Agent interface
        // Note: data may be null if Supabase is mocked/disabled
        const rows = data as AgentRow[] | null

        const agents: Agent[] = (rows || []).map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          type: row.type,
          status: row.status,
          capabilities: row.capabilities || {},
          config: row.config || {},
          userId: row.user_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
        
        setAgents(agents)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()

    // Subscribe to real-time changes
    const subscription = client
      .channel('agents')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `user_id=eq.${userId}`
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newData = payload.new as AgentRow & { id: string }
          const oldData = payload.old as { id: string }

          if (payload.eventType === 'INSERT') {
            const newAgent: Agent = {
              id: newData.id,
              name: newData.name,
              description: newData.description,
              type: newData.type,
              status: newData.status,
              capabilities: newData.capabilities || {},
              config: newData.config || {},
              userId: newData.user_id,
              createdAt: newData.created_at,
              updatedAt: newData.updated_at,
            }
            addAgent(newAgent)
          } else if (payload.eventType === 'UPDATE') {
            const updates: Partial<Agent> = {
              name: newData.name,
              description: newData.description,
              type: newData.type,
              status: newData.status,
              capabilities: newData.capabilities || {},
              config: newData.config || {},
              updatedAt: newData.updated_at,
            }
            updateAgent(newData.id, updates)
          } else if (payload.eventType === 'DELETE') {
            removeAgent(oldData.id)
          }
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(subscription)
    }
  }, [client, userId, setAgents, addAgent, updateAgent, removeAgent, setLoading, setError])

  return { fetchAgents: () => useAgentStore.getState().agents }
} 