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

    const body = await request.json()
    const { name, primaryTeamId, metadata } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const brand = await repo.create(name, undefined, primaryTeamId, metadata, decoded.sub)
    return NextResponse.json(brand)
  } catch (err: any) {
    if (err?.code === 'auth/session-cookie-expired' || err?.code === 'auth/invalid-session-cookie') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await verifySessionCookie(sessionCookie)

    const brands = await repo.listByUser(decoded.sub)
    
    if (brands.length === 0) {
      return NextResponse.json({ error: 'No brands found for user' }, { status: 404 })
    }
    
    return NextResponse.json(brands)
  } catch (err: any) {
    if (err?.code === 'auth/session-cookie-expired' || err?.code === 'auth/invalid-session-cookie') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}


