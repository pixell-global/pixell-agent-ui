import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { and, eq } from 'drizzle-orm'
import { getDb, organizations, organizationMembers } from '@pixell/db-mysql'

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const db = await getDb()
    const rows = await db
      .select({ id: organizations.id, name: organizations.name, role: organizationMembers.role })
      .from(organizations)
      .innerJoin(organizationMembers, and(eq(organizations.id, organizationMembers.orgId), eq(organizationMembers.userId, decoded.sub), eq(organizationMembers.isDeleted, 0)))

    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


