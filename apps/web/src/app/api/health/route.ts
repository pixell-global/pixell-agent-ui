import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Make sure ALB/ECS health checks are fast and reliable.
// The load balancer health check should reflect *this web service* availability,
// not downstream dependencies (Core Agent / Orchestrator).
//
// If downstream services are unavailable, we still return HTTP 200 with
// status details in the JSON payload.


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
  const startedAt = Date.now()
  const basePayload: Record<string, unknown> = {
    status: 'ok',
    service: 'web',
    timestamp: new Date().toISOString(),
  }

  // Optional deeper check: include core agent status but never fail the LB.
  // Use a short timeout so ALB health checks don't time out.
  try {
    const healthUrl = getCoreAgentHealthUrl()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      // Prevent any caching for health checks
      cache: 'no-store',
    }).finally(() => clearTimeout(timeout))

    if (!response.ok) {
      return NextResponse.json(
        {
          ...basePayload,
          status: 'degraded',
          coreAgent: { ok: false, status: response.status },
          latencyMs: Date.now() - startedAt,
        },
        { status: 200 },
      )
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ...basePayload,
        coreAgent: { ok: true },
        upstream: data,
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 },
    )
  } catch (error) {
    // Don't spam logs for LB health checks; just report degraded.
    return NextResponse.json(
      {
        ...basePayload,
        status: 'degraded',
        coreAgent: { ok: false, error: error instanceof Error ? error.message : 'unknown' },
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 },
    )
  }
} 