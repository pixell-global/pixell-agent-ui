'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface Agent {
  id: string
  name: string
  description?: string | null
  type: 'creator' | 'keyword' | 'analytics' | 'custom'
  status: 'idle' | 'running' | 'paused' | 'error'
  capabilities: Record<string, any>
  config: Record<string, any>
  userId: string
  createdAt: string
  updatedAt: string
}

interface AgentStore {
  agents: Agent[]
  selectedAgentId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  removeAgent: (id: string) => void
  selectAgent: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Getters
  getAgentsByType: (type: Agent['type']) => Agent[]
  getSelectedAgent: () => Agent | null
}

export const useAgentStore = create<AgentStore>()(
  subscribeWithSelector((set, get) => ({
    agents: [],
    selectedAgentId: null,
    isLoading: false,
    error: null,
    
    setAgents: (agents) => set({ agents }),
    
    addAgent: (agent) => set((state) => ({ 
      agents: [...state.agents, agent] 
    })),
    
    updateAgent: (id, updates) => set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id ? { ...agent, ...updates } : agent
      )
    })),
    
    removeAgent: (id) => set((state) => ({
      agents: state.agents.filter(agent => agent.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId
    })),
    
    selectAgent: (id) => set({ selectedAgentId: id }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    getAgentsByType: (type) => get().agents.filter(agent => agent.type === type),
    getSelectedAgent: () => {
      const { agents, selectedAgentId } = get()
      return agents.find(agent => agent.id === selectedAgentId) || null
    },
  }))
) 