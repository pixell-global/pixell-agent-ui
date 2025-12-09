import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'


/**
 * Get Core Agent health URL
 */
function getCoreAgentHealthUrl(): string {
  const parRuntimeUrl = process.env.PAR_RUNTIME_URL || process.env.PAF_CORE_AGENT_URL
  const agentAppId = process.env.PAF_CORE_AGENT_APP_ID

  if (!parRuntimeUrl) {
    return 'http://localhost:8000/api/health'
  }

  const baseUrl = parRuntimeUrl.replace(/\/$/, '')
  
  if (agentAppId) {
    return `${baseUrl}/agents/${agentAppId}/api/health`
  }
  
  return `${baseUrl}/api/health`
}

export async function GET() {
  try {
    // Check Core Agent health directly (bypassing Orchestrator)
    const healthUrl = getCoreAgentHealthUrl()
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      return NextResponse.json({
        status: 'error',
        error: `Core Agent not available: ${response.status}`,
        runtime: { provider: 'unknown' }
      }, { status: 503 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      status: 'error',
      error: 'Cannot connect to Core Agent',
      runtime: { provider: 'unknown' }
    }, { status: 503 })
  }
} 