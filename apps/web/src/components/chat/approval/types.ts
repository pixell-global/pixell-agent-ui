/**
 * Approval System Types
 *
 * Types for the pending action approval workflow in chat.
 */

import type { OAuthProvider } from '@/lib/oauth/providers/types'

/**
 * Status of a pending action
 */
export type PendingActionStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executing' | 'completed' | 'failed'

/**
 * Status of an individual action item
 */
export type PendingActionItemStatus = 'pending' | 'approved' | 'rejected' | 'edited' | 'skipped' | 'executed' | 'failed'

/**
 * Action types supported by the system
 */
export type ActionType = 'post' | 'comment' | 'reply' | 'like' | 'follow' | 'unfollow' | 'repost' | 'message'

/**
 * Individual item within a pending action batch
 */
export interface PendingActionItem {
  id: string
  actionId: string
  actionType: ActionType
  targetId?: string
  targetUrl?: string
  previewTitle?: string
  previewDescription?: string
  previewImageUrl?: string
  originalContent?: string
  editedContent?: string
  status: PendingActionItemStatus
  executionResult?: string
  executedAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * A pending action batch requiring approval
 */
export interface PendingAction {
  id: string
  orgId: string
  accountId: string
  provider: OAuthProvider
  conversationId?: string
  taskId?: string
  actionContext?: string
  agentReasoning?: string
  status: PendingActionStatus
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
  expiresAt?: string
  executedAt?: string
  executionError?: string
  createdAt: string
  updatedAt: string
  // Populated relations
  items: PendingActionItem[]
  account?: {
    id: string
    provider: OAuthProvider
    providerUsername?: string
    displayName?: string
    avatarUrl?: string
  }
}

/**
 * Props for the approval card component
 */
export interface ApprovalCardProps {
  action: PendingAction
  onApprove: (actionId: string, itemIds?: string[]) => Promise<void>
  onReject: (actionId: string, reason?: string) => Promise<void>
  onEditItem: (itemId: string, newContent: string) => Promise<void>
  onSkipItem: (itemId: string) => Promise<void>
  isProcessing?: boolean
}

/**
 * Props for individual action item preview
 */
export interface ActionItemPreviewProps {
  item: PendingActionItem
  onEdit?: (newContent: string) => void
  onSkip?: () => void
  onApprove?: () => void
  onReject?: () => void
  editable?: boolean
  showActions?: boolean
}

/**
 * API response for pending actions
 */
export interface PendingActionsResponse {
  actions: PendingAction[]
  total: number
  hasMore: boolean
}

/**
 * Request to approve action(s)
 */
export interface ApproveActionRequest {
  actionId: string
  itemIds?: string[] // If provided, only approve specific items
}

/**
 * Request to reject action
 */
export interface RejectActionRequest {
  actionId: string
  reason?: string
}

/**
 * Request to edit an action item
 */
export interface EditActionItemRequest {
  itemId: string
  content: string
}
