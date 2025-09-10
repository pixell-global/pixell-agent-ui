import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, brands } from '@pixell/db-mysql'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await verifySessionCookie(sessionCookie)

    const { id } = await params
    const db = await getDb()
    const rows = await db.select().from(brands).where(eq(brands.id, id)).limit(1)
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await verifySessionCookie(sessionCookie)

    const { id } = await params
    const body = await request.json()
    const set: any = {}
    if (typeof body.name === 'string') set.name = body.name
    if (typeof body.code === 'string') set.code = body.code
    if (typeof body.metadata !== 'undefined') set.metadata = body.metadata
    if (Object.keys(set).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const db = await getDb()
    await db.update(brands).set(set).where(eq(brands.id, id))
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await verifySessionCookie(sessionCookie)

    const { id } = await params
    const db = await getDb()
    await db.update(brands).set({ isDeleted: 1 }).where(eq(brands.id, id))
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


