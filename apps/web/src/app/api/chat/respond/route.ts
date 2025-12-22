import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@pixell/auth-firebase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Matches pixell-sdk RespondParams format
interface RespondRequest {
  // Clarification response
  clarificationId?: string
  answers?: Array<{
    questionId: string
    value: string | string[] | number | boolean
  }> | Record<string, unknown>
  // Selection response
  selectionId?: string
  selectedIds?: string[]
  // Plan approval response
  planId?: string
  approved?: boolean
  // Common fields
  agentUrl?: string
  sessionId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RespondRequest = await request.json()

    // Validate that at least one valid response type is present
    const hasValidClarification = body.clarificationId && body.answers
    const hasValidSelection = body.selectionId && body.selectedIds
    const hasValidPlanApproval = body.planId && body.approved !== undefined

    if (!hasValidClarification && !hasValidSelection && !hasValidPlanApproval) {
      return NextResponse.json(
        { error: 'Invalid response format. Must include clarificationId+answers, selectionId+selectedIds, or planId+approved' },
        { status: 400 }
      )
    }

    // Get user ID from Firebase session cookie
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
    const sessionCookie = request.cookies.get(sessionCookieName)?.value
    let userId = ''
    if (sessionCookie) {
      try {
        const decoded = await verifySessionCookie(sessionCookie)
        userId = decoded.sub as string
      } catch { /* Ignore auth errors for unauthenticated users */ }
    }

    // Get org ID from ORG cookie
    const orgId = request.cookies.get('ORG')?.value || ''

    // Forward to orchestrator
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'

    console.log('🔴 [respond/route] Forwarding to orchestrator:', {
      userId: userId || '(missing)',
      orgId: orgId || '(missing)',
      sessionId: body.sessionId || '(missing)',
      agentUrl: body.agentUrl || '(missing)',
      hasSessionCookie: !!sessionCookie,
    })

    const orchestratorResponse = await fetch(`${orchestratorUrl}/api/chat/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-user-id': userId,
        'x-org-id': orgId,
      },
      body: JSON.stringify(body),
    })

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text()
      console.error('Orchestrator respond error:', orchestratorResponse.status, errorText)
      return NextResponse.json(
        { ok: false, error: errorText || 'Failed to send clarification response' },
        { status: orchestratorResponse.status }
      )
    }

    // Check if response is SSE stream
    const contentType = orchestratorResponse.headers.get('content-type')

    if (contentType?.includes('text/event-stream')) {
      // Pass through the SSE stream
      const stream = orchestratorResponse.body
      if (!stream) {
        return NextResponse.json(
          { error: 'No response stream available' },
          { status: 500 }
        )
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // Fallback to JSON response (for backwards compatibility)
    const result = await orchestratorResponse.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('Chat respond API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
