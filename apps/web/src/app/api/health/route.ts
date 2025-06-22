import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get orchestrator URL from environment
    const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001'
    
    // Check orchestrator health
    const response = await fetch(`${orchestratorUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      return NextResponse.json({
        status: 'error',
        error: `Orchestrator not available: ${response.status}`,
        runtime: { provider: 'unknown' }
      }, { status: 503 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      status: 'error',
      error: 'Cannot connect to orchestrator',
      runtime: { provider: 'unknown' }
    }, { status: 503 })
  }
} 