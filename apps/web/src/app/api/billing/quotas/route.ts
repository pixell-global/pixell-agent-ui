/**
 * GET /api/billing/quotas?orgId=...
 *
 * Get feature quota status for an organization
 * Supports two authentication modes:
 * 1. Session authentication (for users) - gets orgId from user's organization membership
 * 2. Service token authentication (for orchestrator) - requires orgId query parameter
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizationMembers } from '@pixell/db-mysql'
import { and, eq } from 'drizzle-orm'
import { validateServiceToken } from '@/lib/auth/service-token'
import { getQuotaStatus } from '@/lib/billing/quota-manager'

async function getCurrentUserOrg(userId: string): Promise<string | null> {
  const db = await getDb()
  const memberships = await db
    .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
    .orderBy(organizationMembers.role)

  return memberships[0]?.orgId || null
}

export async function GET(request: NextRequest) {
  try {
    let orgId: string | null = null

    // Try session authentication first (user access)
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(cookieName)?.value

    if (sessionCookie) {
      // User is authenticated via session
      try {
        const decoded = await verifySessionCookie(sessionCookie)
        orgId = await getCurrentUserOrg(decoded.sub)

        if (!orgId) {
          return NextResponse.json(
            {
              error: 'No organization',
              message: 'User is not a member of any organization',
            },
            { status: 400 }
          )
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Quotas Get] Session verification failed:', {
          error: errorMessage,
          cookiePresent: !!sessionCookie,
          cookieName,
        })
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Invalid or expired session. Please sign in again.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }
    } else {
      // No session cookie, try service token (orchestrator access)
      const isValidServiceToken = validateServiceToken(request)

      if (!isValidServiceToken) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'No valid session or service token provided',
          },
          { status: 401 }
        )
      }

      // Service token is valid, get orgId from query params
      const { searchParams } = new URL(request.url)
      orgId = searchParams.get('orgId')

      if (!orgId) {
        return NextResponse.json(
          {
            error: 'Missing required parameter',
            message: 'orgId is required for service token authentication',
          },
          { status: 400 }
        )
      }
    }

    // Get quota status
    const quotas = await getQuotaStatus(orgId)

    if (!quotas) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'No quota record found for this organization',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      quotas,
    })
  } catch (error) {
    console.error('[Quotas Get] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to retrieve quotas',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
