/**
 * POST /api/oauth/tiktok/callback
 *
 * Handle TikAPI popup OAuth callback
 * Called by frontend after user authorizes in TikAPI popup
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/supabase-auth'
import { externalAccountsManager } from '@/lib/oauth/external-accounts-manager'
import { getProvider } from '@/lib/oauth/providers'
import { getDb } from '@pixell/db-mysql'
import { organizations } from '@pixell/db-mysql/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.orgId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()

    // Plan check - only Pro/Max can connect external accounts
    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, session.user.orgId))
      .limit(1)

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const org = orgs[0]
    if (!['pro', 'max'].includes(org.subscriptionTier)) {
      return NextResponse.json(
        {
          error: 'External account connections require Pro or Max plan',
          requiredPlan: 'pro',
        },
        { status: 403 }
      )
    }

    const body = await req.json()

    // Handle TikAPI popup callback data
    const provider = getProvider('tiktok')
    const callbackData = await provider.handleCallback(body)

    const { accountId, isNew } = await externalAccountsManager.connectAccount(
      session.user.orgId,
      session.user.id,
      'tiktok',
      callbackData
    )

    return NextResponse.json({
      success: true,
      accountId,
      isNew,
      account: {
        provider: 'tiktok',
        username: callbackData.userInfo.username,
        displayName: callbackData.userInfo.displayName,
        avatarUrl: callbackData.userInfo.avatarUrl,
      },
    })
  } catch (error) {
    console.error('[TikTok OAuth] Callback error:', error)
    const message = error instanceof Error ? error.message : 'Failed to connect TikTok account'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
