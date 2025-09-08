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

    const { teamId, role } = await request.json()
    if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 })

    await repo.assignTeam(params.id, teamId, role)
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
    const teamId = searchParams.get('teamId')
    if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 })

    await repo.revokeTeam(params.id, teamId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


