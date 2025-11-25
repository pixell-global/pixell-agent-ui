/**
 * GET /api/oauth/actions/pending
 *
 * Get pending actions that require user approval.
 * Filters by conversation ID if provided.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/supabase-auth'
import { getDb } from '@pixell/db-mysql'
import { pendingActions, pendingActionItems, externalAccounts } from '@pixell/db-mysql/schema'
import { eq, and, inArray } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    const db = await getDb()

    // Build query conditions
    const conditions = [eq(pendingActions.orgId, session.user.orgId!)]

    if (conversationId) {
      conditions.push(eq(pendingActions.conversationId, conversationId))
    }

    // Get pending actions
    const actions = await db
      .select()
      .from(pendingActions)
      .where(and(...conditions))
      .orderBy(pendingActions.createdAt)

    // Get all action IDs
    const actionIds = actions.map((a) => a.id)

    if (actionIds.length === 0) {
      return NextResponse.json({
        actions: [],
        total: 0,
        hasMore: false,
      })
    }

    // Get items for all actions
    const items = await db
      .select()
      .from(pendingActionItems)
      .where(inArray(pendingActionItems.actionId, actionIds))

    // Get account info
    const accountIds = [...new Set(actions.map((a) => a.accountId))]
    const accounts = await db
      .select({
        id: externalAccounts.id,
        provider: externalAccounts.provider,
        providerUsername: externalAccounts.providerUsername,
        displayName: externalAccounts.displayName,
        avatarUrl: externalAccounts.avatarUrl,
      })
      .from(externalAccounts)
      .where(inArray(externalAccounts.id, accountIds))

    // Map accounts by ID
    const accountsMap = new Map(accounts.map((a) => [a.id, a]))

    // Combine actions with items and account info
    const actionsWithItems = actions.map((action) => ({
      ...action,
      items: items.filter((item) => item.actionId === action.id),
      account: accountsMap.get(action.accountId),
    }))

    return NextResponse.json({
      actions: actionsWithItems,
      total: actionsWithItems.length,
      hasMore: false,
    })
  } catch (error) {
    console.error('[OAuth Actions] Error fetching pending actions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
