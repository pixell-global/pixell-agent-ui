/**
 * OAuth Provider Types
 *
 * Defines the interface for OAuth providers and their data structures.
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'tiktok' | 'instagram' | 'google' | 'reddit'

/**
 * OAuth token data returned from provider
 */
export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes?: string[]
}

/**
 * User information from OAuth provider
 */
export interface OAuthUserInfo {
  providerAccountId: string
  username?: string
  displayName?: string
  avatarUrl?: string
}

/**
 * Combined callback data from OAuth flow
 */
export interface OAuthCallbackData {
  tokens: OAuthTokens
  userInfo: OAuthUserInfo
}

/**
 * Provider configuration interface
 */
export interface OAuthProviderConfig {
  /** Provider identifier */
  provider: OAuthProvider

  /** Display name for UI */
  displayName: string

  /** Provider icon/logo URL or icon name */
  icon: string

  /** OAuth client ID */
  clientId: string

  /** Scopes to request during authorization */
  defaultScopes: string[]

  /**
   * Generate authorization URL for OAuth flow
   * @param state - CSRF protection state token
   * @param scopes - Optional scopes to override default
   */
  getAuthUrl: (state: string, scopes?: string[]) => string

  /**
   * Process OAuth callback data and extract tokens/user info
   * @param data - Raw callback data from provider
   */
  handleCallback: (data: unknown) => Promise<OAuthCallbackData>

  /**
   * Refresh expired access token
   * @param refreshToken - Token used to get new access token
   */
  refreshTokens?: (refreshToken: string) => Promise<OAuthTokens>

  /**
   * Validate if an access token is still valid
   * @param accessToken - Token to validate
   */
  validateToken: (accessToken: string) => Promise<boolean>

  /**
   * Check if provider uses popup-based OAuth (like TikAPI)
   */
  usesPopup: boolean
}

/**
 * Result of provider validation/health check
 */
export interface ProviderStatus {
  provider: OAuthProvider
  configured: boolean
  error?: string
}

/**
 * External account display data (public-safe, no tokens)
 */
export interface ExternalAccountPublic {
  id: string
  provider: OAuthProvider
  providerAccountId: string
  providerUsername: string | null
  displayName: string | null
  avatarUrl: string | null
  isDefault: boolean
  autoApprove: boolean
  isActive: boolean
  lastUsedAt: Date | null
  lastError: string | null
  lastErrorAt: Date | null
  createdAt: Date
}
