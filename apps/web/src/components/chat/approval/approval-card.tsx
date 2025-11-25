'use client'

/**
 * Approval Card
 *
 * Main component for displaying a pending action that requires user approval.
 * Shows agent reasoning, account info, and individual action items.
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Bot,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { ActionItemPreview } from './action-item-preview'
import type { ApprovalCardProps, PendingActionStatus } from './types'

// Provider display info
const PROVIDER_INFO: Record<string, { name: string; color: string }> = {
  tiktok: { name: 'TikTok', color: 'bg-black text-white' },
  instagram: { name: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' },
  google: { name: 'Google', color: 'bg-blue-500 text-white' },
  reddit: { name: 'Reddit', color: 'bg-orange-500 text-white' },
}

// Status display config
const STATUS_CONFIG: Record<PendingActionStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800', icon: Clock },
  executing: { label: 'Executing', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
}

export function ApprovalCard({
  action,
  onApprove,
  onReject,
  onEditItem,
  onSkipItem,
  isProcessing = false,
}: ApprovalCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const provider = PROVIDER_INFO[action.provider] || { name: action.provider, color: 'bg-gray-500 text-white' }
  const statusConfig = STATUS_CONFIG[action.status]
  const StatusIcon = statusConfig.icon

  const pendingItems = action.items.filter((item) => item.status === 'pending')
  const approvedItems = action.items.filter((item) => item.status === 'approved' || item.status === 'executed')
  const rejectedItems = action.items.filter((item) => item.status === 'rejected' || item.status === 'skipped')

  const isPending = action.status === 'pending'
  const isExecuting = action.status === 'executing'

  // Calculate time until expiration
  const expiresAt = action.expiresAt ? new Date(action.expiresAt) : null
  const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt.getTime() - Date.now()) : null
  const minutesUntilExpiry = timeUntilExpiry ? Math.ceil(timeUntilExpiry / 60000) : null

  const handleApproveAll = async () => {
    setIsSubmitting(true)
    try {
      await onApprove(action.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    setIsSubmitting(true)
    try {
      await onReject(action.id, rejectReason || undefined)
      setShowRejectDialog(false)
      setRejectReason('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditItem = async (itemId: string, newContent: string) => {
    await onEditItem(itemId, newContent)
  }

  const handleSkipItem = async (itemId: string) => {
    await onSkipItem(itemId)
  }

  return (
    <>
      <Card className={`my-4 ${!isPending ? 'opacity-75' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            {/* Header Left: Status & Account */}
            <div className="flex items-center gap-3">
              {/* Account Avatar */}
              {action.account && (
                <Avatar className="h-10 w-10">
                  {action.account.avatarUrl && (
                    <AvatarImage src={action.account.avatarUrl} alt={action.account.displayName || ''} />
                  )}
                  <AvatarFallback className={provider.color}>
                    {(action.account.providerUsername || action.account.displayName || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}

              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Action Request</span>
                  <Badge className={statusConfig.color} variant="secondary">
                    {isExecuting ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <StatusIcon className="h-3 w-3 mr-1" />
                    )}
                    {statusConfig.label}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {provider.name}
                  </Badge>
                  {action.account?.providerUsername && (
                    <span className="text-xs">@{action.account.providerUsername}</span>
                  )}
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">
                    {action.items.length} action{action.items.length !== 1 ? 's' : ''}
                  </span>
                </CardDescription>
              </div>
            </div>

            {/* Header Right: Expiry & Expand */}
            <div className="flex items-center gap-2">
              {isPending && minutesUntilExpiry !== null && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    minutesUntilExpiry < 5 ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {minutesUntilExpiry}m left
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Agent Reasoning */}
            {action.agentReasoning && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-blue-800 mb-1">Agent Reasoning</p>
                    <p className="text-sm text-blue-900">{action.agentReasoning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Context */}
            {action.actionContext && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Context:</span> {action.actionContext}
              </div>
            )}

            {/* Rejection Reason (if rejected) */}
            {action.status === 'rejected' && action.rejectionReason && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-800 mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-900">{action.rejectionReason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Error (if failed) */}
            {action.status === 'failed' && action.executionError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-800 mb-1">Execution Error</p>
                    <p className="text-sm text-red-900">{action.executionError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            {(approvedItems.length > 0 || rejectedItems.length > 0) && (
              <div className="flex gap-4 text-sm">
                {approvedItems.length > 0 && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {approvedItems.length} approved
                  </span>
                )}
                {rejectedItems.length > 0 && (
                  <span className="text-gray-500 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {rejectedItems.length} skipped/rejected
                  </span>
                )}
              </div>
            )}

            {/* Action Items */}
            <div className="space-y-3">
              {action.items.map((item) => (
                <ActionItemPreview
                  key={item.id}
                  item={item}
                  onEdit={isPending ? (content) => handleEditItem(item.id, content) : undefined}
                  onSkip={isPending ? () => handleSkipItem(item.id) : undefined}
                  editable={isPending}
                  showActions={isPending}
                />
              ))}
            </div>

            {/* Action Buttons */}
            {isPending && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isProcessing || isSubmitting}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject All
                </Button>
                <Button
                  onClick={handleApproveAll}
                  disabled={isProcessing || isSubmitting || pendingItems.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve {pendingItems.length > 0 ? `(${pendingItems.length})` : 'All'}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Actions</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject all pending actions? You can optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectReason('')
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
