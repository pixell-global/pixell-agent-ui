import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, orgSettings, organizationMembers } from '@pixell/db-mysql'
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

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const orgId = await getCurrentUserOrg(decoded.sub)
    if (!orgId) return NextResponse.json({ error: 'User not in any organization' }, { status: 400 })

    const db = await getDb()
    const rows = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId)).limit(1)
    const data = rows[0] || { orgId, brandAccessMode: 'shared', requireBrandContext: 1 }
    return NextResponse.json({ brandAccessMode: data.brandAccessMode, requireBrandContext: data.requireBrandContext === 1 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const orgId = await getCurrentUserOrg(decoded.sub)
    if (!orgId) return NextResponse.json({ error: 'User not in any organization' }, { status: 400 })

    const { brandAccessMode, requireBrandContext } = await request.json()
    const db = await getDb()
    const rows = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId)).limit(1)
    if (rows.length === 0) {
      await db.insert(orgSettings).values({
        orgId,
        brandAccessMode: brandAccessMode === 'isolated' ? 'isolated' : 'shared',
        requireBrandContext: requireBrandContext ? 1 : 0,
      })
    } else {
      await db
        .update(orgSettings)
        .set({
          brandAccessMode: brandAccessMode === 'isolated' ? 'isolated' : 'shared',
          requireBrandContext: requireBrandContext ? 1 : 0,
        })
        .where(eq(orgSettings.orgId, orgId))
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


