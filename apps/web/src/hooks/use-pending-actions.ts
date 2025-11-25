/**
 * usePendingActions Hook
 *
 * Manages pending actions for approval workflow.
 * Provides fetching, approving, rejecting, and editing functionality.
 */

import { useState, useEffect, useCallback } from 'react'
import type {
  PendingAction,
  PendingActionsResponse,
  ApproveActionRequest,
  RejectActionRequest,
  EditActionItemRequest,
} from '@/components/chat/approval/types'

interface UsePendingActionsOptions {
  conversationId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UsePendingActionsReturn {
  actions: PendingAction[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  approveAction: (actionId: string, itemIds?: string[]) => Promise<void>
  rejectAction: (actionId: string, reason?: string) => Promise<void>
  editActionItem: (itemId: string, content: string) => Promise<void>
  skipActionItem: (itemId: string) => Promise<void>
  hasPendingActions: boolean
  pendingCount: number
}

export function usePendingActions(options: UsePendingActionsOptions = {}): UsePendingActionsReturn {
  const { conversationId, autoRefresh = true, refreshInterval = 30000 } = options

  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch pending actions
  const fetchActions = useCallback(async () => {
    try {
      setError(null)

      const params = new URLSearchParams()
      if (conversationId) {
        params.append('conversationId', conversationId)
      }

      const res = await fetch(`/api/oauth/actions/pending?${params}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please refresh.')
          return
        }
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch pending actions')
      }

      const data: PendingActionsResponse = await res.json()
      setActions(data.actions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending actions')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // Initial fetch
  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchActions, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchActions])

  // Approve action
  const approveAction = useCallback(async (actionId: string, itemIds?: string[]) => {
    const res = await fetch('/api/oauth/actions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ actionId, itemIds } as ApproveActionRequest),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to approve action')
    }

    // Optimistically update local state
    setActions((prev) =>
      prev.map((action) =>
        action.id === actionId
          ? {
              ...action,
              status: 'approved',
              items: action.items.map((item) =>
                !itemIds || itemIds.includes(item.id)
                  ? { ...item, status: 'approved' }
                  : item
              ),
            }
          : action
      )
    )

    // Refetch to get latest state
    await fetchActions()
  }, [fetchActions])

  // Reject action
  const rejectAction = useCallback(async (actionId: string, reason?: string) => {
    const res = await fetch('/api/oauth/actions/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ actionId, reason } as RejectActionRequest),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to reject action')
    }

    // Optimistically update local state
    setActions((prev) =>
      prev.map((action) =>
        action.id === actionId
          ? {
              ...action,
              status: 'rejected',
              rejectionReason: reason,
              items: action.items.map((item) => ({
                ...item,
                status: 'rejected',
              })),
            }
          : action
      )
    )

    // Refetch to get latest state
    await fetchActions()
  }, [fetchActions])

  // Edit action item
  const editActionItem = useCallback(async (itemId: string, content: string) => {
    const res = await fetch('/api/oauth/actions/edit-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ itemId, content } as EditActionItemRequest),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to edit action item')
    }

    // Optimistically update local state
    setActions((prev) =>
      prev.map((action) => ({
        ...action,
        items: action.items.map((item) =>
          item.id === itemId
            ? { ...item, editedContent: content, status: 'edited' }
            : item
        ),
      }))
    )
  }, [])

  // Skip action item
  const skipActionItem = useCallback(async (itemId: string) => {
    const res = await fetch('/api/oauth/actions/skip-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ itemId }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to skip action item')
    }

    // Optimistically update local state
    setActions((prev) =>
      prev.map((action) => ({
        ...action,
        items: action.items.map((item) =>
          item.id === itemId ? { ...item, status: 'skipped' } : item
        ),
      }))
    )
  }, [])

  // Computed values
  const pendingActions = actions.filter((a) => a.status === 'pending')
  const hasPendingActions = pendingActions.length > 0
  const pendingCount = pendingActions.length

  return {
    actions,
    loading,
    error,
    refetch: fetchActions,
    approveAction,
    rejectAction,
    editActionItem,
    skipActionItem,
    hasPendingActions,
    pendingCount,
  }
}
