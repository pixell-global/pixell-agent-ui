'use client'
import { useSupabase } from './use-supabase'
import { useTaskStore } from '@/stores/task-store'
import { useEffect } from 'react'
import type { Task } from '@/stores/task-store'

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
        const tasks: Task[] = (data || []).map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          progress: row.progress,
          agentId: row.agent_id,
          userId: row.user_id,
          parentTaskId: row.parent_task_id,
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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask: Task = {
              id: payload.new.id,
              name: payload.new.name,
              description: payload.new.description,
              status: payload.new.status,
              progress: payload.new.progress,
              agentId: payload.new.agent_id,
              userId: payload.new.user_id,
              parentTaskId: payload.new.parent_task_id,
              metadata: payload.new.metadata || {},
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
            }
            addTask(newTask)
          } else if (payload.eventType === 'UPDATE') {
            const updates: Partial<Task> = {
              name: payload.new.name,
              description: payload.new.description,
              status: payload.new.status,
              progress: payload.new.progress,
              agentId: payload.new.agent_id,
              parentTaskId: payload.new.parent_task_id,
              metadata: payload.new.metadata || {},
              updatedAt: payload.new.updated_at,
            }
            updateTask(payload.new.id, updates)
          } else if (payload.eventType === 'DELETE') {
            removeTask(payload.old.id)
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