import { useState, useCallback } from 'react'

export interface LoadingStates {
  [key: string]: boolean
}

export function useLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({})

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: loading
    }))
  }, [])

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false
  }, [loadingStates])

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(loading => loading)
  }, [loadingStates])

  const clearLoading = useCallback((key: string) => {
    setLoadingStates(prev => {
      const newState = { ...prev }
      delete newState[key]
      return newState
    })
  }, [])

  const clearAllLoading = useCallback(() => {
    setLoadingStates({})
  }, [])

  return {
    loadingStates,
    setLoading,
    isLoading,
    isAnyLoading,
    clearLoading,
    clearAllLoading
  }
}

// Global loading state for the entire app
export function useGlobalLoading() {
  const [globalLoading, setGlobalLoading] = useState(false)
  
  return {
    globalLoading,
    setGlobalLoading
  }
}
