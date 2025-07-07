import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)!

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Database types for better TypeScript support
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'admin' | 'developer' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'developer' | 'viewer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'developer' | 'viewer'
          created_at?: string
          updated_at?: string
        }
      }
      agents: {
        Row: {
          id: string
          name: string
          description: string | null
          type: 'creator' | 'keyword' | 'analytics' | 'custom'
          status: 'idle' | 'running' | 'paused' | 'error'
          capabilities: Record<string, any>
          config: Record<string, any>
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          type: 'creator' | 'keyword' | 'analytics' | 'custom'
          status?: 'idle' | 'running' | 'paused' | 'error'
          capabilities?: Record<string, any>
          config?: Record<string, any>
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          type?: 'creator' | 'keyword' | 'analytics' | 'custom'
          status?: 'idle' | 'running' | 'paused' | 'error'
          capabilities?: Record<string, any>
          config?: Record<string, any>
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          name: string
          description: string | null
          status: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused'
          progress: number
          agent_id: string | null
          user_id: string
          parent_task_id: string | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused'
          progress?: number
          agent_id?: string | null
          user_id: string
          parent_task_id?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused'
          progress?: number
          agent_id?: string | null
          user_id?: string
          parent_task_id?: string | null
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          content: string
          role: 'user' | 'assistant' | 'system'
          task_id: string | null
          user_id: string
          metadata: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          role: 'user' | 'assistant' | 'system'
          task_id?: string | null
          user_id: string
          metadata?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          role?: 'user' | 'assistant' | 'system'
          task_id?: string | null
          user_id?: string
          metadata?: Record<string, any>
          created_at?: string
        }
      }
    }
  }
} 