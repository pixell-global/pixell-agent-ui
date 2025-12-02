import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { ConversationsRepo, ConversationMessageMetadata } from '@pixell/db-mysql'

const repo = new ConversationsRepo()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/messages
 * Add a new message to a conversation
 * Body: {
 *   role: 'user' | 'assistant' | 'system'
 *   content: string
 *   metadata?: ConversationMessageMetadata
 * }
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
    const { role, content, metadata } = body

    // Validate required fields
    if (!role || !content) {
      return NextResponse.json(
        { error: 'role and content are required' },
        { status: 400 }
      )
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be user, assistant, or system' },
        { status: 400 }
      )
    }

    // Check user has access to this conversation
    const conversation = await repo.getById(conversationId)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // For now, only conversation owner can add messages
    // TODO: Allow org members to add messages to public conversations
    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to add messages to this conversation' },
        { status: 403 }
      )
    }

    const message = await repo.addMessage(conversationId, {
      role,
      content,
      metadata: metadata as ConversationMessageMetadata | undefined,
    })

    // Check if we need to trigger title generation
    const needsTitle = await repo.needsTitleGeneration(conversationId)

    return NextResponse.json({
      message,
      needsTitleGeneration: needsTitle,
    }, { status: 201 })
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error adding message:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
