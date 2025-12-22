/**
 * Comprehensive tests for user-storage repository
 * Tests S3 path generation, persistence, and edge cases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../connection'
import { users, organizations, organizationMembers } from '../../schema'
import {
  getUserStoragePath,
  setUserStoragePath,
  generateUserStoragePath,
  ensureUserStoragePath,
} from '../user-storage'
import { randomUUID } from 'crypto'

describe('User Storage Repository', () => {
  let db: Awaited<ReturnType<typeof getDb>>

  // Test data
  const testUserId = `test-user-${randomUUID()}`
  const testOrgId = randomUUID()
  const testEmail = `test-${randomUUID()}@example.com`

  beforeAll(async () => {
    db = await getDb()

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      displayName: 'Test User',
    })

    // Create test organization
    await db.insert(organizations).values({
      id: testOrgId,
      name: 'Test Org',
      createdBy: testUserId,
    })

    // Create org membership
    await db.insert(organizationMembers).values({
      orgId: testOrgId,
      userId: testUserId,
      role: 'owner',
    })
  })

  afterAll(async () => {
    // Cleanup test data
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, testUserId))
    await db.delete(organizations).where(eq(organizations.id, testOrgId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

  describe('generateUserStoragePath', () => {
    it('should generate correct path format', () => {
      const path = generateUserStoragePath('org-123', 'user-456')
      expect(path).toBe('orgs/org-123/users/user-456')
    })

    it('should handle UUID format org and user IDs', () => {
      const orgId = randomUUID()
      const userId = randomUUID()
      const path = generateUserStoragePath(orgId, userId)
      expect(path).toBe(`orgs/${orgId}/users/${userId}`)
    })

    it('should handle special characters in IDs', () => {
      const path = generateUserStoragePath('org_test-123', 'user.test+456')
      expect(path).toBe('orgs/org_test-123/users/user.test+456')
    })

    it('should be deterministic - same input always same output', () => {
      const path1 = generateUserStoragePath('org-1', 'user-1')
      const path2 = generateUserStoragePath('org-1', 'user-1')
      expect(path1).toBe(path2)
    })

    it('should generate unique paths for different users in same org', () => {
      const path1 = generateUserStoragePath('org-1', 'user-1')
      const path2 = generateUserStoragePath('org-1', 'user-2')
      expect(path1).not.toBe(path2)
    })

    it('should generate unique paths for same user in different orgs', () => {
      const path1 = generateUserStoragePath('org-1', 'user-1')
      const path2 = generateUserStoragePath('org-2', 'user-1')
      expect(path1).not.toBe(path2)
    })
  })

  describe('getUserStoragePath', () => {
    it('should return null for user without storage path', async () => {
      const path = await getUserStoragePath(testUserId)
      // Initially null since we haven't set it
      expect(path).toBeNull()
    })

    it('should return null for non-existent user', async () => {
      const path = await getUserStoragePath('non-existent-user')
      expect(path).toBeNull()
    })
  })

  describe('setUserStoragePath', () => {
    it('should set storage path for user', async () => {
      const expectedPath = generateUserStoragePath(testOrgId, testUserId)

      await setUserStoragePath(testUserId, expectedPath)

      const path = await getUserStoragePath(testUserId)
      expect(path).toBe(expectedPath)
    })

    it('should update existing storage path', async () => {
      const newOrgId = randomUUID()
      const newPath = generateUserStoragePath(newOrgId, testUserId)

      await setUserStoragePath(testUserId, newPath)

      const path = await getUserStoragePath(testUserId)
      expect(path).toBe(newPath)
    })

    it('should handle long storage paths', async () => {
      const longOrgId = 'a'.repeat(100)
      const longPath = generateUserStoragePath(longOrgId, testUserId)

      await setUserStoragePath(testUserId, longPath)

      const path = await getUserStoragePath(testUserId)
      expect(path).toBe(longPath)
    })
  })

  describe('ensureUserStoragePath', () => {
    const ensureTestUserId = `ensure-test-${randomUUID()}`
    const ensureTestOrgId = randomUUID()
    const ensureTestEmail = `ensure-${randomUUID()}@example.com`

    beforeAll(async () => {
      // Create test user without storage path
      await db.insert(users).values({
        id: ensureTestUserId,
        email: ensureTestEmail,
        displayName: 'Ensure Test User',
      })
    })

    afterAll(async () => {
      await db.delete(users).where(eq(users.id, ensureTestUserId))
    })

    it('should create storage path if not exists', async () => {
      const path = await ensureUserStoragePath(ensureTestUserId, ensureTestOrgId)

      expect(path).toBe(generateUserStoragePath(ensureTestOrgId, ensureTestUserId))
    })

    it('should return existing path if already set', async () => {
      // First call sets it
      const path1 = await ensureUserStoragePath(ensureTestUserId, ensureTestOrgId)

      // Second call should return same path without generating new one
      const path2 = await ensureUserStoragePath(ensureTestUserId, 'different-org-id')

      // Should return original path, not generate new one
      expect(path2).toBe(path1)
    })

    it('should be idempotent - multiple calls same result', async () => {
      const results = await Promise.all([
        ensureUserStoragePath(ensureTestUserId, ensureTestOrgId),
        ensureUserStoragePath(ensureTestUserId, ensureTestOrgId),
        ensureUserStoragePath(ensureTestUserId, ensureTestOrgId),
      ])

      // All results should be identical
      expect(results[0]).toBe(results[1])
      expect(results[1]).toBe(results[2])
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string user ID gracefully', async () => {
      const path = await getUserStoragePath('')
      expect(path).toBeNull()
    })

    it('should handle path with forward slashes in IDs', () => {
      // This tests that the function doesn't double-up slashes
      const path = generateUserStoragePath('org/with/slash', 'user/with/slash')
      expect(path).toBe('orgs/org/with/slash/users/user/with/slash')
    })
  })
})

describe('User Storage - Multi-User Isolation', () => {
  let db: Awaited<ReturnType<typeof getDb>>

  // Create multiple test users
  const users1Id = `isolation-user1-${randomUUID()}`
  const users2Id = `isolation-user2-${randomUUID()}`
  const sharedOrgId = randomUUID()
  const user2OrgId = randomUUID()

  beforeAll(async () => {
    db = await getDb()

    // Create two test users
    await db.insert(users).values([
      { id: users1Id, email: `${users1Id}@test.com`, displayName: 'User 1' },
      { id: users2Id, email: `${users2Id}@test.com`, displayName: 'User 2' },
    ])

    // Create orgs
    await db.insert(organizations).values([
      { id: sharedOrgId, name: 'Shared Org', createdBy: users1Id },
      { id: user2OrgId, name: 'User 2 Org', createdBy: users2Id },
    ])
  })

  afterAll(async () => {
    await db.delete(users).where(sql`id IN (${users1Id}, ${users2Id})`)
    await db.delete(organizations).where(sql`id IN (${sharedOrgId}, ${user2OrgId})`)
  })

  it('should generate completely different paths for two users in same org', async () => {
    const path1 = await ensureUserStoragePath(users1Id, sharedOrgId)
    const path2 = await ensureUserStoragePath(users2Id, sharedOrgId)

    expect(path1).not.toBe(path2)
    expect(path1).toContain(users1Id)
    expect(path2).toContain(users2Id)
    expect(path1).toContain(sharedOrgId)
    expect(path2).toContain(sharedOrgId)
  })

  it('should ensure user paths are isolated - no path prefix overlap', async () => {
    const path1 = generateUserStoragePath(sharedOrgId, users1Id)
    const path2 = generateUserStoragePath(sharedOrgId, users2Id)

    // Neither path should be a prefix of the other
    expect(path1.startsWith(path2)).toBe(false)
    expect(path2.startsWith(path1)).toBe(false)
  })

  it('should maintain path isolation across different orgs', async () => {
    const path1 = generateUserStoragePath(sharedOrgId, users1Id)
    const path2 = generateUserStoragePath(user2OrgId, users2Id)

    // Completely different paths
    expect(path1).not.toBe(path2)

    // Different org segments
    expect(path1).toContain(sharedOrgId)
    expect(path2).toContain(user2OrgId)
  })
})

describe('User Storage - Bootstrap Flow Integration', () => {
  let db: Awaited<ReturnType<typeof getDb>>

  beforeAll(async () => {
    db = await getDb()
  })

  it('should correctly set storage path during simulated bootstrap', async () => {
    const uid = `bootstrap-test-${randomUUID()}`
    const orgId = randomUUID()
    const email = `bootstrap-${randomUUID()}@test.com`

    // Simulate bootstrap flow
    // 1. Create user (from Firebase auth)
    await db.insert(users).values({
      id: uid,
      email,
      displayName: 'Bootstrap User',
    })

    // 2. Create organization
    await db.insert(organizations).values({
      id: orgId,
      name: 'Bootstrap Org',
      createdBy: uid,
    })

    // 3. Add org membership
    await db.insert(organizationMembers).values({
      orgId,
      userId: uid,
      role: 'owner',
    })

    // 4. Allocate S3 storage path (this is what bootstrap does)
    const s3StoragePath = generateUserStoragePath(orgId, uid)
    await setUserStoragePath(uid, s3StoragePath)

    // Verify
    const storedPath = await getUserStoragePath(uid)
    expect(storedPath).toBe(`orgs/${orgId}/users/${uid}`)

    // Cleanup
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, uid))
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(users).where(eq(users.id, uid))
  })

  it('should handle user without org (edge case)', async () => {
    const uid = `no-org-user-${randomUUID()}`
    const email = `no-org-${randomUUID()}@test.com`

    // Create user without org membership
    await db.insert(users).values({
      id: uid,
      email,
      displayName: 'No Org User',
    })

    // Simulate fallback: use user-only path
    const fallbackPath = `users/${uid}`
    await setUserStoragePath(uid, fallbackPath)

    const storedPath = await getUserStoragePath(uid)
    expect(storedPath).toBe(`users/${uid}`)

    // Cleanup
    await db.delete(users).where(eq(users.id, uid))
  })
})

describe('User Storage - Concurrent Access', () => {
  let db: Awaited<ReturnType<typeof getDb>>

  beforeAll(async () => {
    db = await getDb()
  })

  it('should handle concurrent ensureUserStoragePath calls safely', async () => {
    const uid = `concurrent-user-${randomUUID()}`
    const orgId = randomUUID()
    const email = `concurrent-${randomUUID()}@test.com`

    // Create user
    await db.insert(users).values({
      id: uid,
      email,
      displayName: 'Concurrent User',
    })

    // Simulate multiple concurrent requests
    const concurrentCalls = 10
    const results = await Promise.all(
      Array(concurrentCalls)
        .fill(null)
        .map(() => ensureUserStoragePath(uid, orgId))
    )

    // All results should be identical
    const uniquePaths = new Set(results)
    expect(uniquePaths.size).toBe(1)
    expect(results[0]).toBe(generateUserStoragePath(orgId, uid))

    // Cleanup
    await db.delete(users).where(eq(users.id, uid))
  })
})
