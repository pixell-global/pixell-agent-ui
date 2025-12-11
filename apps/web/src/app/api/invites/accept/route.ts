import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { createHash } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import { getDb, orgInvitations, organizationMembers, users, teamMembers, userBrandAccess } from '@pixell/db-mysql'

export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)
    const uid = decoded.sub
    const email = (decoded as any).email as string | undefined
    const displayName = (decoded as any).name as string | undefined

    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const db = await getDb()

    const inv = await db.select().from(orgInvitations).where(and(eq(orgInvitations.tokenHash, tokenHash), eq(orgInvitations.isDeleted, 0), gt(orgInvitations.expiresAt, new Date()))).limit(1)
    if (inv.length === 0) return NextResponse.json({ error: 'Invalid or expired' }, { status: 404 })

    // Optional: enforce email match if invitation has email
    if (inv[0].email && email && inv[0].email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 })
    }

    // Upsert user
    const existing = await db.select().from(users).where(eq(users.id, uid)).limit(1)
    if (existing.length === 0) await db.insert(users).values({ id: uid, email: email || uid, displayName: displayName || null })

    // Add org membership
    await db
      .insert(organizationMembers)
      .values({ orgId: inv[0].orgId, userId: uid, role: inv[0].role as any })
      .onDuplicateKeyUpdate({ set: { role: inv[0].role as any } })

    // Apply assignments
    const meta: any = inv[0].metadata || {}
    if (Array.isArray(meta.teams)) {
      for (const t of meta.teams) {
        await db
          .insert(teamMembers)
          .values({ teamId: t.teamId, userId: uid, role: (t.role || 'member') as any })
          .onDuplicateKeyUpdate({ set: { role: (t.role || 'member') as any } })
      }
    }
    if (Array.isArray(meta.brands)) {
      for (const b of meta.brands) {
        await db
          .insert(userBrandAccess)
          .values({ brandId: b.brandId, userId: uid, role: (b.role || 'viewer') as any })
          .onDuplicateKeyUpdate({ set: { role: (b.role || 'viewer') as any } })
      }
    }

    // Mark invitation as used (soft delete)
    await db.update(orgInvitations).set({ isDeleted: 1 }).where(eq(orgInvitations.id, inv[0].id))

    const response = NextResponse.json({ orgId: inv[0].orgId })
    response.cookies.set('ORG', inv[0].orgId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    })
    return response
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


