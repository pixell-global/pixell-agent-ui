/**
 * Orchestrator service configuration utility for frontend
 * Routes all AI requests through the orchestrator middleware
 */

/**
 * Get Orchestrator URL from environment configuration
 * The orchestrator handles communication with the PAF Core Agent
 */
export function getPafCoreAgentUrl(): string {
  // Use orchestrator URL instead of direct PAF Core Agent URL
  const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL
  if (orchestratorUrl) {
    return orchestratorUrl
  }

  // Fallback to generic API base (should be orchestrator)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE
  if (apiBase) {
    return apiBase
  }

  // Default fallback to orchestrator port
  return 'http://localhost:3001'
}

/**
 * Get Orchestrator health endpoint URL
 * This checks the health of both orchestrator and PAF Core Agent
 */
export function getPafCoreAgentHealthUrl(): string {
  return `${getPafCoreAgentUrl()}/api/health`
}

/**
 * Get Orchestrator chat stream endpoint URL  
 * This routes through the orchestrator's sophisticated SSE handling
 */
export function getPafCoreAgentChatStreamUrl(): string {
  return `${getPafCoreAgentUrl()}/api/chat/stream`
}