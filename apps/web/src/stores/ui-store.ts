'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface Stats {
  agents: {
    total: number
    online: number
    offline: number
    byType: Record<string, number>
  }
  tasks: {
    active: number
    total: number
    recentCompletions: number
  }
  runtime: {
    provider: string
    status: string
    uptime: number
  }
}

interface UIStore {
  // Panel visibility
  leftPanelVisible: boolean
  rightPanelVisible: boolean
  leftPanelTab: 'files' | 'history'
  
  // Chat state
  chatInputFocused: boolean
  isStreaming: boolean
  
  // Orchestrator connection state
  isConnected: boolean
  lastUpdate: Date | null
  stats: Stats | null
  
  // Theme and preferences
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  
  // Actions
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelTab: (tab: 'files' | 'history') => void
  setChatInputFocused: (focused: boolean) => void
  setIsStreaming: (streaming: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setSidebarCollapsed: (collapsed: boolean) => void
  
  // Orchestrator actions
  setConnected: (connected: boolean) => void
  setStats: (stats: Stats | null) => void
  updateLastUpdate: () => void
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set) => ({
    // Initial state
    leftPanelVisible: true,
    rightPanelVisible: true,
    leftPanelTab: 'files',
    chatInputFocused: false,
    isStreaming: false,
    isConnected: false,
    lastUpdate: null,
    stats: null,
    theme: 'system',
    sidebarCollapsed: false,
    
    // Actions
    toggleLeftPanel: () => set((state) => ({ 
      leftPanelVisible: !state.leftPanelVisible 
    })),
    
    toggleRightPanel: () => set((state) => ({ 
      rightPanelVisible: !state.rightPanelVisible 
    })),
    
    setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
    setChatInputFocused: (focused) => set({ chatInputFocused: focused }),
    setIsStreaming: (streaming) => set({ isStreaming: streaming }),
    setTheme: (theme) => set({ theme }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    
    // Orchestrator actions
    setConnected: (connected) => set({ isConnected: connected }),
    setStats: (stats) => set({ stats }),
    updateLastUpdate: () => set({ lastUpdate: new Date() }),
  }))
) 