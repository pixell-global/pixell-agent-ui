// Supabase client stub - Supabase has been removed from this project
// This file provides mock implementations to prevent import errors

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockQueryBuilder = {
  select: (...args: unknown[]) => MockQueryBuilder
  insert: (...args: unknown[]) => MockQueryBuilder
  update: (...args: unknown[]) => MockQueryBuilder
  delete: (...args: unknown[]) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  neq: (...args: unknown[]) => MockQueryBuilder
  gt: (...args: unknown[]) => MockQueryBuilder
  gte: (...args: unknown[]) => MockQueryBuilder
  lt: (...args: unknown[]) => MockQueryBuilder
  lte: (...args: unknown[]) => MockQueryBuilder
  like: (...args: unknown[]) => MockQueryBuilder
  ilike: (...args: unknown[]) => MockQueryBuilder
  is: (...args: unknown[]) => MockQueryBuilder
  in: (...args: unknown[]) => MockQueryBuilder
  contains: (...args: unknown[]) => MockQueryBuilder
  containedBy: (...args: unknown[]) => MockQueryBuilder
  order: (...args: unknown[]) => MockQueryBuilder
  limit: (...args: unknown[]) => MockQueryBuilder
  range: (...args: unknown[]) => MockQueryBuilder
  single: (...args: unknown[]) => MockQueryBuilder
  maybeSingle: (...args: unknown[]) => MockQueryBuilder
  then: <T>(resolve: (value: { data: null; error: null }) => T) => Promise<T>
}

const createMockQueryBuilder = (): MockQueryBuilder => {
  const builder: MockQueryBuilder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: () => builder,
    maybeSingle: () => builder,
    then: (resolve) => Promise.resolve(resolve({ data: null, error: null })),
  }
  return builder
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChannel = {
  on: (...args: unknown[]) => MockChannel
  subscribe: () => MockChannel
  unsubscribe: () => void
}

const createMockChannel = (): MockChannel => {
  const channel: MockChannel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => {},
  }
  return channel
}

export interface MockSupabaseClient {
  from: (table: string) => MockQueryBuilder
  channel: (name: string) => MockChannel
  removeChannel: (channel: MockChannel) => void
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>
    getSession: () => Promise<{ data: { session: null }; error: null }>
    signInWithPassword: () => Promise<{ data: { user: null; session: null }; error: { message: string } }>
    signUp: () => Promise<{ data: { user: null; session: null }; error: { message: string } }>
    signOut: () => Promise<{ error: null }>
    onAuthStateChange: (callback: (event: string, session: null) => void) => { data: { subscription: { unsubscribe: () => void } } }
  }
  storage: {
    from: (bucket: string) => {
      upload: () => Promise<{ data: null; error: { message: string } }>
      download: () => Promise<{ data: null; error: { message: string } }>
      getPublicUrl: () => { data: { publicUrl: string } }
      remove: () => Promise<{ data: null; error: null }>
      list: () => Promise<{ data: []; error: null }>
    }
  }
}

export function createClient(): MockSupabaseClient {
  console.warn('[Supabase] Supabase has been removed. Using mock client.')

  return {
    from: () => createMockQueryBuilder(),
    channel: () => createMockChannel(),
    removeChannel: () => {},
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: 'Supabase auth has been removed' }
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: { message: 'Supabase auth has been removed' }
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: 'Supabase storage has been removed' } }),
        download: async () => ({ data: null, error: { message: 'Supabase storage has been removed' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
  }
}

// Database types for better TypeScript support (kept for compatibility)
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
          capabilities: Record<string, unknown>
          config: Record<string, unknown>
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
          capabilities?: Record<string, unknown>
          config?: Record<string, unknown>
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
          capabilities?: Record<string, unknown>
          config?: Record<string, unknown>
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
          metadata: Record<string, unknown>
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
          metadata?: Record<string, unknown>
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
          metadata?: Record<string, unknown>
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
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          role: 'user' | 'assistant' | 'system'
          task_id?: string | null
          user_id: string
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          role?: 'user' | 'assistant' | 'system'
          task_id?: string | null
          user_id?: string
          metadata?: Record<string, unknown>
          created_at?: string
        }
      }
    }
  }
}
