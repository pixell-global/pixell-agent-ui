'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useWorkspaceStore, type Activity, type ActivityFilters, type ActivityCounts } from '@/stores/workspace-store'
import { getMockActivitiesFiltered, MOCK_ACTIVITY_COUNTS } from '@/lib/mock-data'

// Enable mock data when API is unavailable
const USE_MOCK_DATA = true

interface FetchActivitiesParams {
  cursor?: string | null
  reset?: boolean
}

interface UseActivitiesReturn {
  activities: Activity[]
  loading: boolean
  hasMore: boolean
  cursor: string | null
  filters: ActivityFilters
  counts: ActivityCounts | null
  fetchActivities: (params?: FetchActivitiesParams) => Promise<void>
  fetchMore: () => Promise<void>
  fetchCounts: () => Promise<void>
  setFilters: (filters: Partial<ActivityFilters>) => void
  resetFilters: () => void
  pauseActivity: (id: string) => Promise<void>
  resumeActivity: (id: string) => Promise<void>
  cancelActivity: (id: string) => Promise<void>
  retryActivity: (id: string) => Promise<void>
  archiveActivity: (id: string) => Promise<void>
  unarchiveActivity: (id: string) => Promise<void>
}

export function useActivities(): UseActivitiesReturn {
  const {
    activities,
    activitiesLoading: loading,
    activitiesCursor: cursor,
    activitiesHasMore: hasMore,
    activityFilters: filters,
    activityCounts: counts,
    setActivities,
    appendActivities,
    updateActivity,
    setActivityFilters,
    resetActivityFilters,
    setActivityCounts,
    setActivitiesLoading,
    setActivitiesCursor,
    setActivitiesHasMore,
  } = useWorkspaceStore()

  const abortControllerRef = useRef<AbortController | null>(null)

  // Build query string from filters
  const buildQueryString = useCallback((filters: ActivityFilters, cursor?: string | null) => {
    const params = new URLSearchParams()

    if (cursor) {
      params.set('cursor', cursor)
    }

    filters.status.forEach(s => params.append('status', s))
    filters.type.forEach(t => params.append('type', t))
    filters.agent.forEach(a => params.append('agent', a))

    if (filters.search) {
      params.set('search', filters.search)
    }

    if (filters.archived) {
      params.set('archived', 'true')
    }

    return params.toString()
  }, [])

  // Fetch activities
  const fetchActivities = useCallback(async ({ cursor: cursorParam, reset = false }: FetchActivitiesParams = {}) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setActivitiesLoading(true)

    try {
      // Use mock data for demonstration
      if (USE_MOCK_DATA) {
        // Simulate network delay for realism
        await new Promise(resolve => setTimeout(resolve, 300))

        const mockResult = getMockActivitiesFiltered(
          {
            status: filters.status,
            type: filters.type,
            agent: filters.agent,
            search: filters.search,
            archived: filters.archived,
          },
          reset ? undefined : (cursorParam ?? undefined),
          20
        )

        if (reset) {
          setActivities(mockResult.activities)
        } else if (cursorParam) {
          appendActivities(mockResult.activities)
        } else {
          setActivities(mockResult.activities)
        }

        setActivitiesCursor(mockResult.cursor)
        setActivitiesHasMore(mockResult.hasMore)
        setActivitiesLoading(false)
        return
      }

      const queryString = buildQueryString(filters, reset ? null : cursorParam)
      const response = await fetch(`/api/activities?${queryString}`, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to fetch activities')
      }

      const data = await response.json()

      if (reset) {
        setActivities(data.activities)
      } else if (cursorParam) {
        appendActivities(data.activities)
      } else {
        setActivities(data.activities)
      }

      setActivitiesCursor(data.cursor)
      setActivitiesHasMore(data.hasMore)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('[useActivities] Error fetching activities:', error)
    } finally {
      setActivitiesLoading(false)
    }
  }, [filters, buildQueryString, setActivities, appendActivities, setActivitiesLoading, setActivitiesCursor, setActivitiesHasMore])

  // Fetch more (pagination)
  const fetchMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) return
    await fetchActivities({ cursor })
  }, [hasMore, loading, cursor, fetchActivities])

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    try {
      // Use mock data for demonstration
      if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 100))
        setActivityCounts(MOCK_ACTIVITY_COUNTS)
        return
      }

      const response = await fetch('/api/activities/counts')
      if (!response.ok) {
        throw new Error('Failed to fetch activity counts')
      }

      const data = await response.json()
      setActivityCounts(data)
    } catch (error) {
      console.error('[useActivities] Error fetching counts:', error)
    }
  }, [setActivityCounts])

  // Set filters and refetch
  const setFilters = useCallback((newFilters: Partial<ActivityFilters>) => {
    setActivityFilters(newFilters)
  }, [setActivityFilters])

  // Reset filters
  const resetFilters = useCallback(() => {
    resetActivityFilters()
  }, [resetActivityFilters])

  // Activity actions
  const performAction = useCallback(async (id: string, action: string) => {
    try {
      const response = await fetch(`/api/activities/${id}/${action}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${action} activity`)
      }

      const data = await response.json()
      updateActivity(data.activity)
      return data.activity
    } catch (error) {
      console.error(`[useActivities] Error ${action} activity:`, error)
      throw error
    }
  }, [updateActivity])

  const pauseActivity = useCallback((id: string) => performAction(id, 'pause'), [performAction])
  const resumeActivity = useCallback((id: string) => performAction(id, 'resume'), [performAction])
  const cancelActivity = useCallback((id: string) => performAction(id, 'cancel'), [performAction])
  const retryActivity = useCallback((id: string) => performAction(id, 'retry'), [performAction])
  const archiveActivity = useCallback((id: string) => performAction(id, 'archive'), [performAction])

  const unarchiveActivity = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/activities/${id}/archive`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to unarchive activity')
      }

      const data = await response.json()
      updateActivity(data.activity)
      return data.activity
    } catch (error) {
      console.error('[useActivities] Error unarchiving activity:', error)
      throw error
    }
  }, [updateActivity])

  // Refetch when filters change
  useEffect(() => {
    fetchActivities({ reset: true })
    fetchCounts()
  }, [filters.status.join(','), filters.type.join(','), filters.agent.join(','), filters.search, filters.archived])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    activities,
    loading,
    hasMore,
    cursor,
    filters,
    counts,
    fetchActivities,
    fetchMore,
    fetchCounts,
    setFilters,
    resetFilters,
    pauseActivity,
    resumeActivity,
    cancelActivity,
    retryActivity,
    archiveActivity,
    unarchiveActivity,
  }
}
