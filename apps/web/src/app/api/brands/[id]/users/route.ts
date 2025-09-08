import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { BrandsRepo } from '@pixell/db-mysql'

const repo = new BrandsRepo()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await verifySessionCookie(sessionCookie)

    const { userId, role } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    await repo.grantUser(params.id, userId, role)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await verifySessionCookie(sessionCookie)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    await repo.revokeUser(params.id, userId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


