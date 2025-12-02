/**
 * POST /api/activities/[id]/approvals/[approvalId]/deny
 * Deny an approval request
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { activities, activityApprovalRequests } from '@pixell/db-mysql/schema'
import { eq, and } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ id: string; approvalId: string }>
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

    const { id, approvalId } = await params
    const body = await req.json().catch(() => ({}))
    const db = await getDb()

    // Verify activity exists and belongs to user
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

    // Verify approval request exists and is pending
    const [approvalRequest] = await db
      .select()
      .from(activityApprovalRequests)
      .where(and(
        eq(activityApprovalRequests.id, approvalId),
        eq(activityApprovalRequests.activityId, id)
      ))

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
    }

    if (approvalRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Approval request has already been responded to' },
        { status: 400 }
      )
    }

    // Check if expired
    if (approvalRequest.expiresAt && new Date(approvalRequest.expiresAt) < new Date()) {
      await db
        .update(activityApprovalRequests)
        .set({ status: 'expired' })
        .where(eq(activityApprovalRequests.id, approvalId))

      return NextResponse.json(
        { error: 'Approval request has expired' },
        { status: 400 }
      )
    }

    // Update approval request
    await db
      .update(activityApprovalRequests)
      .set({
        status: 'denied',
        respondedAt: new Date(),
        response: body.reason ? { reason: body.reason } : null,
      })
      .where(eq(activityApprovalRequests.id, approvalId))

    const [updated] = await db
      .select()
      .from(activityApprovalRequests)
      .where(eq(activityApprovalRequests.id, approvalId))

    return NextResponse.json({ approvalRequest: updated })
  } catch (error) {
    console.error('[Activities] Error denying request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
