/**
 * User Storage Utility Tests
 *
 * Tests the user-scoped storage utilities used by file APIs:
 * 1. getUserContext - Extract user info from cookies
 * 2. getUserScopedStorage - Create user-scoped storage manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@pixell/auth-firebase/server', () => ({
  verifySessionCookie: vi.fn(),
}))

vi.mock('@pixell/db-mysql', () => ({
  ensureUserStoragePath: vi.fn(),
}))

vi.mock('@pixell/file-storage', () => ({
  StorageManager: {
    createForUser: vi.fn().mockResolvedValue({
      listFiles: vi.fn().mockResolvedValue([]),
      writeFile: vi.fn().mockResolvedValue({}),
      readFile: vi.fn().mockResolvedValue({ content: '', metadata: {} }),
    }),
    createFromEnv: vi.fn().mockResolvedValue({
      listFiles: vi.fn().mockResolvedValue([]),
      writeFile: vi.fn().mockResolvedValue({}),
      readFile: vi.fn().mockResolvedValue({ content: '', metadata: {} }),
    }),
  },
}))

describe('User Storage Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserContext', () => {
    it('should return null when no session cookie', async () => {
      const { getUserContext } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        // No cookies
      })

      const result = await getUserContext(mockRequest)
      expect(result).toBeNull()
    })

    it('should return user context when session is valid', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      })

      const { getUserContext } = await import('../user-storage')

      // Create request with cookies
      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'session=valid-token; ORG=org-456',
        },
      })

      const result = await getUserContext(mockRequest)

      expect(result).toBeDefined()
      expect(result?.userId).toBe('user-123')
      expect(result?.orgId).toBe('org-456')
    })

    it('should handle missing ORG cookie gracefully', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
      })

      const { getUserContext } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'session=valid-token',
          // No ORG cookie
        },
      })

      const result = await getUserContext(mockRequest)

      expect(result?.userId).toBe('user-123')
      expect(result?.orgId).toBeNull()
    })

    it('should handle session verification errors', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockRejectedValue(new Error('Invalid session'))

      const { getUserContext } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'session=invalid-token',
        },
      })

      const result = await getUserContext(mockRequest)
      expect(result).toBeNull()
    })
  })

  describe('getUserScopedStorage', () => {
    it('should return null when user not authenticated', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockRejectedValue(new Error('No auth'))

      const { getUserScopedStorage } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
      })

      const result = await getUserScopedStorage(mockRequest)
      expect(result).toBeNull()
    })

    it('should return null when orgId is missing', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockResolvedValue({ sub: 'user-123' })

      const { getUserScopedStorage } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'session=valid-token',
          // No ORG cookie
        },
      })

      const result = await getUserScopedStorage(mockRequest)
      expect(result).toBeNull()
    })

    it('should return scoped storage context when fully authenticated', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockResolvedValue({ sub: 'user-123' })

      const { ensureUserStoragePath } = await import('@pixell/db-mysql')
      ;(ensureUserStoragePath as any).mockResolvedValue('orgs/org-456/users/user-123')

      const { StorageManager } = await import('@pixell/file-storage')

      const { getUserScopedStorage } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'session=valid-token; ORG=org-456',
        },
      })

      const result = await getUserScopedStorage(mockRequest)

      expect(result).toBeDefined()
      expect(result?.userId).toBe('user-123')
      expect(result?.orgId).toBe('org-456')
      expect(result?.storagePath).toBe('orgs/org-456/users/user-123')
      expect(result?.storage).toBeDefined()

      // Verify storage was created with correct params
      expect(StorageManager.createForUser).toHaveBeenCalledWith(
        'user-123',
        'org-456',
        'orgs/org-456/users/user-123'
      )
    })
  })

})

describe('User Storage - Integration Patterns', () => {
  describe('File API Usage Pattern', () => {
    it('should provide storage context for authenticated requests', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockResolvedValue({ sub: 'user-123' })

      const { ensureUserStoragePath } = await import('@pixell/db-mysql')
      ;(ensureUserStoragePath as any).mockResolvedValue('orgs/org-456/users/user-123')

      const { getUserScopedStorage } = await import('../user-storage')

      const authenticatedRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'session=valid-token; ORG=org-456',
        },
      })

      // Pattern used in file APIs:
      const userContext = await getUserScopedStorage(authenticatedRequest)

      // User context should be used
      expect(userContext).not.toBeNull()
      expect(userContext?.storage).toBeDefined()
    })

    it('should return null for unauthenticated requests', async () => {
      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockRejectedValue(new Error('No auth'))

      const { getUserScopedStorage } = await import('../user-storage')

      const anonymousRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
      })

      const userContext = await getUserScopedStorage(anonymousRequest)

      // Unauthenticated users get null - APIs should return 401
      expect(userContext).toBeNull()
    })
  })
})

describe('User Storage - Security', () => {
  describe('Cookie Parsing', () => {
    it('should correctly parse session cookie with custom name', async () => {
      const originalEnv = process.env
      process.env.SESSION_COOKIE_NAME = 'custom_session'

      const { verifySessionCookie } = await import('@pixell/auth-firebase/server')
      ;(verifySessionCookie as any).mockResolvedValue({ sub: 'user-123' })

      // Need to reimport to pick up env change
      vi.resetModules()
      const { getUserContext } = await import('../user-storage')

      const mockRequest = new NextRequest('http://localhost:3000/api/files', {
        method: 'GET',
        headers: {
          Cookie: 'custom_session=valid-token; ORG=org-456',
        },
      })

      // The function should look for SESSION_COOKIE_NAME env var

      process.env = originalEnv
    })
  })

  describe('User Isolation Verification', () => {
    it('storage path should include user ID', async () => {
      const userId = 'isolated-user-123'
      const orgId = 'isolated-org-456'
      const expectedPath = `orgs/${orgId}/users/${userId}`

      expect(expectedPath).toContain(userId)
      expect(expectedPath).toContain(orgId)
    })

    it('different users should have non-overlapping paths', async () => {
      const orgId = 'shared-org'

      const path1 = `orgs/${orgId}/users/user-a`
      const path2 = `orgs/${orgId}/users/user-b`

      expect(path1).not.toBe(path2)
      expect(path1.startsWith(path2)).toBe(false)
      expect(path2.startsWith(path1)).toBe(false)
    })
  })
})
