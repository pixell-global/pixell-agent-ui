/**
 * External Accounts Manager
 *
 * Handles CRUD operations for connected OAuth accounts.
 * All token data is encrypted/decrypted through this manager.
 */

import { getDb } from '@pixell/db-mysql'
import { externalAccounts } from '@pixell/db-mysql/schema'
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { encryptToken, decryptToken } from './encryption'
import { OAuthProvider, OAuthCallbackData, ExternalAccountPublic } from './providers/types'
import { getProvider } from './providers'

/**
 * Result of connecting an account
 */
export interface ConnectAccountResult {
  accountId: string
  isNew: boolean
}

/**
 * Manager class for external OAuth accounts
 */
export class ExternalAccountsManager {
  /**
   * Connect a new external account or update existing one
   * If account already exists (same provider + provider account ID), updates tokens
   */
  async connectAccount(
    orgId: string,
    userId: string,
    provider: OAuthProvider,
    callbackData: OAuthCallbackData
  ): Promise<ConnectAccountResult> {
    const db = await getDb()
    const { tokens, userInfo } = callbackData

    // Check if account already connected
    const existing = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.provider, provider),
          eq(externalAccounts.providerAccountId, userInfo.providerAccountId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      const existingAccount = existing[0]
      // Update tokens for existing account
      await db
        .update(externalAccounts)
        .set({
          accessTokenEncrypted: encryptToken(tokens.accessToken),
          refreshTokenEncrypted: tokens.refreshToken
            ? encryptToken(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt || null,
          scopes: tokens.scopes || null,
          isActive: true,
          lastError: null,
          lastErrorAt: null,
          providerUsername: userInfo.username || existingAccount.providerUsername,
          displayName: userInfo.displayName || existingAccount.displayName,
          avatarUrl: userInfo.avatarUrl || existingAccount.avatarUrl,
        })
        .where(eq(externalAccounts.id, existingAccount.id))

      return { accountId: existingAccount.id, isNew: false }
    }

    // Check if this is the first account for this provider - make it default
    const existingForProvider = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.provider, provider),
          eq(externalAccounts.isActive, true)
        )
      )

    const id = uuidv4()
    const isFirstAccount = existingForProvider.length === 0

    await db.insert(externalAccounts).values({
      id,
      orgId,
      userId,
      provider,
      providerAccountId: userInfo.providerAccountId,
      providerUsername: userInfo.username || null,
      displayName: userInfo.displayName || null,
      avatarUrl: userInfo.avatarUrl || null,
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      tokenExpiresAt: tokens.expiresAt || null,
      scopes: tokens.scopes || null,
      isDefault: isFirstAccount,
    })

    return { accountId: id, isNew: true }
  }

  /**
   * Get all connected accounts for an organization (without tokens)
   */
  async getAccountsForOrg(
    orgId: string,
    provider?: OAuthProvider
  ): Promise<ExternalAccountPublic[]> {
    const db = await getDb()

    const query = db
      .select()
      .from(externalAccounts)
      .where(
        provider
          ? and(
              eq(externalAccounts.orgId, orgId),
              eq(externalAccounts.isActive, true),
              eq(externalAccounts.provider, provider)
            )
          : and(
              eq(externalAccounts.orgId, orgId),
              eq(externalAccounts.isActive, true)
            )
      )
      .orderBy(desc(externalAccounts.isDefault), desc(externalAccounts.createdAt))

    const accounts = await query

    // Return without encrypted tokens
    return accounts.map((a) => ({
      id: a.id,
      provider: a.provider as OAuthProvider,
      providerAccountId: a.providerAccountId,
      providerUsername: a.providerUsername,
      displayName: a.displayName,
      avatarUrl: a.avatarUrl,
      isDefault: a.isDefault ?? false,
      autoApprove: a.autoApprove ?? false,
      isActive: a.isActive ?? true,
      lastUsedAt: a.lastUsedAt,
      lastError: a.lastError,
      lastErrorAt: a.lastErrorAt,
      createdAt: a.createdAt,
    }))
  }

  /**
   * Get a single account by ID
   */
  async getAccountById(
    accountId: string,
    orgId: string
  ): Promise<ExternalAccountPublic | null> {
    const db = await getDb()

    const accounts = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.id, accountId),
          eq(externalAccounts.orgId, orgId)
        )
      )
      .limit(1)

    if (accounts.length === 0) return null

    const a = accounts[0]
    return {
      id: a.id,
      provider: a.provider as OAuthProvider,
      providerAccountId: a.providerAccountId,
      providerUsername: a.providerUsername,
      displayName: a.displayName,
      avatarUrl: a.avatarUrl,
      isDefault: a.isDefault ?? false,
      autoApprove: a.autoApprove ?? false,
      isActive: a.isActive ?? true,
      lastUsedAt: a.lastUsedAt,
      lastError: a.lastError,
      lastErrorAt: a.lastErrorAt,
      createdAt: a.createdAt,
    }
  }

  /**
   * Get decrypted access token for an account (internal use only)
   * IMPORTANT: Never log or expose the returned token
   */
  async getDecryptedToken(
    accountId: string,
    orgId: string
  ): Promise<string | null> {
    const db = await getDb()

    const accounts = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.id, accountId),
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.isActive, true)
        )
      )
      .limit(1)

    if (accounts.length === 0) return null

    const account = accounts[0]

    // Update last used timestamp
    await db
      .update(externalAccounts)
      .set({ lastUsedAt: new Date() })
      .where(eq(externalAccounts.id, accountId))

    return decryptToken(account.accessTokenEncrypted)
  }

  /**
   * Get default account for a provider
   */
  async getDefaultAccount(
    orgId: string,
    provider: OAuthProvider
  ): Promise<ExternalAccountPublic | null> {
    const db = await getDb()

    // Try to find default account
    const defaultAccounts = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.provider, provider),
          eq(externalAccounts.isActive, true),
          eq(externalAccounts.isDefault, true)
        )
      )
      .limit(1)

    if (defaultAccounts.length > 0) {
      const a = defaultAccounts[0]
      return {
        id: a.id,
        provider: a.provider as OAuthProvider,
        providerAccountId: a.providerAccountId,
        providerUsername: a.providerUsername,
        displayName: a.displayName,
        avatarUrl: a.avatarUrl,
        isDefault: true,
        autoApprove: a.autoApprove ?? false,
        isActive: a.isActive ?? true,
        lastUsedAt: a.lastUsedAt,
        lastError: a.lastError,
        lastErrorAt: a.lastErrorAt,
        createdAt: a.createdAt,
      }
    }

    // Fallback to any active account
    const anyAccounts = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.provider, provider),
          eq(externalAccounts.isActive, true)
        )
      )
      .orderBy(desc(externalAccounts.createdAt))
      .limit(1)

    if (anyAccounts.length === 0) return null

    const a = anyAccounts[0]
    return {
      id: a.id,
      provider: a.provider as OAuthProvider,
      providerAccountId: a.providerAccountId,
      providerUsername: a.providerUsername,
      displayName: a.displayName,
      avatarUrl: a.avatarUrl,
      isDefault: false,
      autoApprove: a.autoApprove ?? false,
      isActive: a.isActive ?? true,
      lastUsedAt: a.lastUsedAt,
      lastError: a.lastError,
      lastErrorAt: a.lastErrorAt,
      createdAt: a.createdAt,
    }
  }

  /**
   * Disconnect an account (soft delete)
   */
  async disconnectAccount(accountId: string, orgId: string): Promise<void> {
    const db = await getDb()

    await db
      .update(externalAccounts)
      .set({ isActive: false })
      .where(
        and(
          eq(externalAccounts.id, accountId),
          eq(externalAccounts.orgId, orgId)
        )
      )
  }

  /**
   * Set an account as the default for its provider
   */
  async setDefaultAccount(accountId: string, orgId: string): Promise<void> {
    const db = await getDb()

    // Get the account to find its provider
    const accounts = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.id, accountId),
          eq(externalAccounts.orgId, orgId)
        )
      )
      .limit(1)

    if (accounts.length === 0) {
      throw new Error('Account not found')
    }

    const account = accounts[0]

    // Remove default from all accounts of this provider
    await db
      .update(externalAccounts)
      .set({ isDefault: false })
      .where(
        and(
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.provider, account.provider)
        )
      )

    // Set new default
    await db
      .update(externalAccounts)
      .set({ isDefault: true })
      .where(eq(externalAccounts.id, accountId))
  }

  /**
   * Update auto-approve setting
   */
  async updateAutoApprove(
    accountId: string,
    orgId: string,
    autoApprove: boolean
  ): Promise<void> {
    const db = await getDb()

    await db
      .update(externalAccounts)
      .set({ autoApprove })
      .where(
        and(
          eq(externalAccounts.id, accountId),
          eq(externalAccounts.orgId, orgId)
        )
      )
  }

  /**
   * Mark account as having an error (e.g., token expired)
   */
  async markTokenError(accountId: string, error: string): Promise<void> {
    const db = await getDb()

    await db
      .update(externalAccounts)
      .set({
        lastError: error,
        lastErrorAt: new Date(),
      })
      .where(eq(externalAccounts.id, accountId))
  }

  /**
   * Clear error state for an account
   */
  async clearTokenError(accountId: string): Promise<void> {
    const db = await getDb()

    await db
      .update(externalAccounts)
      .set({
        lastError: null,
        lastErrorAt: null,
      })
      .where(eq(externalAccounts.id, accountId))
  }

  /**
   * Validate and check token status
   * Returns true if token is valid, false otherwise
   */
  async validateToken(accountId: string, orgId: string): Promise<boolean> {
    const db = await getDb()

    const accounts = await db
      .select()
      .from(externalAccounts)
      .where(
        and(
          eq(externalAccounts.id, accountId),
          eq(externalAccounts.orgId, orgId),
          eq(externalAccounts.isActive, true)
        )
      )
      .limit(1)

    if (accounts.length === 0) return false

    const account = accounts[0]
    const provider = getProvider(account.provider as OAuthProvider)
    const token = decryptToken(account.accessTokenEncrypted)

    const isValid = await provider.validateToken(token)

    if (!isValid) {
      await this.markTokenError(
        accountId,
        'Token validation failed - re-authorization required'
      )
    }

    return isValid
  }
}

// Export singleton instance
export const externalAccountsManager = new ExternalAccountsManager()
