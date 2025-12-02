/**
 * POST /api/activities/[id]/cancel
 * Cancel an activity (pending, running, or paused)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { activities } from '@pixell/db-mysql/schema'
import { eq, and } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function getSession(request: NextRequest) {
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
  const sessionCookie = request.cookies.get(sessionCookieName)?.value
  if (!sessionCookie) return null
  try {
    return await verifySessionCookie(sessionCookie)
  } catch {
    return null
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const db = await getDb()

    // Verify activity exists
    const [existing] = await db
      .select()
      .from(activities)
      .where(and(
        eq(activities.id, id),
        eq(activities.userId, session.sub)
      ))

    if (!existing) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const cancellableStatuses = ['pending', 'running', 'paused']
    if (!cancellableStatuses.includes(existing.status)) {
      return NextResponse.json(
        { error: 'Only pending, running, or paused activities can be cancelled' },
        { status: 400 }
      )
    }

    await db
      .update(activities)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(activities.id, id))

    const [updated] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id))

    return NextResponse.json({ activity: updated })
  } catch (error) {
    console.error('[Activities] Error cancelling activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
