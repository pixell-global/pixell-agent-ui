import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getAuth } from 'firebase-admin/auth'
import { and, eq } from 'drizzle-orm'
import { getDb, teamMembers, organizationMembers, userBrandAccess, users } from '@pixell/db-mysql'

export async function DELETE(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
  const sessionCookie = request.cookies.get(cookieName)?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const decoded = await verifySessionCookie(sessionCookie)
    const uid = decoded.sub

    const db = await getDb()

    // Clean related rows first (defensive even with some FKs)
    await db.delete(teamMembers).where(eq(teamMembers.userId, uid))
    await db.update(organizationMembers).set({ isDeleted: 1 }).where(eq(organizationMembers.userId, uid))
    await db.delete(userBrandAccess).where(eq(userBrandAccess.userId, uid))
    await db.delete(users).where(eq(users.id, uid))

    // Delete from Firebase Auth (admin SDK already initialized by verify step)
    await getAuth().deleteUser(uid)

    // Clear session cookie
    const res = NextResponse.json({ ok: true })
    res.cookies.set(cookieName, '', { path: '/', expires: new Date(0), sameSite: 'lax' })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete account' }, { status: 500 })
  }
}


