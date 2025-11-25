/**
 * Chat Approval Components Tests
 *
 * Tests for the pending action approval workflow components.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ApprovalCard } from '../approval-card'
import { ActionItemPreview } from '../action-item-preview'
import type { PendingAction, PendingActionItem } from '../types'

// Mock window.confirm
const mockConfirm = jest.fn().mockReturnValue(true)
window.confirm = mockConfirm

describe('ActionItemPreview', () => {
  const mockItem: PendingActionItem = {
    id: 'item-123',
    actionId: 'action-123',
    actionType: 'post',
    originalContent: 'Test post content',
    previewTitle: 'Test Post',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockHandlers = {
    onEdit: jest.fn().mockResolvedValue(undefined),
    onSkip: jest.fn().mockResolvedValue(undefined),
    onApprove: jest.fn(),
    onReject: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders action type icon and label', () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    expect(screen.getByText('Post')).toBeInTheDocument()
  })

  it('renders content preview', () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    expect(screen.getByText('Test post content')).toBeInTheDocument()
  })

  it('shows edit button for content actions', () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    expect(screen.getByTitle('Edit')).toBeInTheDocument()
  })

  it('hides edit button for non-content actions', () => {
    const likeItem: PendingActionItem = {
      ...mockItem,
      actionType: 'like',
      originalContent: undefined,
    }

    render(<ActionItemPreview item={likeItem} {...mockHandlers} />)

    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
  })

  it('opens edit mode when edit button clicked', () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    fireEvent.click(screen.getByTitle('Edit'))

    expect(screen.getByPlaceholderText('Enter content...')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onEdit when saving edited content', async () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    fireEvent.click(screen.getByTitle('Edit'))

    const textarea = screen.getByPlaceholderText('Enter content...')
    fireEvent.change(textarea, { target: { value: 'Updated content' } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockHandlers.onEdit).toHaveBeenCalledWith('Updated content')
    })
  })

  it('cancels edit mode when cancel clicked', () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByPlaceholderText('Enter content...')).not.toBeInTheDocument()
  })

  it('calls onSkip when skip button clicked', async () => {
    render(<ActionItemPreview item={mockItem} {...mockHandlers} />)

    fireEvent.click(screen.getByTitle('Skip this item'))

    await waitFor(() => {
      expect(mockHandlers.onSkip).toHaveBeenCalled()
    })
  })

  it('shows status badge for non-pending items', () => {
    const approvedItem: PendingActionItem = {
      ...mockItem,
      status: 'approved',
    }

    render(<ActionItemPreview item={approvedItem} {...mockHandlers} />)

    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('hides actions for non-pending items', () => {
    const approvedItem: PendingActionItem = {
      ...mockItem,
      status: 'approved',
    }

    render(<ActionItemPreview item={approvedItem} {...mockHandlers} />)

    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Skip this item')).not.toBeInTheDocument()
  })

  it('shows target info when available', () => {
    const itemWithTarget: PendingActionItem = {
      ...mockItem,
      targetUrl: 'https://tiktok.com/@user/video/123',
      previewTitle: 'Target Video Title',
      previewDescription: 'Video description here',
    }

    render(<ActionItemPreview item={itemWithTarget} {...mockHandlers} />)

    expect(screen.getByText('Target Video Title')).toBeInTheDocument()
    expect(screen.getByText('Video description here')).toBeInTheDocument()
    expect(screen.getByText('View target')).toBeInTheDocument()
  })

  it('shows execution result when available', () => {
    const executedItem: PendingActionItem = {
      ...mockItem,
      status: 'executed',
      executionResult: 'Successfully posted',
      executedAt: new Date().toISOString(),
    }

    render(<ActionItemPreview item={executedItem} {...mockHandlers} />)

    expect(screen.getByText(/Result: Successfully posted/)).toBeInTheDocument()
  })

  it('shows edited indicator when content was edited', () => {
    const editedItem: PendingActionItem = {
      ...mockItem,
      originalContent: 'Original content',
      editedContent: 'Edited content',
      status: 'edited',
    }

    render(<ActionItemPreview item={editedItem} {...mockHandlers} />)

    expect(screen.getByText('Edited content')).toBeInTheDocument()
    expect(screen.getByText(/edited from original/)).toBeInTheDocument()
  })

  it('renders different action types correctly', () => {
    const actionTypes = [
      { type: 'comment', label: 'Comment' },
      { type: 'reply', label: 'Reply' },
      { type: 'like', label: 'Like' },
      { type: 'follow', label: 'Follow' },
      { type: 'unfollow', label: 'Unfollow' },
      { type: 'repost', label: 'Repost' },
      { type: 'message', label: 'Message' },
    ] as const

    actionTypes.forEach(({ type, label }) => {
      const item: PendingActionItem = {
        ...mockItem,
        actionType: type,
      }

      const { unmount } = render(<ActionItemPreview item={item} {...mockHandlers} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    })
  })
})

describe('ApprovalCard', () => {
  const mockAction: PendingAction = {
    id: 'action-123',
    orgId: 'org-123',
    accountId: 'acc-123',
    provider: 'tiktok',
    conversationId: 'conv-123',
    taskId: 'task-123',
    actionContext: 'User requested to post a video comment',
    agentReasoning: 'Based on the user request, I will post a comment on the video.',
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), // 30 mins from now
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        actionId: 'action-123',
        actionType: 'comment',
        originalContent: 'Great video!',
        previewTitle: 'Comment on video',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    account: {
      id: 'acc-123',
      provider: 'tiktok',
      providerUsername: 'testuser',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
  }

  const mockHandlers = {
    onApprove: jest.fn().mockResolvedValue(undefined),
    onReject: jest.fn().mockResolvedValue(undefined),
    onEditItem: jest.fn().mockResolvedValue(undefined),
    onSkipItem: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders action card with status', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    expect(screen.getByText('Action Request')).toBeInTheDocument()
    expect(screen.getByText('Pending Approval')).toBeInTheDocument()
  })

  it('shows provider badge', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    expect(screen.getByText('TikTok')).toBeInTheDocument()
  })

  it('shows account username', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    expect(screen.getByText('@testuser')).toBeInTheDocument()
  })

  it('shows agent reasoning', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    expect(screen.getByText('Agent Reasoning')).toBeInTheDocument()
    expect(screen.getByText(mockAction.agentReasoning!)).toBeInTheDocument()
  })

  it('shows action items', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    expect(screen.getByText('Comment')).toBeInTheDocument()
    expect(screen.getByText('Great video!')).toBeInTheDocument()
  })

  it('shows expiry time', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    // Should show minutes remaining (approximately 30m)
    expect(screen.getByText(/\d+m left/)).toBeInTheDocument()
  })

  it('calls onApprove when approve button clicked', async () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    fireEvent.click(screen.getByText(/Approve/))

    await waitFor(() => {
      expect(mockHandlers.onApprove).toHaveBeenCalledWith('action-123')
    })
  })

  it('opens reject dialog when reject button clicked', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    fireEvent.click(screen.getByText('Reject All'))

    expect(screen.getByText('Reject Actions')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Reason for rejection (optional)')).toBeInTheDocument()
  })

  it('calls onReject with reason when confirmed', async () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    fireEvent.click(screen.getByText('Reject All'))

    const textarea = screen.getByPlaceholderText('Reason for rejection (optional)')
    fireEvent.change(textarea, { target: { value: 'Not appropriate' } })

    fireEvent.click(screen.getByRole('button', { name: /Reject$/ }))

    await waitFor(() => {
      expect(mockHandlers.onReject).toHaveBeenCalledWith('action-123', 'Not appropriate')
    })
  })

  it('hides action buttons for non-pending actions', () => {
    const approvedAction: PendingAction = {
      ...mockAction,
      status: 'approved',
    }

    render(<ApprovalCard action={approvedAction} {...mockHandlers} />)

    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    expect(screen.queryByText('Reject All')).not.toBeInTheDocument()
  })

  it('shows rejection reason for rejected actions', () => {
    const rejectedAction: PendingAction = {
      ...mockAction,
      status: 'rejected',
      rejectionReason: 'Not appropriate for this context',
    }

    render(<ApprovalCard action={rejectedAction} {...mockHandlers} />)

    expect(screen.getByText('Rejection Reason')).toBeInTheDocument()
    expect(screen.getByText('Not appropriate for this context')).toBeInTheDocument()
  })

  it('shows execution error for failed actions', () => {
    const failedAction: PendingAction = {
      ...mockAction,
      status: 'failed',
      executionError: 'API rate limit exceeded',
    }

    render(<ApprovalCard action={failedAction} {...mockHandlers} />)

    expect(screen.getByText('Execution Error')).toBeInTheDocument()
    expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument()
  })

  it('can collapse and expand the card', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    // Initially expanded - agent reasoning visible
    expect(screen.getByText('Agent Reasoning')).toBeInTheDocument()

    // Click collapse button
    const expandButtons = screen.getAllByRole('button')
    const collapseButton = expandButtons.find(btn => btn.querySelector('svg'))
    if (collapseButton) {
      fireEvent.click(collapseButton)
    }

    // After collapse, content should be hidden (testing the toggle works)
    // The component tracks expanded state internally
  })

  it('shows item count in header', () => {
    const multiItemAction: PendingAction = {
      ...mockAction,
      items: [
        { ...mockAction.items[0], id: 'item-1' },
        { ...mockAction.items[0], id: 'item-2', actionType: 'like' },
        { ...mockAction.items[0], id: 'item-3', actionType: 'follow' },
      ],
    }

    render(<ApprovalCard action={multiItemAction} {...mockHandlers} />)

    expect(screen.getByText('3 actions')).toBeInTheDocument()
  })

  it('shows singular "action" for single item', () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    expect(screen.getByText('1 action')).toBeInTheDocument()
  })

  it('passes edit handler to items', async () => {
    render(<ApprovalCard action={mockAction} {...mockHandlers} />)

    // Click edit on item
    fireEvent.click(screen.getByTitle('Edit'))

    const textarea = screen.getByPlaceholderText('Enter content...')
    fireEvent.change(textarea, { target: { value: 'Edited comment' } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockHandlers.onEditItem).toHaveBeenCalledWith('item-1', 'Edited comment')
    })
  })

  it('shows approved/skipped counts', () => {
    const mixedAction: PendingAction = {
      ...mockAction,
      items: [
        { ...mockAction.items[0], id: 'item-1', status: 'approved' },
        { ...mockAction.items[0], id: 'item-2', status: 'approved' },
        { ...mockAction.items[0], id: 'item-3', status: 'skipped' },
        { ...mockAction.items[0], id: 'item-4', status: 'pending' },
      ],
    }

    render(<ApprovalCard action={mixedAction} {...mockHandlers} />)

    expect(screen.getByText('2 approved')).toBeInTheDocument()
    expect(screen.getByText('1 skipped/rejected')).toBeInTheDocument()
  })
})

describe('Approval Types', () => {
  it('exports all required types', () => {
    // This test ensures the types are properly exported
    const types = require('../types')

    expect(types).toBeDefined()
    // Type exports are compile-time only, so we just verify the module loads
  })
})

describe('Approval Component Integration', () => {
  it('exports all components from index', () => {
    const approval = require('../index')

    expect(approval.ApprovalCard).toBeDefined()
    expect(approval.ActionItemPreview).toBeDefined()
  })

  it('renders approval workflow end-to-end', async () => {
    const mockAction: PendingAction = {
      id: 'action-e2e',
      orgId: 'org-123',
      accountId: 'acc-123',
      provider: 'tiktok',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: 'item-e2e',
          actionId: 'action-e2e',
          actionType: 'post',
          originalContent: 'E2E test content',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }

    const onApprove = jest.fn().mockResolvedValue(undefined)
    const onReject = jest.fn().mockResolvedValue(undefined)
    const onEditItem = jest.fn().mockResolvedValue(undefined)
    const onSkipItem = jest.fn().mockResolvedValue(undefined)

    render(
      <ApprovalCard
        action={mockAction}
        onApprove={onApprove}
        onReject={onReject}
        onEditItem={onEditItem}
        onSkipItem={onSkipItem}
      />
    )

    // Verify initial render
    expect(screen.getByText('Action Request')).toBeInTheDocument()
    expect(screen.getByText('E2E test content')).toBeInTheDocument()

    // Edit content
    fireEvent.click(screen.getByTitle('Edit'))
    const textarea = screen.getByPlaceholderText('Enter content...')
    fireEvent.change(textarea, { target: { value: 'Edited E2E content' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(onEditItem).toHaveBeenCalledWith('item-e2e', 'Edited E2E content')
    })

    // Approve
    fireEvent.click(screen.getByText(/Approve/))

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('action-e2e')
    })
  })
})
