/**
 * User-scoped storage utilities
 * Provides authenticated storage access for file operations
 */

import { NextRequest } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { ensureUserStoragePath, getUserOrgId } from '@pixell/db-mysql'
import { StorageManager } from '@pixell/file-storage'

export interface UserStorageContext {
  userId: string
  orgId: string
  storagePath: string
  storage: StorageManager
}

/**
 * Get user context from request cookies
 * Returns null if user is not authenticated
 */
export async function getUserContext(request: NextRequest): Promise<{
  userId: string
  orgId: string | null
} | null> {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value

    if (!sessionCookie) {
      return null
    }

    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub as string
    // Use ORG cookie if present, otherwise query database for user's org
    let orgId = request.cookies.get('ORG')?.value || null

    if (!orgId) {
      // Query database for user's organization
      orgId = await getUserOrgId(userId)
    }

    return { userId, orgId }
  } catch (error) {
    console.error('Failed to get user context:', error)
    return null
  }
}

/**
 * Get a user-scoped storage manager for authenticated file operations
 * This ensures all file operations are isolated to the user's S3 path
 */
export async function getUserScopedStorage(
  request: NextRequest
): Promise<UserStorageContext | null> {
  const context = await getUserContext(request)

  if (!context || !context.orgId) {
    return null
  }

  const { userId, orgId } = context

  // Get or create the user's storage path
  const storagePath = await ensureUserStoragePath(userId, orgId)

  // Create a storage manager scoped to this user's path
  const storage = await StorageManager.createForUser(userId, orgId, storagePath)

  return {
    userId,
    orgId,
    storagePath,
    storage,
  }
}

