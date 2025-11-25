/**
 * TikTok OAuth Provider (via TikAPI)
 *
 * TikAPI uses a popup-based OAuth flow with their JavaScript SDK.
 * The callback data format is specific to TikAPI, not standard OAuth.
 *
 * Documentation: https://tikapi.io/documentation/
 */

import { OAuthProviderConfig, OAuthCallbackData, OAuthTokens } from './types'

/**
 * TikAPI callback data structure
 * This is what TikAPI.onLogin() returns
 */
export interface TikAPICallbackData {
  access_token: string
  type: 'success' | 'error'
  message: string
  scope?: string[]
  userInfo: {
    id: string
    username: string
    nickname: string
    avatar: string
    followerCount?: number
    verified?: boolean
  }
}

/**
 * TikAPI error response
 */
interface TikAPIError {
  type: 'error'
  message: string
}

/**
 * Validate TikAPI callback data structure
 */
function isTikAPICallbackData(data: unknown): data is TikAPICallbackData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  return (
    typeof d.access_token === 'string' &&
    (d.type === 'success' || d.type === 'error') &&
    typeof d.message === 'string' &&
    typeof d.userInfo === 'object' &&
    d.userInfo !== null
  )
}

/**
 * TikTok provider configuration using TikAPI
 */
export const tiktokProvider: OAuthProviderConfig = {
  provider: 'tiktok',
  displayName: 'TikTok',
  icon: 'tiktok',
  clientId: process.env.NEXT_PUBLIC_TIKAPI_CLIENT_ID || 'c_0T1IRI43Y2',
  defaultScopes: ['user.info.basic', 'video.list'],
  usesPopup: true,

  getAuthUrl: (state: string, scopes?: string[]): string => {
    // TikAPI primarily uses popup SDK, this URL is for reference/fallback
    const params = new URLSearchParams({
      client_id: tiktokProvider.clientId,
      state,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/tiktok/callback`,
    })

    const scopeList = scopes || tiktokProvider.defaultScopes
    if (scopeList.length > 0) {
      params.set('scope', scopeList.join(','))
    }

    return `https://tikapi.io/oauth/authorize?${params.toString()}`
  },

  handleCallback: async (data: unknown): Promise<OAuthCallbackData> => {
    // Validate data structure
    if (!isTikAPICallbackData(data)) {
      throw new Error('Invalid TikAPI callback data format')
    }

    // Check for error response
    if (data.type === 'error') {
      throw new Error(data.message || 'TikTok authorization failed')
    }

    // Validate required fields
    if (!data.access_token) {
      throw new Error('No access token received from TikTok')
    }

    if (!data.userInfo?.id) {
      throw new Error('No user information received from TikTok')
    }

    return {
      tokens: {
        accessToken: data.access_token,
        scopes: data.scope,
        // TikAPI account keys don't expire like traditional OAuth tokens
        // They remain valid until the user revokes access
      },
      userInfo: {
        providerAccountId: data.userInfo.id,
        username: data.userInfo.username,
        displayName: data.userInfo.nickname,
        avatarUrl: data.userInfo.avatar,
      },
    }
  },

  refreshTokens: undefined, // TikAPI tokens don't expire/refresh traditionally

  validateToken: async (accessToken: string): Promise<boolean> => {
    const apiKey = process.env.TIKAPI_KEY

    if (!apiKey) {
      console.error('TIKAPI_KEY not configured')
      return false
    }

    try {
      const response = await fetch('https://api.tikapi.io/user/info', {
        method: 'GET',
        headers: {
          'X-ACCOUNT-KEY': accessToken,
          'X-API-KEY': apiKey,
        },
      })

      return response.ok
    } catch (error) {
      console.error('TikTok token validation failed:', error)
      return false
    }
  },
}

/**
 * Get TikAPI configuration for client-side popup SDK
 */
export function getTikAPIClientConfig(): { clientId: string } {
  return {
    clientId: tiktokProvider.clientId,
  }
}
