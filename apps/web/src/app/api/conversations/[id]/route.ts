import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { ConversationsRepo } from '@pixell/db-mysql'

const repo = new ConversationsRepo()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id]
 * Get a conversation with all its messages
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    const { id } = await params
    const conversation = await repo.getWithMessages(id, userId)

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json(conversation)
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching conversation:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update a conversation (rename, change visibility)
 * Body: { title?: string, isPublic?: boolean }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    const { id } = await params
    const body = await request.json()
    const { title, isPublic } = body

    // Validate that at least one field is being updated
    if (title === undefined && isPublic === undefined) {
      return NextResponse.json(
        { error: 'No fields to update. Provide title or isPublic.' },
        { status: 400 }
      )
    }

    const conversation = await repo.update(id, userId, { title, isPublic })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or not authorized to update' },
        { status: 404 }
      )
    }

    return NextResponse.json(conversation)
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error updating conversation:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

/**
 * DELETE /api/conversations/[id]
 * Soft delete a conversation (only owner, only private conversations)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    const { id } = await params
    const deleted = await repo.softDelete(id, userId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Cannot delete: conversation not found, not owned by you, or is public' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting conversation:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
