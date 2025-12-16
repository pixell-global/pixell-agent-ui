'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

// DISABLED: Supabase is legacy and no longer used
export function useSupabase() {
  const [client] = useState(() => {
    try {
      return createClient()
    } catch (error) {
      console.warn('[useSupabase] Supabase client creation failed:', error)
      return null
    }
  })
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false) // Set to false immediately since Supabase is disabled

  useEffect(() => {
    // Skip if client is null (Supabase disabled)
    if (!client) {
      setLoading(false)
      return
    }

    const getUser = async () => {
      try {
        const { data: { user } } = await client.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error getting user:', error)
      } finally {
        setLoading(false)
      }
    }
    
    getUser()

    try {
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    } catch (error) {
      console.warn('[useSupabase] Failed to set up auth state listener:', error)
      setLoading(false)
    }
  }, [client])

  return { client, user, loading }
} 