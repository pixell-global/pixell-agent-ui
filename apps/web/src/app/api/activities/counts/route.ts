/**
 * GET /api/activities/counts
 * Get counts for filter badges (by status, type, agent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { activities } from '@pixell/db-mysql/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'

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

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()

    // Get counts by status (excluding archived)
    const statusCounts = await db
      .select({
        status: activities.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(activities)
      .where(and(
        eq(activities.userId, session.sub),
        isNull(activities.archivedAt)
      ))
      .groupBy(activities.status)

    // Get counts by type (excluding archived)
    const typeCounts = await db
      .select({
        type: activities.activityType,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(activities)
      .where(and(
        eq(activities.userId, session.sub),
        isNull(activities.archivedAt)
      ))
      .groupBy(activities.activityType)

    // Get counts by agent (excluding archived, only non-null agents)
    const agentCounts = await db
      .select({
        agentId: activities.agentId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(activities)
      .where(and(
        eq(activities.userId, session.sub),
        isNull(activities.archivedAt),
        sql`${activities.agentId} IS NOT NULL`
      ))
      .groupBy(activities.agentId)

    // Get total and archived counts
    const [totalResult] = await db
      .select({
        total: sql<number>`count(*)`.as('total'),
        archived: sql<number>`sum(case when ${activities.archivedAt} is not null then 1 else 0 end)`.as('archived'),
      })
      .from(activities)
      .where(eq(activities.userId, session.sub))

    // Format response
    const byStatus: Record<string, number> = {}
    for (const row of statusCounts) {
      byStatus[row.status] = Number(row.count)
    }

    const byType: Record<string, number> = {}
    for (const row of typeCounts) {
      byType[row.type] = Number(row.count)
    }

    const byAgent: Record<string, number> = {}
    for (const row of agentCounts) {
      if (row.agentId) {
        byAgent[row.agentId] = Number(row.count)
      }
    }

    return NextResponse.json({
      total: Number(totalResult?.total || 0),
      archived: Number(totalResult?.archived || 0),
      byStatus,
      byType,
      byAgent,
    })
  } catch (error) {
    console.error('[Activities] Error fetching counts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
