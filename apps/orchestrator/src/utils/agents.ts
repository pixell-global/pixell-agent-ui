import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

// Feature types for billing quotas
export type FeatureType = 'research' | 'ideation' | 'auto_posting' | 'monitors'

export interface AgentConfig {
  id: string
  name: string
  description?: string
  url: string
  protocol: 'paf' | 'a2a'
  default?: boolean
  capabilities?: string[]
  // Billing feature type for quota tracking
  featureType?: FeatureType
  // Coming soon flag (disables agent selection)
  comingSoon?: boolean
  planMode?: {
    supported: boolean
    phases?: string[]
    discoveryType?: string
    llmQuestions?: boolean
    selectionMode?: string
    maxDiscoveryItems?: number
  }
}

export interface AgentsConfig {
  agents: AgentConfig[]
}

let cachedConfig: AgentsConfig | null = null

/**
 * Find the config path, trying multiple locations
 */
function findConfigPath(): string | null {
  // Try multiple possible paths for different execution contexts
  const possiblePaths = [
    // Relative to __dirname (works in dev)
    join(__dirname, '../../config/agents.json'),
    // Relative to process.cwd() (works in production)
    join(process.cwd(), 'config/agents.json'),
    // Absolute path from orchestrator root
    resolve(process.cwd(), 'apps/orchestrator/config/agents.json'),
    // Relative to dist folder
    join(__dirname, '../config/agents.json'),
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log('💰 [BILLING DEBUG] Found agents.json at:', path)
      return path
    }
  }

  console.warn('💰 [BILLING DEBUG] agents.json not found. Tried paths:', possiblePaths)
  return null
}

/**
 * Load agent configuration from config/agents.json
 */
export function loadAgentsConfig(): AgentsConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const configPath = findConfigPath()

  if (!configPath) {
    console.warn('💰 [BILLING DEBUG] agents.json not found, using default configuration')
    cachedConfig = {
      agents: [
        {
          id: 'paf-core',
          name: 'PAF Core Agent',
          description: 'General-purpose AI assistant',
          url: 'http://localhost:8000',
          protocol: 'paf',
          default: true,
          capabilities: ['streaming', 'thinking']
        }
      ]
    }
    return cachedConfig
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8')
    cachedConfig = JSON.parse(configContent) as AgentsConfig
    console.log(`💰 [BILLING DEBUG] Loaded ${cachedConfig.agents.length} agent(s) from config:`)
    cachedConfig.agents.forEach(agent => {
      console.log(`  - ${agent.id}: featureType=${agent.featureType || 'NOT SET'}`)
    })
    return cachedConfig
  } catch (error) {
    console.error('Error loading agents.json:', error)
    throw new Error('Failed to load agent configuration')
  }
}

/**
 * Get all configured agents
 */
export function getAgents(): AgentConfig[] {
  return loadAgentsConfig().agents
}

/**
 * Get the default agent
 */
export function getDefaultAgent(): AgentConfig {
  const agents = getAgents()
  const defaultAgent = agents.find(a => a.default)
  return defaultAgent || agents[0]
}

/**
 * Get an agent by ID
 */
export function getAgentById(id: string): AgentConfig | undefined {
  return getAgents().find(a => a.id === id)
}

/**
 * Get an agent by URL
 */
export function getAgentByUrl(url: string): AgentConfig | undefined {
  return getAgents().find(a => a.url === url)
}

/**
 * Check if an agent supports a capability
 */
export function agentHasCapability(agent: AgentConfig, capability: string): boolean {
  return agent.capabilities?.includes(capability) ?? false
}

/**
 * Clear the cached configuration (useful for testing or hot-reload)
 */
export function clearAgentConfigCache(): void {
  cachedConfig = null
}
