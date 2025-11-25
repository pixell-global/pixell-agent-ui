/**
 * Session Authentication for API Routes
 *
 * Provides session validation using Firebase session cookies.
 * Returns user information including orgId for authorization checks.
 */

import { cookies } from 'next/headers'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { organizationMembers } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'

/**
 * Session user information
 */
export interface SessionUser {
  id: string
  email?: string
  displayName?: string
  orgId?: string
}

/**
 * Session result
 */
export interface Session {
  user: SessionUser
}

/**
 * Get the current authenticated session
 * Returns null if not authenticated
 */
export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = cookieStore.get(cookieName)?.value

    if (!sessionCookie) {
      return null
    }

    // Verify the session cookie with Firebase
    const decoded = await verifySessionCookie(sessionCookie)

    if (!decoded) {
      return null
    }

    const userId = decoded.sub as string
    const email = (decoded as any)?.email as string | undefined
    const displayName = (decoded as any)?.name as string | undefined

    // Get user's organization
    let orgId: string | undefined
    try {
      const db = await getDb()
      const memberships = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId))
        .limit(1)

      if (memberships.length > 0) {
        orgId = memberships[0].orgId
      }
    } catch (error) {
      console.error('[Auth] Error fetching org membership:', error)
    }

    return {
      user: {
        id: userId,
        email,
        displayName,
        orgId,
      },
    }
  } catch (error) {
    console.error('[Auth] Session verification failed:', error)
    return null
  }
}
