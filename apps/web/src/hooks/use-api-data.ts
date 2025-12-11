import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/utils'

export interface ApiDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useApiData<T>(
  url: string,
  options?: {
    initialData?: T
    dependencies?: any[]
    enabled?: boolean
  }
): ApiDataState<T> {
  const [data, setData] = useState<T | null>(options?.initialData || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (options?.enabled === false) return

    try {
      setLoading(true)
      setError(null)
      
      const response = await apiFetch(url)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [url, options?.enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData, ...(options?.dependencies || [])])

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}

// Specialized hooks for common patterns
export function useBrands() {
  return useApiData<Array<{ id: string; name: string; orgId: string; primaryTeamId?: string; metadata?: any }>>('/api/brands')
}

export function useTeams() {
  return useApiData<Array<{ id: string; name: string; orgId: string; description?: string }>>('/api/teams')
}

export function useOrganizations() {
  return useApiData<Array<{ id: string; name: string; role: string }>>('/api/orgs')
}
