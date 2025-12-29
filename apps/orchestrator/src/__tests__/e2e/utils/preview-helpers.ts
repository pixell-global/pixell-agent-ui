/**
 * Preview Helpers for E2E Tests
 *
 * Provides utilities for handling plan mode preview flows:
 * - Finding subreddit/content preview events
 * - Approving/rejecting previews with selected items
 * - Tracking preview state
 */

import type { SSEEvent } from './sse-helpers'
import { collectSSEEvents } from './sse-helpers'

export interface PreviewItem {
  id: string
  name: string
  description?: string
  subscribers?: number
  relevanceScore?: number
  selected?: boolean
}

export interface PreviewEvent {
  type: 'preview' | 'selection_required'
  state: 'input-required'
  sessionId: string
  planId?: string
  selectionId?: string  // Used for selection_required events
  items: PreviewItem[]
  message?: string
  step?: string
}

/**
 * Find preview event in SSE events (e.g., subreddit discovery preview)
 * Also handles selection_required and search_plan events from pixell-sdk
 */
export function findPreviewEvent(events: SSEEvent[]): PreviewEvent | null {
  for (const event of events) {
    // Check for search_plan or preview_ready event (emitted after subreddit selection)
    // The orchestrator transforms search_plan → preview_ready
    // This is the plan that needs approval before schedule_proposal is emitted
    // Note: preview_ready has planId nested inside event.data.plan.planId
    if (event.data?.type === 'search_plan' || event.data?.type === 'preview_ready') {
      // Get planId from various possible locations
      const planId = event.data.planId || event.data.plan_id || event.data.plan?.planId
      if (!planId) continue // Skip if no planId found

      // For search_plan/preview_ready, create items from subreddits/targets for approval
      const subreddits = event.data.subreddits || event.data.plan?.targets || []
      const keywords = event.data.searchKeywords || event.data.plan?.keywords || []
      const items = subreddits.map((s: string) => ({
        id: s,
        name: s,
        description: `Subreddit: r/${s}`,
        selected: true,
      }))

      return {
        type: 'preview',
        state: 'input-required',
        sessionId: event.data.sessionId || event.data.session_id,
        planId: planId,
        items: items.length > 0 ? items : [{ id: 'plan', name: 'Search Plan', description: 'Approve to continue', selected: true }],
        message: event.data.message || event.data.plan?.title,
        step: 'search_plan',
      }
    }

    // Check for selection_required event (from pixell-sdk/orchestrator)
    if (event.data?.type === 'selection_required' && event.data?.items) {
      const items = event.data.items || event.data.selection?.items || []

      return {
        type: 'selection_required',
        state: 'input-required',
        sessionId: event.data.sessionId || event.data.session_id,
        selectionId: event.data.selectionId || event.data.selection_id,
        planId: event.data.planId || event.data.plan_id,
        items: items.map((item: any) => ({
          id: item.id || item.name || item.subreddit,
          name: item.name || item.label || item.subreddit || item.id,
          description: item.description,
          subscribers: item.subscribers || item.subscriber_count,
          relevanceScore: item.relevanceScore || item.relevance_score,
          selected: item.selected ?? true,
        })),
        message: event.data.message,
        step: event.data.step,
      }
    }

    // Check for preview step with items to select (legacy format)
    if (
      event.data?.state === 'input-required' &&
      (event.data?.step === 'preview' ||
        event.data?.step === 'subreddit_preview' ||
        event.data?.type === 'preview')
    ) {
      // Extract items from various possible field names
      const items =
        event.data.items ||
        event.data.subreddits ||
        event.data.options ||
        event.data.results ||
        []

      return {
        type: 'preview',
        state: 'input-required',
        sessionId: event.data.sessionId || event.data.session_id,
        planId: event.data.planId || event.data.plan_id,
        selectionId: event.data.selectionId,
        items: items.map((item: any) => ({
          id: item.id || item.name || item.subreddit,
          name: item.name || item.label || item.subreddit || item.id,
          description: item.description,
          subscribers: item.subscribers || item.subscriber_count,
          relevanceScore: item.relevanceScore || item.relevance_score,
          selected: item.selected ?? true,
        })),
        message: event.data.message,
        step: event.data.step,
      }
    }
  }
  return null
}

/**
 * Check if events contain a preview request
 */
export function hasPreviewEvent(events: SSEEvent[]): boolean {
  return findPreviewEvent(events) !== null
}

/**
 * Build preview approval payload
 */
export function buildPreviewApproval(
  sessionId: string,
  planIdOrSelectionId: string,
  selectedIds: string[],
  approved: boolean = true,
  isSelection: boolean = false
): {
  sessionId: string
  planId?: string
  selectionId?: string
  type: 'preview_approval' | 'plan_approval' | 'selection_response'
  approved?: boolean
  selectedItems?: string[]
  selectedIds?: string[]
} {
  if (isSelection) {
    return {
      sessionId,
      selectionId: planIdOrSelectionId,
      type: 'selection_response' as const,
      selectedIds: selectedIds,
    }
  }
  return {
    sessionId,
    planId: planIdOrSelectionId,
    type: 'plan_approval',
    approved,
    selectedItems: selectedIds,
  }
}

/**
 * Send preview approval via orchestrator API
 * Returns the SSE events from the response stream
 * Handles both plan_approval (planId) and selection_response (selectionId)
 */
export async function approvePreview(
  orchestratorUrl: string,
  userId: string,
  orgId: string,
  sessionId: string,
  planIdOrSelectionId: string,
  selectedIds: string[],
  agentUrl: string,
  options: {
    timeoutMs?: number
    stopOnStates?: string[]
    isSelection?: boolean  // If true, treat as selection response
  } = {}
): Promise<SSEEvent[]> {
  const {
    timeoutMs = 120000,
    stopOnStates = ['completed', 'failed', 'input-required'],
    isSelection = false,
  } = options

  // Build request body based on whether this is a selection or plan approval
  const requestBody: Record<string, unknown> = {
    sessionId,
    agentUrl,
  }

  if (isSelection) {
    requestBody.selectionId = planIdOrSelectionId
    requestBody.selectedIds = selectedIds
  } else {
    requestBody.planId = planIdOrSelectionId
    requestBody.type = 'plan_approval'
    requestBody.approved = true
    requestBody.selectedItems = selectedIds
  }

  const response = await fetch(`${orchestratorUrl}/api/chat/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send preview approval: ${response.status} - ${error}`)
  }

  // Collect SSE events from response
  const events = await collectSSEEvents(response, {
    timeoutMs,
    stopOnStates,
  })

  return events
}

/**
 * Reject a preview (user cancels plan)
 */
export async function rejectPreview(
  orchestratorUrl: string,
  userId: string,
  orgId: string,
  sessionId: string,
  planId: string,
  agentUrl: string
): Promise<SSEEvent[]> {
  const response = await fetch(`${orchestratorUrl}/api/chat/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      sessionId,
      planId,
      type: 'plan_approval',
      approved: false,
      agentUrl,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to reject preview: ${response.status} - ${error}`)
  }

  const events = await collectSSEEvents(response, {
    timeoutMs: 30000,
    stopOnStates: ['completed', 'failed'],
  })

  return events
}

/**
 * Auto-select top N items from preview
 * Useful for testing when specific selections don't matter
 */
export function autoSelectTopItems(
  items: PreviewItem[],
  count: number = 3
): string[] {
  // Sort by relevance score if available, otherwise take first N
  const sorted = [...items].sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
  )

  return sorted.slice(0, count).map((item) => item.id)
}

/**
 * Extract all preview events from SSE stream
 */
export function extractAllPreviewEvents(events: SSEEvent[]): PreviewEvent[] {
  const previews: PreviewEvent[] = []

  for (const event of events) {
    if (
      event.data?.state === 'input-required' &&
      (event.data?.step === 'preview' ||
        event.data?.step === 'subreddit_preview' ||
        event.data?.type === 'preview')
    ) {
      const items =
        event.data.items ||
        event.data.subreddits ||
        event.data.options ||
        event.data.results ||
        []

      previews.push({
        type: 'preview',
        state: 'input-required',
        sessionId: event.data.sessionId || event.data.session_id,
        planId: event.data.planId || event.data.plan_id,
        items: items.map((item: any) => ({
          id: item.id || item.name || item.subreddit,
          name: item.name || item.label || item.subreddit || item.id,
          description: item.description,
          subscribers: item.subscribers || item.subscriber_count,
          relevanceScore: item.relevanceScore || item.relevance_score,
          selected: item.selected ?? true,
        })),
        message: event.data.message,
        step: event.data.step,
      })
    }
  }

  return previews
}
