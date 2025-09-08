import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { z } from 'zod'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, orgInvitations, organizationMembers } from '@pixell/db-mysql'
import { addDays } from 'date-fns'
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

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  metadata: z
    .object({
      teams: z.array(z.object({ teamId: z.string(), role: z.enum(['lead', 'member', 'viewer']).optional() })).optional(),
      brands: z.array(z.object({ brandId: z.string(), role: z.enum(['manager', 'editor', 'analyst', 'viewer']).optional() })).optional(),
    })
    .partial()
    .optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
})

export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const orgId = await getCurrentUserOrg(decoded.sub)
    if (!orgId) return NextResponse.json({ error: 'User not in any organization' }, { status: 400 })

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { email, role, metadata, expiresInDays } = parsed.data

    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = addDays(new Date(), expiresInDays)

    const db = await getDb()
    await db.insert(orgInvitations).values({
      id: randomBytes(16).toString('hex'),
      orgId,
      email,
      role,
      token,
      tokenHash,
      expiresAt,
      metadata: metadata || null,
    })

    const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    const inviteUrl = `${base}/accept-invite?token=${token}`
    return NextResponse.json({ inviteUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


