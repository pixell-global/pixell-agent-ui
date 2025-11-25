/**
 * POST /api/oauth/actions/edit-item
 *
 * Edit the content of a pending action item.
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
    const { itemId, content } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 })
    }

    const db = await getDb()

    // Get item and verify it belongs to user's org
    const [item] = await db
      .select()
      .from(pendingActionItems)
      .where(eq(pendingActionItems.id, itemId))
      .limit(1)

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify the parent action belongs to user's org
    const [action] = await db
      .select()
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.id, item.actionId),
          eq(pendingActions.orgId, session.user.orgId!)
        )
      )
      .limit(1)

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    if (action.status !== 'pending') {
      return NextResponse.json(
        { error: `Action is ${action.status}, cannot edit` },
        { status: 400 }
      )
    }

    if (item.status !== 'pending' && item.status !== 'edited') {
      return NextResponse.json(
        { error: `Item is ${item.status}, cannot edit` },
        { status: 400 }
      )
    }

    // Update item with edited content
    await db
      .update(pendingActionItems)
      .set({
        editedContent: content.trim(),
        status: 'edited',
        updatedAt: new Date(),
      })
      .where(eq(pendingActionItems.id, itemId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[OAuth Actions] Error editing item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
