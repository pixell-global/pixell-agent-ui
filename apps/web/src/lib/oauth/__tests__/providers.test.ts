/**
 * OAuth Provider Framework Tests
 */

import {
  getProvider,
  isProviderImplemented,
  getImplementedProviders,
  getProviderStatuses,
  getProviderDisplayInfo,
  SUPPORTED_PROVIDERS,
  tiktokProvider,
} from '../providers'
import type { TikAPICallbackData } from '../providers/tiktok'

describe('OAuth Provider Registry', () => {
  describe('SUPPORTED_PROVIDERS', () => {
    it('should include all expected providers', () => {
      expect(SUPPORTED_PROVIDERS).toContain('tiktok')
      expect(SUPPORTED_PROVIDERS).toContain('instagram')
      expect(SUPPORTED_PROVIDERS).toContain('google')
      expect(SUPPORTED_PROVIDERS).toContain('reddit')
    })

    it('should have exactly 4 providers', () => {
      expect(SUPPORTED_PROVIDERS).toHaveLength(4)
    })
  })

  describe('getProvider', () => {
    it('should return TikTok provider config', () => {
      const provider = getProvider('tiktok')
      expect(provider).toBeDefined()
      expect(provider.provider).toBe('tiktok')
      expect(provider.displayName).toBe('TikTok')
    })

    it('should throw for unimplemented provider', () => {
      expect(() => getProvider('instagram')).toThrow('not yet implemented')
      expect(() => getProvider('google')).toThrow('not yet implemented')
      expect(() => getProvider('reddit')).toThrow('not yet implemented')
    })
  })

  describe('isProviderImplemented', () => {
    it('should return true for TikTok', () => {
      expect(isProviderImplemented('tiktok')).toBe(true)
    })

    it('should return false for unimplemented providers', () => {
      expect(isProviderImplemented('instagram')).toBe(false)
      expect(isProviderImplemented('google')).toBe(false)
      expect(isProviderImplemented('reddit')).toBe(false)
    })
  })

  describe('getImplementedProviders', () => {
    it('should return array of implemented providers', () => {
      const providers = getImplementedProviders()
      expect(providers).toHaveLength(1)
      expect(providers[0].provider).toBe('tiktok')
    })
  })

  describe('getProviderStatuses', () => {
    it('should return status for all providers', () => {
      const statuses = getProviderStatuses()
      expect(statuses).toHaveLength(4)
    })

    it('should show unimplemented providers as not configured', () => {
      const statuses = getProviderStatuses()
      const instagram = statuses.find((s) => s.provider === 'instagram')
      expect(instagram?.configured).toBe(false)
      expect(instagram?.error).toBe('Provider not implemented')
    })
  })

  describe('getProviderDisplayInfo', () => {
    it('should return display info for all providers', () => {
      const info = getProviderDisplayInfo()
      expect(info).toHaveLength(4)
    })

    it('should mark TikTok as implemented', () => {
      const info = getProviderDisplayInfo()
      const tiktok = info.find((i) => i.provider === 'tiktok')
      expect(tiktok?.implemented).toBe(true)
      expect(tiktok?.displayName).toBe('TikTok')
      expect(tiktok?.usesPopup).toBe(true)
    })

    it('should mark other providers as not implemented', () => {
      const info = getProviderDisplayInfo()
      const instagram = info.find((i) => i.provider === 'instagram')
      expect(instagram?.implemented).toBe(false)
    })

    it('should provide display names for unimplemented providers', () => {
      const info = getProviderDisplayInfo()
      const reddit = info.find((i) => i.provider === 'reddit')
      expect(reddit?.displayName).toBe('Reddit')
      expect(reddit?.icon).toBe('reddit')
    })
  })
})

describe('TikTok Provider', () => {
  describe('configuration', () => {
    it('should have correct provider identifier', () => {
      expect(tiktokProvider.provider).toBe('tiktok')
    })

    it('should have display name', () => {
      expect(tiktokProvider.displayName).toBe('TikTok')
    })

    it('should have client ID', () => {
      expect(tiktokProvider.clientId).toBeDefined()
      expect(typeof tiktokProvider.clientId).toBe('string')
    })

    it('should use popup OAuth flow', () => {
      expect(tiktokProvider.usesPopup).toBe(true)
    })

    it('should have default scopes', () => {
      expect(tiktokProvider.defaultScopes).toContain('user.info.basic')
    })
  })

  describe('getAuthUrl', () => {
    it('should generate authorization URL with state', () => {
      const state = 'test-state-123'
      const url = tiktokProvider.getAuthUrl(state)

      expect(url).toContain('tikapi.io/oauth/authorize')
      expect(url).toContain(`state=${state}`)
    })

    it('should include client ID in URL', () => {
      const url = tiktokProvider.getAuthUrl('state')
      expect(url).toContain('client_id=')
    })

    it('should include custom scopes when provided', () => {
      const url = tiktokProvider.getAuthUrl('state', ['custom.scope'])
      expect(url).toContain('scope=custom.scope')
    })
  })

  describe('handleCallback', () => {
    const validCallbackData: TikAPICallbackData = {
      access_token: 'test-token-123',
      type: 'success',
      message: 'Authorization successful',
      scope: ['user.info.basic'],
      userInfo: {
        id: 'user-123',
        username: 'testuser',
        nickname: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        followerCount: 1000,
        verified: false,
      },
    }

    it('should parse valid callback data', async () => {
      const result = await tiktokProvider.handleCallback(validCallbackData)

      expect(result.tokens.accessToken).toBe('test-token-123')
      expect(result.tokens.scopes).toEqual(['user.info.basic'])
      expect(result.userInfo.providerAccountId).toBe('user-123')
      expect(result.userInfo.username).toBe('testuser')
      expect(result.userInfo.displayName).toBe('Test User')
      expect(result.userInfo.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('should throw on error response', async () => {
      const errorData: TikAPICallbackData = {
        access_token: '',
        type: 'error',
        message: 'User denied access',
        userInfo: {
          id: '',
          username: '',
          nickname: '',
          avatar: '',
        },
      }

      await expect(tiktokProvider.handleCallback(errorData)).rejects.toThrow(
        'User denied access'
      )
    })

    it('should throw on invalid data format', async () => {
      await expect(tiktokProvider.handleCallback({})).rejects.toThrow(
        'Invalid TikAPI callback data format'
      )
    })

    it('should throw on null data', async () => {
      await expect(tiktokProvider.handleCallback(null)).rejects.toThrow(
        'Invalid TikAPI callback data format'
      )
    })

    it('should throw on missing access token', async () => {
      const noTokenData = {
        ...validCallbackData,
        access_token: '',
      }

      await expect(tiktokProvider.handleCallback(noTokenData)).rejects.toThrow(
        'No access token received'
      )
    })

    it('should throw on missing user ID', async () => {
      const noUserIdData = {
        ...validCallbackData,
        userInfo: {
          ...validCallbackData.userInfo,
          id: '',
        },
      }

      await expect(tiktokProvider.handleCallback(noUserIdData)).rejects.toThrow(
        'No user information received'
      )
    })
  })

  describe('validateToken', () => {
    beforeEach(() => {
      // Reset fetch mock
      global.fetch = jest.fn()
    })

    it('should return false when TIKAPI_KEY not set', async () => {
      const originalKey = process.env.TIKAPI_KEY
      delete process.env.TIKAPI_KEY

      const result = await tiktokProvider.validateToken('test-token')
      expect(result).toBe(false)

      process.env.TIKAPI_KEY = originalKey
    })

    it('should return true for valid token response', async () => {
      process.env.TIKAPI_KEY = 'test-api-key'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      })

      const result = await tiktokProvider.validateToken('valid-token')
      expect(result).toBe(true)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.tikapi.io/user/info',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-ACCOUNT-KEY': 'valid-token',
            'X-API-KEY': 'test-api-key',
          }),
        })
      )
    })

    it('should return false for invalid token response', async () => {
      process.env.TIKAPI_KEY = 'test-api-key'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await tiktokProvider.validateToken('invalid-token')
      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      process.env.TIKAPI_KEY = 'test-api-key'
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await tiktokProvider.validateToken('test-token')
      expect(result).toBe(false)
    })
  })

  describe('refreshTokens', () => {
    it('should be undefined (TikAPI tokens do not refresh)', () => {
      expect(tiktokProvider.refreshTokens).toBeUndefined()
    })
  })
})
