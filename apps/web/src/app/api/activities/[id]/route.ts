/**
 * GET /api/activities/[id]
 * Get a single activity with steps and approval requests
 *
 * PATCH /api/activities/[id]
 * Update an activity
 *
 * DELETE /api/activities/[id]
 * Delete an activity (hard delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { activities, activitySteps, activityApprovalRequests } from '@pixell/db-mysql/schema'
import { eq, and, asc } from 'drizzle-orm'

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

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const db = await getDb()

    // Get activity
    const [activity] = await db
      .select()
      .from(activities)
      .where(and(
        eq(activities.id, id),
        eq(activities.userId, session.sub)
      ))

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    // Get steps
    const steps = await db
      .select()
      .from(activitySteps)
      .where(eq(activitySteps.activityId, id))
      .orderBy(asc(activitySteps.stepOrder))

    // Get approval requests
    const approvalRequests = await db
      .select()
      .from(activityApprovalRequests)
      .where(eq(activityApprovalRequests.activityId, id))
      .orderBy(asc(activityApprovalRequests.createdAt))

    return NextResponse.json({
      activity: {
        ...activity,
        steps,
        approvalRequests,
      },
    })
  } catch (error) {
    console.error('[Activities] Error fetching activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const db = await getDb()

    // Verify activity exists and belongs to user
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

    // Build update object with only allowed fields
    const allowedFields = [
      'name', 'description', 'status', 'progress', 'progressMessage',
      'scheduleCron', 'scheduleNextRun', 'scheduleTimezone',
      'startedAt', 'completedAt', 'estimatedDurationMs', 'actualDurationMs',
      'result', 'errorMessage', 'errorCode', 'metadata', 'tags', 'priority'
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Handle date fields
        if (['scheduleNextRun', 'startedAt', 'completedAt'].includes(field) && body[field]) {
          updates[field] = new Date(body[field])
        } else {
          updates[field] = body[field]
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await db
      .update(activities)
      .set(updates)
      .where(eq(activities.id, id))

    // Fetch updated activity
    const [updated] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id))

    return NextResponse.json({ activity: updated })
  } catch (error) {
    console.error('[Activities] Error updating activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const db = await getDb()

    // Verify activity exists and belongs to user
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

    // Delete related records first
    await db.delete(activityApprovalRequests).where(eq(activityApprovalRequests.activityId, id))
    await db.delete(activitySteps).where(eq(activitySteps.activityId, id))
    await db.delete(activities).where(eq(activities.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Activities] Error deleting activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
