import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { and, eq } from 'drizzle-orm'
import { getDb, users, organizations, organizationMembers, brands, orgSettings } from '@pixell/db-mysql'

export async function GET(request: NextRequest) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(cookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = await verifySessionCookie(sessionCookie)
    const uid = decoded.sub
    const email = (decoded as any)?.email as string | undefined
    const displayName = (decoded as any)?.name as string | undefined

    const db = await getDb()

    // Ensure user exists
    const existing = await db.select().from(users).where(eq(users.id, uid)).limit(1)
    if (existing.length === 0) {
      await db.insert(users).values({ id: uid, email: email || uid, displayName: displayName || null })
    }

    // Resolve org
    const orgCookie = request.cookies.get('ORG')?.value
    let orgId = orgCookie || null
    if (!orgId) {
      const memberships = await db
        .select({ orgId: organizationMembers.orgId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, uid), eq(organizationMembers.isDeleted, 0)))
        .limit(1)
      orgId = memberships[0]?.orgId || null
    }

    if (!orgId) {
      return NextResponse.json({ step: 'need_org', orgId: null, brandId: null })
    }

    // Check brands access/policy
    const settings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId)).limit(1)
    const requireBrand = settings[0]?.requireBrandContext === 1
    const brand = await db.select().from(brands).where(and(eq(brands.orgId, orgId), eq(brands.isDeleted, 0))).limit(1)
    if (requireBrand || brand.length === 0) {
      return NextResponse.json({ step: 'need_brand', orgId, brandId: null })
    }

    // Stripe subscription enforced via organizations.subscriptionStatus
    const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    const sub = org[0]?.subscriptionStatus || 'incomplete'
    if (sub !== 'active' && sub !== 'trialing') {
      return NextResponse.json({ step: 'need_subscription', orgId, brandId: brand[0]?.id || null })
    }

    return NextResponse.json({ step: 'complete', orgId, brandId: brand[0]?.id || null })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


