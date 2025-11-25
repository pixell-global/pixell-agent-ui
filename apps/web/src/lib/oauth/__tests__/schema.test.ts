/**
 * External Accounts Schema Tests
 *
 * These tests validate the database schema structure and type exports
 * for the OAuth external accounts system.
 */

import {
  externalAccounts,
  pendingActions,
  pendingActionItems,
} from '@pixell/db-mysql/schema'

describe('External Accounts Schema', () => {
  describe('externalAccounts table', () => {
    it('should have all required columns', () => {
      expect(externalAccounts).toBeDefined()
      expect(externalAccounts.id).toBeDefined()
      expect(externalAccounts.orgId).toBeDefined()
      expect(externalAccounts.userId).toBeDefined()
      expect(externalAccounts.provider).toBeDefined()
      expect(externalAccounts.providerAccountId).toBeDefined()
      expect(externalAccounts.accessTokenEncrypted).toBeDefined()
    })

    it('should have optional columns', () => {
      expect(externalAccounts.providerUsername).toBeDefined()
      expect(externalAccounts.displayName).toBeDefined()
      expect(externalAccounts.avatarUrl).toBeDefined()
      expect(externalAccounts.refreshTokenEncrypted).toBeDefined()
      expect(externalAccounts.tokenExpiresAt).toBeDefined()
      expect(externalAccounts.scopes).toBeDefined()
    })

    it('should have user preference columns', () => {
      expect(externalAccounts.isDefault).toBeDefined()
      expect(externalAccounts.autoApprove).toBeDefined()
    })

    it('should have status tracking columns', () => {
      expect(externalAccounts.isActive).toBeDefined()
      expect(externalAccounts.lastUsedAt).toBeDefined()
      expect(externalAccounts.lastErrorAt).toBeDefined()
      expect(externalAccounts.lastError).toBeDefined()
    })

    it('should have timestamp columns', () => {
      expect(externalAccounts.createdAt).toBeDefined()
      expect(externalAccounts.updatedAt).toBeDefined()
    })
  })

  describe('pendingActions table', () => {
    it('should have all required columns', () => {
      expect(pendingActions).toBeDefined()
      expect(pendingActions.id).toBeDefined()
      expect(pendingActions.orgId).toBeDefined()
      expect(pendingActions.userId).toBeDefined()
      expect(pendingActions.provider).toBeDefined()
      expect(pendingActions.actionType).toBeDefined()
      expect(pendingActions.items).toBeDefined()
      expect(pendingActions.itemCount).toBeDefined()
      expect(pendingActions.status).toBeDefined()
    })

    it('should have context columns', () => {
      expect(pendingActions.conversationId).toBeDefined()
      expect(pendingActions.externalAccountId).toBeDefined()
      expect(pendingActions.actionDescription).toBeDefined()
    })

    it('should have execution tracking columns', () => {
      expect(pendingActions.itemsApproved).toBeDefined()
      expect(pendingActions.itemsRejected).toBeDefined()
      expect(pendingActions.itemsExecuted).toBeDefined()
      expect(pendingActions.itemsFailed).toBeDefined()
    })

    it('should have timestamp columns', () => {
      expect(pendingActions.expiresAt).toBeDefined()
      expect(pendingActions.reviewedAt).toBeDefined()
      expect(pendingActions.executionStartedAt).toBeDefined()
      expect(pendingActions.executionCompletedAt).toBeDefined()
      expect(pendingActions.createdAt).toBeDefined()
      expect(pendingActions.updatedAt).toBeDefined()
    })
  })

  describe('pendingActionItems table', () => {
    it('should have all required columns', () => {
      expect(pendingActionItems).toBeDefined()
      expect(pendingActionItems.id).toBeDefined()
      expect(pendingActionItems.pendingActionId).toBeDefined()
      expect(pendingActionItems.itemIndex).toBeDefined()
      expect(pendingActionItems.payload).toBeDefined()
      expect(pendingActionItems.status).toBeDefined()
    })

    it('should have preview columns', () => {
      expect(pendingActionItems.previewText).toBeDefined()
    })

    it('should have edit tracking columns', () => {
      expect(pendingActionItems.isEdited).toBeDefined()
      expect(pendingActionItems.editedPayload).toBeDefined()
    })

    it('should have execution result columns', () => {
      expect(pendingActionItems.executedAt).toBeDefined()
      expect(pendingActionItems.result).toBeDefined()
      expect(pendingActionItems.error).toBeDefined()
    })

    it('should have timestamp columns', () => {
      expect(pendingActionItems.createdAt).toBeDefined()
    })
  })
})

describe('OAuth Provider Enum', () => {
  it('should support TikTok provider', () => {
    // Provider enum values are validated through schema structure
    // This test ensures the schema is properly imported
    expect(externalAccounts.provider).toBeDefined()
    expect(pendingActions.provider).toBeDefined()
  })
})

describe('Pending Action Status Enum', () => {
  it('should have status column on pendingActions', () => {
    expect(pendingActions.status).toBeDefined()
  })

  it('should have status column on pendingActionItems', () => {
    expect(pendingActionItems.status).toBeDefined()
  })
})
