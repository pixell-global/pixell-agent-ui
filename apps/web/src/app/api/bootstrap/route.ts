import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, users, organizations, organizationMembers } from '@pixell/db-mysql'
import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { createSubscription } from '@/lib/billing/subscription-manager'

export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = await verifySessionCookie(sessionCookie)
    const uid = decoded.sub
    const email = (decoded as any).email as string | undefined
    const displayName = (decoded as any).name as string | undefined

    const { orgName } = await request.json()
    if (!orgName) return NextResponse.json({ error: 'Organization name required' }, { status: 400 })

    const db = await getDb()

    // Upsert user
    const existing = await db.select().from(users).where(eq(users.id, uid)).limit(1)
    if (existing.length === 0) {
      await db.insert(users).values({ id: uid, email: email || uid, displayName: displayName || null })
    }

    // Create organization
    const orgId = randomUUID()
    await db.insert(organizations).values({ id: orgId, name: orgName, createdBy: uid, subscriptionStatus: 'incomplete' as any })

    // Add membership as owner
    await db.insert(organizationMembers).values({ orgId, userId: uid, role: 'owner' })

    // Create free tier subscription with credit balance
    await createSubscription({
      orgId,
      orgName,
      userEmail: email || uid,
      tier: 'free',
    })

    const response = NextResponse.json({ orgId })
    response.cookies.set('ORG', orgId, {
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


