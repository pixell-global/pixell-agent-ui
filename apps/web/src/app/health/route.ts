import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Health check endpoint at root level
 * Returns 200 OK to indicate the service is healthy and ready to accept requests.
 * Used by load balancers (ALB/ECS) and Docker health checks.
 * 
 * Accessible at: http://localhost:3000/health
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}

