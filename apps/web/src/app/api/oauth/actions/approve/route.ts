/**
 * POST /api/oauth/actions/approve
 *
 * Approve a pending action or specific items within it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/supabase-auth'
import { getDb } from '@pixell/db-mysql'
import { pendingActions, pendingActionItems } from '@pixell/db-mysql/schema'
import { eq, and, inArray } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { actionId, itemIds } = body

    if (!actionId) {
      return NextResponse.json({ error: 'Missing actionId' }, { status: 400 })
    }

    const db = await getDb()

    // Verify action belongs to user's org
    const [action] = await db
      .select()
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.id, actionId),
          eq(pendingActions.orgId, session.user.orgId!)
        )
      )
      .limit(1)

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    if (action.status !== 'pending') {
      return NextResponse.json(
        { error: `Action is ${action.status}, cannot approve` },
        { status: 400 }
      )
    }

    // Check if expired
    if (action.expiresAt && new Date(action.expiresAt) < new Date()) {
      await db
        .update(pendingActions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(pendingActions.id, actionId))

      return NextResponse.json({ error: 'Action has expired' }, { status: 400 })
    }

    const now = new Date()

    // If specific items provided, approve only those
    if (itemIds && itemIds.length > 0) {
      await db
        .update(pendingActionItems)
        .set({ status: 'approved', updatedAt: now })
        .where(
          and(
            eq(pendingActionItems.actionId, actionId),
            inArray(pendingActionItems.id, itemIds)
          )
        )
    } else {
      // Approve all pending items
      await db
        .update(pendingActionItems)
        .set({ status: 'approved', updatedAt: now })
        .where(
          and(
            eq(pendingActionItems.actionId, actionId),
            eq(pendingActionItems.status, 'pending')
          )
        )
    }

    // Check if all items are now approved/processed
    const remainingPending = await db
      .select()
      .from(pendingActionItems)
      .where(
        and(
          eq(pendingActionItems.actionId, actionId),
          eq(pendingActionItems.status, 'pending')
        )
      )

    // If no pending items left, mark action as approved
    if (remainingPending.length === 0) {
      await db
        .update(pendingActions)
        .set({
          status: 'approved',
          approvedBy: session.user.id,
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(pendingActions.id, actionId))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OAuth Actions] Error approving action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
