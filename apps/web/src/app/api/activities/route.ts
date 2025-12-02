/**
 * GET /api/activities
 * List activities with filtering, sorting, and pagination
 *
 * POST /api/activities
 * Create a new activity (typically called by core agent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb } from '@pixell/db-mysql'
import { activities } from '@pixell/db-mysql/schema'
import { eq, and, desc, asc, isNull, isNotNull, inArray, like, or, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Valid filter values
const VALID_STATUSES = ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'] as const
const VALID_TYPES = ['task', 'scheduled', 'workflow'] as const
const VALID_SORT_FIELDS = ['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'name', 'priority'] as const
const VALID_SORT_ORDERS = ['asc', 'desc'] as const

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

    const { searchParams } = new URL(req.url)

    // Pagination
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    // Filters
    const statusFilter = searchParams.getAll('status').filter(s => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]))
    const typeFilter = searchParams.getAll('type').filter(t => VALID_TYPES.includes(t as typeof VALID_TYPES[number]))
    const agentFilter = searchParams.getAll('agent')
    const search = searchParams.get('search')?.trim()
    const showArchived = searchParams.get('archived') === 'true'

    // Sorting
    const sortBy = (VALID_SORT_FIELDS.includes(searchParams.get('sortBy') as typeof VALID_SORT_FIELDS[number])
      ? searchParams.get('sortBy')
      : 'createdAt') as typeof VALID_SORT_FIELDS[number]
    const sortOrder = (VALID_SORT_ORDERS.includes(searchParams.get('sortOrder') as typeof VALID_SORT_ORDERS[number])
      ? searchParams.get('sortOrder')
      : 'desc') as typeof VALID_SORT_ORDERS[number]

    const db = await getDb()

    // Build query conditions - use userId from Firebase session
    const conditions = [eq(activities.userId, session.sub)]

    // Archived filter
    if (showArchived) {
      conditions.push(isNotNull(activities.archivedAt))
    } else {
      conditions.push(isNull(activities.archivedAt))
    }

    // Status filter (multi-select)
    if (statusFilter.length > 0) {
      conditions.push(inArray(activities.status, statusFilter as typeof VALID_STATUSES[number][]))
    }

    // Type filter (multi-select)
    if (typeFilter.length > 0) {
      conditions.push(inArray(activities.activityType, typeFilter as typeof VALID_TYPES[number][]))
    }

    // Agent filter (multi-select)
    if (agentFilter.length > 0) {
      conditions.push(inArray(activities.agentId, agentFilter))
    }

    // Search filter (name or description)
    if (search) {
      conditions.push(
        or(
          like(activities.name, `%${search}%`),
          like(activities.description, `%${search}%`)
        )!
      )
    }

    // Cursor-based pagination
    if (cursor) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
        const sortColumn = activities[sortBy as keyof typeof activities]
        if (sortOrder === 'desc') {
          conditions.push(
            or(
              sql`${sortColumn} < ${cursorData.sortValue}`,
              and(sql`${sortColumn} = ${cursorData.sortValue}`, sql`${activities.id} < ${cursorData.id}`)
            )!
          )
        } else {
          conditions.push(
            or(
              sql`${sortColumn} > ${cursorData.sortValue}`,
              and(sql`${sortColumn} = ${cursorData.sortValue}`, sql`${activities.id} > ${cursorData.id}`)
            )!
          )
        }
      } catch {
        // Invalid cursor, ignore
      }
    }

    // Build order by
    const sortColumn = activities[sortBy as keyof typeof activities]
    const orderByClause = sortOrder === 'desc'
      ? [desc(sortColumn as typeof activities.createdAt), desc(activities.id)]
      : [asc(sortColumn as typeof activities.createdAt), asc(activities.id)]

    // Execute query
    const results = await db
      .select()
      .from(activities)
      .where(and(...conditions))
      .orderBy(...orderByClause)
      .limit(limit + 1)

    // Check if there are more results
    const hasMore = results.length > limit
    const items = hasMore ? results.slice(0, limit) : results

    // Generate next cursor
    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]
      const sortValue = lastItem[sortBy as keyof typeof lastItem]
      nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id, sortValue })).toString('base64')
    }

    return NextResponse.json({
      activities: items,
      cursor: nextCursor,
      hasMore,
    })
  } catch (error) {
    console.error('[Activities] Error fetching activities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const db = await getDb()

    const newActivity = {
      id: body.id || randomUUID(),
      orgId: body.orgId || session.sub, // Use provided orgId or fallback to userId
      userId: session.sub,
      conversationId: body.conversationId || null,
      agentId: body.agentId || null,
      name: body.name,
      description: body.description || null,
      activityType: body.activityType || 'task',
      status: body.status || 'pending',
      progress: body.progress || 0,
      progressMessage: body.progressMessage || null,
      scheduleCron: body.scheduleCron || null,
      scheduleNextRun: body.scheduleNextRun ? new Date(body.scheduleNextRun) : null,
      scheduleTimezone: body.scheduleTimezone || 'UTC',
      estimatedDurationMs: body.estimatedDurationMs || null,
      metadata: body.metadata || null,
      tags: body.tags || null,
      priority: body.priority || 0,
    }

    await db.insert(activities).values(newActivity)

    // Fetch the created activity
    const [created] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, newActivity.id))

    return NextResponse.json({ activity: created }, { status: 201 })
  } catch (error) {
    console.error('[Activities] Error creating activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
