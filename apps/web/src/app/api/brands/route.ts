import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { BrandsRepo } from '@pixell/db-mysql'

const repo = new BrandsRepo()

export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const orgId = request.headers.get('x-org-id') || request.cookies.get('ORG')?.value
    if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })

    const body = await request.json()
    const { name, primaryTeamId, metadata } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const brand = await repo.create(orgId, name, undefined, primaryTeamId, metadata, decoded.sub)
    return NextResponse.json(brand)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const orgId = request.headers.get('x-org-id') || request.cookies.get('ORG')?.value
    if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })

    const brands = await repo.listByUser(orgId, decoded.sub)
    return NextResponse.json(brands)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


