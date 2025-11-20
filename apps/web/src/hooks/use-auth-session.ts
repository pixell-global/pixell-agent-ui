'use client'

import { useEffect, useCallback } from 'react'
import { useUserStore } from '@/stores/user-store'

export function useAuthSession() {
  const { setUser, setLoading, clearUser } = useUserStore()

  const checkSession = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          // Convert Firebase user format to Supabase-like format for compatibility
          const user = {
            id: data.user.id,
            email: data.user.email,
            user_metadata: {
              full_name: data.user.displayName,
              name: data.user.displayName,
            },
            created_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
          }
          setUser(user as any)
        } else {
          // No user returned - session may be expired
          clearUser()
        }
      } else {
        // API returned error - likely session expired
        clearUser()
      }
    } catch (error) {
      console.error('Session check failed:', error)
      clearUser()
    } finally {
      setLoading(false)
    }
  }, [setUser, setLoading, clearUser])

  // Check session on mount and set up periodic checks
  useEffect(() => {
    checkSession()

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [checkSession])

  // Listen for focus events to check session when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkSession)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', checkSession)
    }
  }, [checkSession])

  return { checkSession }
}