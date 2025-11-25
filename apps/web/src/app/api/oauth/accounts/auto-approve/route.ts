/**
 * POST /api/oauth/accounts/auto-approve
 *
 * Update the auto-approve setting for an account
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/supabase-auth'
import { externalAccountsManager } from '@/lib/oauth/external-accounts-manager'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { accountId, autoApprove } = body

    if (!accountId || typeof autoApprove !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: accountId and autoApprove boolean required' },
        { status: 400 }
      )
    }

    // Verify account belongs to this org
    const account = await externalAccountsManager.getAccountById(
      accountId,
      session.user.orgId
    )

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await externalAccountsManager.updateAutoApprove(
      accountId,
      session.user.orgId,
      autoApprove
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OAuth AutoApprove] Error updating auto-approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
