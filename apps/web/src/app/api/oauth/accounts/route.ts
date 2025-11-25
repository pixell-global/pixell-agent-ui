/**
 * GET /api/oauth/accounts - List connected external accounts
 * DELETE /api/oauth/accounts?id=... - Disconnect an account
 *
 * Requires user session and Pro/Max plan.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/supabase-auth'
import { externalAccountsManager } from '@/lib/oauth/external-accounts-manager'
import { getDb } from '@pixell/db-mysql'
import { organizations } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'
import type { OAuthProvider } from '@/lib/oauth/providers/types'

/**
 * Check if organization has Pro or Max plan
 */
async function checkProPlan(orgId: string): Promise<{ allowed: boolean; error?: string }> {
  const db = await getDb()

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (orgs.length === 0) {
    return { allowed: false, error: 'Organization not found' }
  }

  const org = orgs[0]
  if (!['pro', 'max'].includes(org.subscriptionTier)) {
    return {
      allowed: false,
      error: 'External account connections require Pro or Max plan',
    }
  }

  return { allowed: true }
}

/**
 * GET /api/oauth/accounts
 * List all connected external accounts for the organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check plan
    const planCheck = await checkProPlan(session.user.orgId)
    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: planCheck.error,
          requiredPlan: 'pro',
        },
        { status: 403 }
      )
    }

    const provider = req.nextUrl.searchParams.get('provider') as OAuthProvider | null

    const accounts = await externalAccountsManager.getAccountsForOrg(
      session.user.orgId,
      provider || undefined
    )

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('[OAuth Accounts] Error fetching accounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/oauth/accounts?id=...
 * Disconnect an external account (soft delete)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = req.nextUrl.searchParams.get('id')
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verify account belongs to this org before disconnecting
    const account = await externalAccountsManager.getAccountById(
      accountId,
      session.user.orgId
    )

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await externalAccountsManager.disconnectAccount(accountId, session.user.orgId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OAuth Accounts] Error disconnecting account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
