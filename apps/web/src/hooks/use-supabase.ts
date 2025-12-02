'use client'
import { createClient, MockSupabaseClient } from '@/lib/supabase'
import { useState } from 'react'

// Mock User type since we're not using Supabase auth
export interface MockUser {
  id: string
  email: string
  user_metadata?: Record<string, unknown>
}

export function useSupabase() {
  const [client] = useState<MockSupabaseClient>(() => createClient())

  // Always return null user since Supabase auth is removed
  return {
    client,
    user: null as MockUser | null,
    loading: false
  }
}
