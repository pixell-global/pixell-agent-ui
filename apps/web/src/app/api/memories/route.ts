import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/user-storage'

export const dynamic = 'force-dynamic'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'

/**
 * GET /api/memories - List memories with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request)

    if (!userContext) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Forward query params to orchestrator
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()

    const response = await fetch(`${ORCHESTRATOR_URL}/api/memories?${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userContext.userId,
        'x-org-id': userContext.orgId || '',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch memories' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memory API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/memories - Create a new memory
 */
export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request)

    if (!userContext) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()

    const response = await fetch(`${ORCHESTRATOR_URL}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userContext.userId,
        'x-org-id': userContext.orgId || '',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to create memory' },
        { status: response.status }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Memory API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/memories - Delete all memories (requires ?confirm=true)
 */
export async function DELETE(request: NextRequest) {
  try {
    const userContext = await getUserContext(request)

    if (!userContext) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')

    if (confirm !== 'true') {
      return NextResponse.json(
        { error: 'Confirmation required. Add ?confirm=true to delete all memories.' },
        { status: 400 }
      )
    }

    const response = await fetch(`${ORCHESTRATOR_URL}/api/memories?confirm=true`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userContext.userId,
        'x-org-id': userContext.orgId || '',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to delete memories' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memory API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
