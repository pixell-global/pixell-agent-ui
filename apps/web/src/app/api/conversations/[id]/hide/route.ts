import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { ConversationsRepo } from '@pixell/db-mysql'

const repo = new ConversationsRepo()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/hide
 * Hide or unhide a public organization conversation
 * Body: { hidden: boolean }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    const { id: conversationId } = await params
    const body = await request.json()
    const { hidden } = body

    if (typeof hidden !== 'boolean') {
      return NextResponse.json(
        { error: 'hidden must be a boolean' },
        { status: 400 }
      )
    }

    let success: boolean
    if (hidden) {
      success = await repo.hideConversation(userId, conversationId)
    } else {
      success = await repo.unhideConversation(userId, conversationId)
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Cannot hide/unhide: conversation not found, not public, or you own it' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, hidden })
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error hiding/unhiding conversation:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
