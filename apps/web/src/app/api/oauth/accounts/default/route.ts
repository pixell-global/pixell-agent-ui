/**
 * POST /api/oauth/accounts/default
 *
 * Set an account as the default for its provider
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
    const { accountId } = body

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verify account belongs to this org
    const account = await externalAccountsManager.getAccountById(
      accountId,
      session.user.orgId
    )

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await externalAccountsManager.setDefaultAccount(accountId, session.user.orgId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OAuth Default] Error setting default account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
