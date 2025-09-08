import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import { getDb, orgInvitations, organizations } from '@pixell/db-mysql'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const db = await getDb()

    const inv = await db
      .select({ id: orgInvitations.id, orgId: orgInvitations.orgId, role: orgInvitations.role, expiresAt: orgInvitations.expiresAt, metadata: orgInvitations.metadata })
      .from(orgInvitations)
      .where(and(eq(orgInvitations.tokenHash, tokenHash), eq(orgInvitations.isDeleted, 0), gt(orgInvitations.expiresAt, new Date())))
      .limit(1)

    if (inv.length === 0) return NextResponse.json({ error: 'Invalid or expired' }, { status: 404 })

    const org = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, inv[0].orgId))
      .limit(1)

    return NextResponse.json({ orgName: org[0]?.name ?? 'Organization', role: inv[0].role, metadata: inv[0].metadata })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


