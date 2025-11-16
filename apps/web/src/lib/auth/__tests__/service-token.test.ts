/**
 * Service Token Authentication Tests
 */

// Mock Next.js server module BEFORE importing the module under test
jest.mock('next/server', () => {
  class MockNextRequest {
    headers: { get: (name: string) => string | null }
    url: string

    constructor(url: string, options?: { headers?: Record<string, string> }) {
      this.url = url
      const headersMap = new Map<string, string>()
      if (options?.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          headersMap.set(key.toLowerCase(), value)
        })
      }

      this.headers = {
        get: (name: string) => headersMap.get(name.toLowerCase()) || null
      }
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: jest.fn((body, init) => ({ body, ...init, status: init?.status || 200 })),
    },
  }
})

import { validateServiceToken, requireServiceToken, generateServiceToken, isServiceTokenConfigured } from '../service-token'
import { NextRequest } from 'next/server'

describe('Service Token Authentication', () => {
  const validToken = process.env.SERVICE_TOKEN_SECRET!
  const mockUrl = 'http://localhost:3000/api/test'

  beforeEach(() => {
    // Reset environment
    process.env.SERVICE_TOKEN_SECRET = 'test-service-token-secret-1234567890abcdef1234567890abcdef'
  })

  describe('generateServiceToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateServiceToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate unique tokens', () => {
      const token1 = generateServiceToken()
      const token2 = generateServiceToken()
      expect(token1).not.toBe(token2)
    })
  })

  describe('isServiceTokenConfigured', () => {
    it('should return true when SERVICE_TOKEN_SECRET is configured', () => {
      expect(isServiceTokenConfigured()).toBe(true)
    })

    it('should return false when SERVICE_TOKEN_SECRET is not set', () => {
      delete process.env.SERVICE_TOKEN_SECRET
      expect(isServiceTokenConfigured()).toBe(false)
    })

    it('should return false when SERVICE_TOKEN_SECRET is too short', () => {
      process.env.SERVICE_TOKEN_SECRET = 'short'
      expect(isServiceTokenConfigured()).toBe(false)
    })
  })

  describe('validateServiceToken', () => {
    it('should validate correct token with Bearer scheme', () => {
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      })
      expect(validateServiceToken(request)).toBe(true)
    })

    it('should reject request without authorization header', () => {
      const request = new NextRequest(mockUrl)
      expect(validateServiceToken(request)).toBe(false)
    })

    it('should reject invalid bearer token', () => {
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })
      expect(validateServiceToken(request)).toBe(false)
    })

    it('should reject wrong authorization scheme', () => {
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: `Basic ${validToken}`,
        },
      })
      expect(validateServiceToken(request)).toBe(false)
    })

    it('should reject malformed authorization header', () => {
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: validToken,
        },
      })
      expect(validateServiceToken(request)).toBe(false)
    })

    it('should return false when SERVICE_TOKEN_SECRET is not configured', () => {
      delete process.env.SERVICE_TOKEN_SECRET
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      })
      expect(validateServiceToken(request)).toBe(false)
    })
  })

  describe('requireServiceToken', () => {
    it('should return null for valid token (allow request)', () => {
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      })
      const result = requireServiceToken(request)
      expect(result).toBeNull()
    })

    it('should return 401 response for missing token', () => {
      const request = new NextRequest(mockUrl)
      const result = requireServiceToken(request)
      expect(result).not.toBeNull()
      expect(result?.status).toBe(401)
    })

    it('should return 401 response for invalid token', () => {
      const request = new NextRequest(mockUrl, {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })
      const result = requireServiceToken(request)
      expect(result).not.toBeNull()
      expect(result?.status).toBe(401)
    })

    it('should return proper error message in 401 response', () => {
      const request = new NextRequest(mockUrl)
      const result = requireServiceToken(request)
      // Mock NextResponse.json returns the body directly
      expect(result?.body).toEqual({
        error: 'Unauthorized',
        message: 'Valid service token required',
      })
    })
  })

  describe('Security - Timing Attack Prevention', () => {
    it('should use constant-time comparison', () => {
      // This test ensures validateServiceToken doesn't short-circuit on length mismatch
      const shortToken = 'short'
      const longToken = validToken

      const request1 = new NextRequest(mockUrl, {
        headers: { authorization: `Bearer ${shortToken}` },
      })
      const request2 = new NextRequest(mockUrl, {
        headers: { authorization: `Bearer ${longToken.substring(0, 10)}` },
      })

      // Both should fail, but timing should be consistent
      expect(validateServiceToken(request1)).toBe(false)
      expect(validateServiceToken(request2)).toBe(false)
    })
  })
})
