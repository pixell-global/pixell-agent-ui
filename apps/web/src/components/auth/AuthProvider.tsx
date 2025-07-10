'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { User, SupabaseClient, Session } from '@supabase/supabase-js'
import { useUserStore } from '@/stores/user-store'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
  initialSession?: Session | null
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ 
  children, 
  initialSession 
}) => {
  const [supabase] = useState(() => 
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )
  
  const [session, setSession] = useState<Session | null>(initialSession || null)
  const [user, setUser] = useState<User | null>(initialSession?.user || null)
  const [loading, setLoading] = useState(!initialSession)
  
  // Use user store
  const { setUser: setStoreUser, setLoading: setStoreLoading, clearUser } = useUserStore()

  useEffect(() => {
    // Get initial session if not provided
    if (!initialSession) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user || null)
        setLoading(false)
      })
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        setSession(session)
        setUser(session?.user || null)
        setLoading(false)
        
        // Update user store
        setStoreUser(session?.user || null)
        setStoreLoading(false)

        // Handle sign in redirect
        if (event === 'SIGNED_IN' && session) {
          const redirectTo = process.env.NEXT_PUBLIC_AUTH_REDIRECT || '/dashboard'
          window.location.href = redirectTo
        }
        
        // Clear store on sign out
        if (event === 'SIGNED_OUT') {
          clearUser()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, initialSession])

  const signOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      // Redirect to sign in page
      window.location.href = '/signin'
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    loading,
    signOut,
    supabase
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}