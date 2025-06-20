'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export function useSupabase() {
  const [client] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [client])

  return { client, user, loading }
} 