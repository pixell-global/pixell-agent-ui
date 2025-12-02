import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { ConversationsRepo } from '@pixell/db-mysql'

const repo = new ConversationsRepo()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/conversations/[id]/generate-title
 * Generate an AI title for the conversation based on its first messages
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

    // Check conversation exists and user has access
    const conversation = await repo.getById(conversationId)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Only owner can trigger title generation
    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    // Check if title generation is needed
    const needsTitle = await repo.needsTitleGeneration(conversationId)
    if (!needsTitle && conversation.title) {
      return NextResponse.json({
        title: conversation.title,
        generated: false,
        message: 'Title already exists',
      })
    }

    // Get first 3 messages
    const messages = await repo.getFirstMessages(conversationId, 3)
    if (messages.length < 2) {
      return NextResponse.json({
        title: null,
        generated: false,
        message: 'Not enough messages to generate title',
      })
    }

    // Build prompt for title generation
    const conversationContext = messages
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const titlePrompt = `Based on the following conversation, generate a concise title (3-6 words) that captures the main topic or purpose. Only respond with the title, nothing else.

Conversation:
${conversationContext}

Title:`

    // Call orchestrator to generate title
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'

    const response = await fetch(`${orchestratorUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: titlePrompt,
        history: [],
        settings: {
          showThinking: false,
          enableMarkdown: false,
          streamingEnabled: false,
        },
      }),
    })

    if (!response.ok) {
      console.error('Orchestrator error for title generation:', response.status)
      // Fallback: use first message content
      const fallbackTitle = messages[0].content.slice(0, 50).trim() + (messages[0].content.length > 50 ? '...' : '')
      await repo.updateTitle(conversationId, fallbackTitle, 'auto')
      return NextResponse.json({
        title: fallbackTitle,
        generated: true,
        fallback: true,
      })
    }

    // Parse SSE response to get the generated title
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    let fullContent = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'content' && data.delta?.content) {
              fullContent += data.delta.content
            } else if (data.type === 'complete' && data.accumulated) {
              fullContent = data.accumulated
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    // Clean up the title
    let title = fullContent.trim()
    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '')
    // Limit length
    title = title.slice(0, 100)

    if (!title) {
      // Fallback to first message
      title = messages[0].content.slice(0, 50).trim() + (messages[0].content.length > 50 ? '...' : '')
    }

    // Update the conversation
    await repo.updateTitle(conversationId, title, 'auto')

    return NextResponse.json({
      title,
      generated: true,
    })
  } catch (err: any) {
    if (
      err?.code === 'auth/session-cookie-expired' ||
      err?.code === 'auth/invalid-session-cookie'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error generating title:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
