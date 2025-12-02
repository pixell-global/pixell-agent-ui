/**
 * POST /api/activities/[id]/retry
 * Retry a failed or cancelled activity
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { activities, activitySteps } from '@pixell/db-mysql/schema'
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

    const retryableStatuses = ['failed', 'cancelled']
    if (!retryableStatuses.includes(existing.status)) {
      return NextResponse.json(
        { error: 'Only failed or cancelled activities can be retried' },
        { status: 400 }
      )
    }

    // Reset activity to pending
    await db
      .update(activities)
      .set({
        status: 'pending',
        progress: 0,
        progressMessage: null,
        startedAt: null,
        completedAt: null,
        actualDurationMs: null,
        result: null,
        errorMessage: null,
        errorCode: null,
      })
      .where(eq(activities.id, id))

    // Reset all steps to pending
    await db
      .update(activitySteps)
      .set({
        status: 'pending',
        startedAt: null,
        completedAt: null,
        result: null,
        errorMessage: null,
      })
      .where(eq(activitySteps.activityId, id))

    const [updated] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id))

    return NextResponse.json({ activity: updated })
  } catch (error) {
    console.error('[Activities] Error retrying activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
