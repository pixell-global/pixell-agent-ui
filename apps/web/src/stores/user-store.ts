'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User } from '@supabase/supabase-js'
import type { Role } from '@/lib/acl'

export interface UserProfile {
  id: string
  email: string
  role: Role
  displayName: string
  avatarUrl?: string
  metadata?: Record<string, any>
  createdAt: string
  lastSignIn: string
}

interface UserState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  
  // Actions
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>()(
  devtools(
    immer((set) => ({
      // Initial state
      user: null,
      profile: null,
      loading: true,
      error: null,
      
      // Actions
      setUser: (user) =>
        set((state) => {
          state.user = user
          
          // Extract profile from user metadata if available
          if (user) {
            const profile: UserProfile = {
              id: user.id,
              email: user.email || '',
              role: (user.user_metadata?.role || 'developer') as Role,
              displayName: user.user_metadata?.full_name || 
                          user.user_metadata?.name || 
                          user.email?.split('@')[0] || 
                          'User',
              avatarUrl: user.user_metadata?.avatar_url,
              metadata: user.user_metadata,
              createdAt: user.created_at,
              lastSignIn: user.last_sign_in_at || user.created_at,
            }
            state.profile = profile
          } else {
            state.profile = null
          }
        }),
        
      setProfile: (profile) =>
        set((state) => {
          state.profile = profile
        }),
        
      updateProfile: (updates) =>
        set((state) => {
          if (state.profile) {
            Object.assign(state.profile, updates)
          }
        }),
        
      setLoading: (loading) =>
        set((state) => {
          state.loading = loading
        }),
        
      setError: (error) =>
        set((state) => {
          state.error = error
        }),
        
      clearUser: () =>
        set((state) => {
          state.user = null
          state.profile = null
          state.loading = false
          state.error = null
        }),
    }))
  )
)

// Selectors
export const selectUser = (state: UserState) => state.user
export const selectProfile = (state: UserState) => state.profile
export const selectUserRole = (state: UserState) => state.profile?.role || 'viewer'
export const selectIsLoading = (state: UserState) => state.loading
export const selectError = (state: UserState) => state.error

// Helper hooks
export const useCurrentUser = () => {
  const user = useUserStore(selectUser)
  const profile = useUserStore(selectProfile)
  const loading = useUserStore(selectIsLoading)
  const error = useUserStore(selectError)
  
  return {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    role: profile?.role || 'viewer',
  }
}

export const useUserRole = () => {
  return useUserStore(selectUserRole)
}