import { NextRequest, NextResponse } from 'next/server'
import { ensureRootEnvLoaded } from '@/lib/root-env'

export const dynamic = 'force-dynamic'

/**
 * Get Core Agent activity manager URL
 */
function getCoreAgentActivityUrl(organizationId: string): string {
  const parRuntimeUrl = process.env.PAR_RUNTIME_URL || process.env.PAF_CORE_AGENT_URL || 'http://localhost:8000'
  const agentAppId = process.env.PAF_CORE_AGENT_APP_ID
  const baseUrl = parRuntimeUrl.replace(/\/$/, '')
  
  // Build activity manager URL
  let activityUrl: string
  if (agentAppId) {
    activityUrl = `${baseUrl}/agents/${agentAppId}/api/activity-manager`
  } else {
    activityUrl = `${baseUrl}/api/activity-manager`
  }
  
  return `${activityUrl}?organization_id=${organizationId}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id is required' },
        { status: 400 }
      )
    }

    // Get Core Agent activity URL
    const activityUrl = getCoreAgentActivityUrl(organizationId)
    console.log(`📡 Fetching activity from Core Agent: ${activityUrl}`)

    // Forward request to Core Agent
    const response = await fetch(activityUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`Core Agent activity API error: ${response.status}`)
      // Return empty activity data instead of error
      return NextResponse.json({
        message: 'No activity available',
        payload: {
          activities: [],
          total: 0
        }
      })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Activity API error:', error)
    // Return empty activity data instead of error
    return NextResponse.json({
      message: 'No activity available',
      payload: {
        activities: [],
        total: 0
      }
    })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
