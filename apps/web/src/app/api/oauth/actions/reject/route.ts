/**
 * POST /api/oauth/actions/reject
 *
 * Reject a pending action.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/supabase-auth'
import { getDb } from '@pixell/db-mysql'
import { pendingActions, pendingActionItems } from '@pixell/db-mysql/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { actionId, reason } = body

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
        { error: `Action is ${action.status}, cannot reject` },
        { status: 400 }
      )
    }

    const now = new Date()

    // Update action status to rejected
    await db
      .update(pendingActions)
      .set({
        status: 'rejected',
        reviewedAt: now,
      })
      .where(eq(pendingActions.id, actionId))

    // Mark all items as rejected
    await db
      .update(pendingActionItems)
      .set({ status: 'rejected' })
      .where(eq(pendingActionItems.pendingActionId, actionId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OAuth Actions] Error rejecting action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
