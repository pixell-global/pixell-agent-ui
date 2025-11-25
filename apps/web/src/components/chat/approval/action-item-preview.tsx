'use client'

/**
 * Action Item Preview
 *
 * Displays a preview of an individual action item within a pending action.
 * Supports viewing, editing, and skipping items.
 */

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  X,
  Edit2,
  SkipForward,
  MessageSquare,
  Heart,
  UserPlus,
  UserMinus,
  Share2,
  Send,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import type { ActionItemPreviewProps, ActionType } from './types'

// Action type icons and labels
const ACTION_CONFIG: Record<ActionType, { icon: typeof MessageSquare; label: string; color: string }> = {
  post: { icon: FileText, label: 'Post', color: 'bg-blue-100 text-blue-800' },
  comment: { icon: MessageSquare, label: 'Comment', color: 'bg-green-100 text-green-800' },
  reply: { icon: MessageSquare, label: 'Reply', color: 'bg-teal-100 text-teal-800' },
  like: { icon: Heart, label: 'Like', color: 'bg-red-100 text-red-800' },
  follow: { icon: UserPlus, label: 'Follow', color: 'bg-purple-100 text-purple-800' },
  unfollow: { icon: UserMinus, label: 'Unfollow', color: 'bg-gray-100 text-gray-800' },
  repost: { icon: Share2, label: 'Repost', color: 'bg-orange-100 text-orange-800' },
  message: { icon: Send, label: 'Message', color: 'bg-indigo-100 text-indigo-800' },
}

// Status badge styles
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  edited: 'bg-blue-100 text-blue-800',
  skipped: 'bg-gray-100 text-gray-800',
  executed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function ActionItemPreview({
  item,
  onEdit,
  onSkip,
  onApprove,
  onReject,
  editable = true,
  showActions = true,
}: ActionItemPreviewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(item.editedContent || item.originalContent || '')
  const [isProcessing, setIsProcessing] = useState(false)

  const actionConfig = ACTION_CONFIG[item.actionType]
  const ActionIcon = actionConfig.icon

  const handleSaveEdit = async () => {
    if (!onEdit) return
    setIsProcessing(true)
    try {
      await onEdit(editedContent)
      setIsEditing(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditedContent(item.editedContent || item.originalContent || '')
    setIsEditing(false)
  }

  const handleSkip = async () => {
    if (!onSkip) return
    setIsProcessing(true)
    try {
      await onSkip()
    } finally {
      setIsProcessing(false)
    }
  }

  const displayContent = item.editedContent || item.originalContent
  const hasContent = displayContent && displayContent.trim().length > 0
  const isContentAction = ['post', 'comment', 'reply', 'message'].includes(item.actionType)
  const canEdit = editable && isContentAction && item.status === 'pending'
  const isPending = item.status === 'pending'

  return (
    <Card className={`${item.status === 'skipped' ? 'opacity-50' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded ${actionConfig.color}`}>
                <ActionIcon className="h-4 w-4" />
              </div>
              <span className="font-medium text-sm">{actionConfig.label}</span>
              {item.status !== 'pending' && (
                <Badge className={STATUS_STYLES[item.status]} variant="secondary">
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            {showActions && isPending && (
              <div className="flex items-center gap-1">
                {canEdit && !isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                {onSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    disabled={isProcessing}
                    title="Skip this item"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SkipForward className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Target Info */}
          {(item.previewTitle || item.targetUrl) && (
            <div className="bg-gray-50 rounded-md p-3">
              {item.previewImageUrl && (
                <img
                  src={item.previewImageUrl}
                  alt=""
                  className="w-full h-32 object-cover rounded mb-2"
                />
              )}
              {item.previewTitle && (
                <p className="text-sm font-medium text-gray-900">{item.previewTitle}</p>
              )}
              {item.previewDescription && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {item.previewDescription}
                </p>
              )}
              {item.targetUrl && (
                <a
                  href={item.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View target
                </a>
              )}
            </div>
          )}

          {/* Content Preview/Edit */}
          {isContentAction && (
            <div>
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder="Enter content..."
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isProcessing || !editedContent.trim()}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : hasContent ? (
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                  {item.editedContent && item.originalContent !== item.editedContent && (
                    <p className="text-xs text-gray-400 mt-2 italic">
                      (edited from original)
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-md p-3 text-gray-400 text-sm italic">
                  No content provided
                </div>
              )}
            </div>
          )}

          {/* Execution Result */}
          {item.executionResult && (
            <div
              className={`text-xs p-2 rounded ${
                item.status === 'failed'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {item.status === 'failed' ? 'Error: ' : 'Result: '}
              {item.executionResult}
            </div>
          )}

          {/* Individual Approve/Reject Buttons */}
          {showActions && isPending && (onApprove || onReject) && (
            <div className="flex justify-end gap-2 pt-2 border-t">
              {onReject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReject}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              )}
              {onApprove && (
                <Button
                  size="sm"
                  onClick={onApprove}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
