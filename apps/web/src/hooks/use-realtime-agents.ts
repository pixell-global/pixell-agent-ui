'use client'
import { useSupabase } from './use-supabase'
import { useAgentStore } from '@/stores/agent-store'
import { useEffect } from 'react'
import type { Agent } from '@/stores/agent-store'
import type { Database } from '@/lib/supabase'

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
        const agents: Agent[] = (data || []).map((row: AgentRow) => ({
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
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newAgent: Agent = {
              id: payload.new.id,
              name: payload.new.name,
              description: payload.new.description,
              type: payload.new.type,
              status: payload.new.status,
              capabilities: payload.new.capabilities || {},
              config: payload.new.config || {},
              userId: payload.new.user_id,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
            }
            addAgent(newAgent)
          } else if (payload.eventType === 'UPDATE') {
            const updates: Partial<Agent> = {
              name: payload.new.name,
              description: payload.new.description,
              type: payload.new.type,
              status: payload.new.status,
              capabilities: payload.new.capabilities || {},
              config: payload.new.config || {},
              updatedAt: payload.new.updated_at,
            }
            updateAgent(payload.new.id, updates)
          } else if (payload.eventType === 'DELETE') {
            removeAgent(payload.old.id)
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