'use client'
import { useSupabase } from './use-supabase'
import { useTaskStore } from '@/stores/task-store'
import { useEffect } from 'react'
import type { Task } from '@/stores/task-store'

// Type for task rows from database
type TaskRow = {
  id: string
  name: string
  description?: string
  status: Task['status']
  progress: number
  agent_id: string | null
  user_id: string
  parent_task_id?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function useRealtimeTasks(userId: string) {
  const { client } = useSupabase()
  const { setTasks, addTask, updateTask, removeTask, setLoading, setError } = useTaskStore()

  useEffect(() => {
    if (!userId || userId === 'demo-user') {
      // In demo mode, set empty state but don't fetch from database
      setTasks([])
      setLoading(false)
      return
    }

    // Initial fetch
    const fetchTasks = async () => {
      setLoading(true)
      try {
        const { data, error } = await client
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Transform database rows to Task interface
        const rows = data as TaskRow[] | null
        const tasks: Task[] = (rows || []).map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          progress: row.progress,
          agentId: row.agent_id,
          userId: row.user_id,
          parentTaskId: row.parent_task_id ?? undefined,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))

        setTasks(tasks)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch tasks')
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()

    // Subscribe to real-time changes
    const subscription = client
      .channel('tasks')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newData = payload.new as TaskRow
          const oldData = payload.old as { id: string }

          if (payload.eventType === 'INSERT') {
            const newTask: Task = {
              id: newData.id,
              name: newData.name,
              description: newData.description,
              status: newData.status,
              progress: newData.progress,
              agentId: newData.agent_id,
              userId: newData.user_id,
              parentTaskId: newData.parent_task_id ?? undefined,
              metadata: newData.metadata || {},
              createdAt: newData.created_at,
              updatedAt: newData.updated_at,
            }
            addTask(newTask)
          } else if (payload.eventType === 'UPDATE') {
            const updates: Partial<Task> = {
              name: newData.name,
              description: newData.description,
              status: newData.status,
              progress: newData.progress,
              agentId: newData.agent_id,
              parentTaskId: newData.parent_task_id ?? undefined,
              metadata: newData.metadata || {},
              updatedAt: newData.updated_at,
            }
            updateTask(newData.id, updates)
          } else if (payload.eventType === 'DELETE') {
            removeTask(oldData.id)
          }
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(subscription)
    }
  }, [client, userId, setTasks, addTask, updateTask, removeTask, setLoading, setError])

  return { fetchTasks: () => useTaskStore.getState().tasks }
} 