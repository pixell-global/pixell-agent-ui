import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { and, eq } from 'drizzle-orm'
import { getDb, teamMembers, organizationMembers, userBrandAccess, users } from '@pixell/db-mysql'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const db = await getDb()

    // Try to resolve Firebase user id by email
    let uid: string | null = null
    try {
      const userRec = await getAuth().getUserByEmail(email)
      uid = userRec.uid
    } catch {}

    // If we have uid, delete auth user first
    if (uid) {
      try { await getAuth().deleteUser(uid) } catch {}
    }

    // Cleanup DB rows using uid if available, else by email → resolve id first
    let userId = uid
    if (!userId) {
      const row = await db.select().from(users).where(eq(users.email, email)).limit(1)
      userId = row[0]?.id || null
    }

    if (userId) {
      await db.delete(teamMembers).where(eq(teamMembers.userId, userId))
      await db.update(organizationMembers).set({ isDeleted: 1 }).where(eq(organizationMembers.userId, userId))
      await db.delete(userBrandAccess).where(eq(userBrandAccess.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
    } else {
      // No id found: still try to delete users row by email as a fallback
      await db.delete(users).where(eq(users.email, email))
    }

    return NextResponse.json({ ok: true, uid: userId })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete user' }, { status: 500 })
  }
}


