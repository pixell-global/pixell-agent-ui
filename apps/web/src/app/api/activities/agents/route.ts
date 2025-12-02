/**
 * GET /api/activities/agents
 * Get distinct agents for filter dropdown
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

    // Get distinct agents with activity counts
    const agents = await db
      .select({
        agentId: activities.agentId,
        count: sql<number>`count(*)`.as('count'),
        lastUsed: sql<Date>`max(${activities.createdAt})`.as('lastUsed'),
      })
      .from(activities)
      .where(and(
        eq(activities.userId, session.sub),
        isNull(activities.archivedAt),
        sql`${activities.agentId} IS NOT NULL`
      ))
      .groupBy(activities.agentId)
      .orderBy(sql`count(*) DESC`)

    return NextResponse.json({
      agents: agents.map(a => ({
        id: a.agentId,
        activityCount: Number(a.count),
        lastUsed: a.lastUsed,
      })),
    })
  } catch (error) {
    console.error('[Activities] Error fetching agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
