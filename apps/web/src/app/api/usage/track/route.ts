import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, actionEvents, organizationMembers } from '@pixell/db-mysql'
import { and, eq } from 'drizzle-orm'

async function getCurrentUserOrg(userId: string): Promise<string | null> {
  const db = await getDb()
  const memberships = await db
    .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
    .orderBy(organizationMembers.role) // owner/admin first, then member/viewer
  
  return memberships[0]?.orgId || null
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const orgId = await getCurrentUserOrg(decoded.sub)
    if (!orgId) return NextResponse.json({ error: 'User not in any organization' }, { status: 400 })

    const { actionKey, units, metadata, idempotencyKey, brandId: bodyBrandId, appId } = await request.json()
    if (!actionKey) return NextResponse.json({ error: 'actionKey is required' }, { status: 400 })

    const brandIdHeader = request.headers.get('x-brand-id') || undefined
    const brandId = bodyBrandId || brandIdHeader

    const db = await getDb()
    await db.insert(actionEvents).values({
      orgId,
      userId: decoded.sub,
      actionKey,
      units: typeof units === 'number' ? units : 1,
      metadata: metadata || null,
      idempotencyKey: idempotencyKey || null,
      brandId: brandId || null,
      appId: appId || null,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


