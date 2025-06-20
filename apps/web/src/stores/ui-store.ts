'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface UIStore {
  // Panel visibility
  leftPanelVisible: boolean
  rightPanelVisible: boolean
  leftPanelTab: 'files' | 'history'
  
  // Chat state
  chatInputFocused: boolean
  isStreaming: boolean
  
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
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set) => ({
    // Initial state
    leftPanelVisible: true,
    rightPanelVisible: true,
    leftPanelTab: 'files',
    chatInputFocused: false,
    isStreaming: false,
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
  }))
) 