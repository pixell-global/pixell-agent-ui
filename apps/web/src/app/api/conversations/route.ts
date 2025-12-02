import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { ConversationsRepo } from '@pixell/db-mysql'

const repo = new ConversationsRepo()

/**
 * GET /api/conversations
 * List conversations for the current user
 * Query params:
 *   - tab: 'my-chats' | 'organization' (default: 'my-chats')
 *   - search: optional search query
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'my-chats'
    const search = searchParams.get('search') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let conversations
    if (tab === 'organization') {
      conversations = await repo.listOrgPublic(userId, { search, limit, offset })
    } else {
      conversations = await repo.listByUser(userId, { search, limit, offset })
    }

    return NextResponse.json({
      conversations,
      hasMore: conversations.length === limit,
    })
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error listing conversations:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 * Body: { title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    const body = await request.json().catch(() => ({}))
    const { title } = body

    const conversation = await repo.create(userId, title)
    return NextResponse.json(conversation, { status: 201 })
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating conversation:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
