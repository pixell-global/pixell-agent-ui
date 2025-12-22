import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/user-storage'

export const dynamic = 'force-dynamic'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3001'

/**
 * GET /api/memories/settings - Get user memory settings
 */
export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request)

    if (!userContext) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const response = await fetch(`${ORCHESTRATOR_URL}/api/memories/settings`, {
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
        { error: data.error || 'Failed to fetch settings' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memory settings API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/memories/settings - Update user memory settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const userContext = await getUserContext(request)

    if (!userContext) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()

    const response = await fetch(`${ORCHESTRATOR_URL}/api/memories/settings`, {
      method: 'PATCH',
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
        { error: data.error || 'Failed to update settings' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memory settings API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
