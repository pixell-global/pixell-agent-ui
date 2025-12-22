'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface Task {
  id: string
  name: string
  description?: string | null
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused'
  progress: number
  agentId: string | null
  userId: string
  parentTaskId?: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface TaskStore {
  tasks: Task[]
  selectedTaskId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  selectTask: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Getters
  getTasksByStatus: (status: Task['status']) => Task[]
  getTasksByAgent: (agentId: string) => Task[]
  getSelectedTask: () => Task | null
  getTaskDAG: () => { nodes: Task[], edges: Array<{from: string, to: string}> }
}

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    tasks: [],
    selectedTaskId: null,
    isLoading: false,
    error: null,
    
    setTasks: (tasks) => set({ tasks }),
    
    addTask: (task) => set((state) => ({ 
      tasks: [...state.tasks, task] 
    })),
    
    updateTask: (id, updates) => set((state) => ({
      tasks: state.tasks.map(task => 
        task.id === id ? { ...task, ...updates } : task
      )
    })),
    
    removeTask: (id) => set((state) => ({
      tasks: state.tasks.filter(task => task.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId
    })),
    
    selectTask: (id) => set({ selectedTaskId: id }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    getTasksByStatus: (status) => get().tasks.filter(task => task.status === status),
    getTasksByAgent: (agentId) => get().tasks.filter(task => task.agentId === agentId),
    getSelectedTask: () => {
      const { tasks, selectedTaskId } = get()
      return tasks.find(task => task.id === selectedTaskId) || null
    },
    
    getTaskDAG: () => {
      const tasks = get().tasks
      const nodes = tasks
      const edges = tasks
        .filter(task => task.parentTaskId)
        .map(task => ({ from: task.parentTaskId!, to: task.id }))
      return { nodes, edges }
    },
  }))
) 