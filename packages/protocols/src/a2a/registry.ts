import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { 
  AgentCard, 
  AgentId, 
  AgentCapability, 
  AgentError,
  Task 
} from '../shared/types'
import { 
  A2AAgent, 
  A2AMessage, 
  DiscoveryRequest, 
  DiscoveryResponse,
  Heartbeat,
  A2A_PROTOCOL_VERSION 
} from './types'

export interface AgentRegistryEvents {
  'agent:registered': (agent: AgentCard) => void
  'agent:unregistered': (agentId: AgentId) => void
  'agent:heartbeat': (heartbeat: Heartbeat) => void
  'agent:offline': (agentId: AgentId) => void
}

export interface ScoringWeights {
  relevance: number
  freshness: number
  cost: number
  load: number
}

/**
 * AgentRegistry manages the discovery, registration, and scoring of agents
 * in the Pixell Agent Framework. It acts as the central coordination point
 * for agent-to-agent communication and task delegation.
 */
export class AgentRegistry extends EventEmitter {
  private agents = new Map<AgentId, AgentCard>()
  private agentInstances = new Map<AgentId, A2AAgent>()
  private heartbeats = new Map<AgentId, Heartbeat>()
  private capabilities = new Map<AgentId, AgentCapability[]>()
  
  // Scoring weights for agent selection
  private scoringWeights: ScoringWeights = {
    relevance: 0.5,
    freshness: 0.2,
    cost: 0.2,
    load: 0.1
  }

  constructor() {
    super()
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring()
  }

  /**
   * Register a new agent in the registry
   */
  async registerAgent(agent: A2AAgent): Promise<void> {
    try {
      const card = await agent.discoverCapabilities()
      
      // Validate agent card
      if (!card.id || !card.name || !card.type) {
        throw new AgentError('Invalid agent card', 'INVALID_CARD', card.id)
      }

      // Store agent
      this.agents.set(card.id, card)
      this.agentInstances.set(card.id, agent)
      
      // Get initial capabilities
      await this.refreshAgentCapabilities(card.id)
      
      // Initialize agent
      await agent.initialize()
      
      // Get initial heartbeat
      const heartbeat = await agent.getStatus()
      this.heartbeats.set(card.id, heartbeat)
      
      this.emit('agent:registered', card)
      
      console.log(`✅ Registered agent: ${card.name} (${card.id})`)
    } catch (error) {
      throw new AgentError(
        `Failed to register agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REGISTRATION_FAILED',
        agent.card.id
      )
    }
  }

  /**
   * Unregister an agent from the registry
   */
  async unregisterAgent(agentId: AgentId): Promise<void> {
    const agent = this.agentInstances.get(agentId)
    if (agent) {
      try {
        await agent.shutdown()
      } catch (error) {
        console.warn(`Warning: Failed to shutdown agent ${agentId}:`, error)
      }
    }

    this.agents.delete(agentId)
    this.agentInstances.delete(agentId)
    this.heartbeats.delete(agentId)
    this.capabilities.delete(agentId)
    
    this.emit('agent:unregistered', agentId)
    
    console.log(`🔌 Unregistered agent: ${agentId}`)
  }

  /**
   * Get all registered agents
   */
  getAgents(): AgentCard[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get a specific agent by ID
   */
  getAgent(agentId: AgentId): AgentCard | null {
    return this.agents.get(agentId) || null
  }

  /**
   * Get agent instance (for direct communication)
   */
  getAgentInstance(agentId: AgentId): A2AAgent | null {
    return this.agentInstances.get(agentId) || null
  }

  /**
   * Find agents capable of handling a specific task
   */
  async findAgentsForTask(task: Partial<Task>): Promise<{
    agent: AgentCard
    score: number
    capabilities: AgentCapability[]
  }[]> {
    const candidates: Array<{
      agent: AgentCard
      score: number
      capabilities: AgentCapability[]
    }> = []

    for (const [agentId, agent] of this.agents) {
      const capabilities = this.capabilities.get(agentId) || []
      const heartbeat = this.heartbeats.get(agentId)
      
      // Skip offline agents
      if (!heartbeat || this.isAgentOffline(agentId)) {
        continue
      }

      // Calculate relevance score
      const score = this.scoreAgentForTask(agent, capabilities, heartbeat, task)
      
      if (score > 0) {
        candidates.push({
          agent,
          score,
          capabilities
        })
      }
    }

    // Sort by score (highest first)
    return candidates.sort((a, b) => b.score - a.score)
  }

  /**
   * Find agents by type
   */
  getAgentsByType(type: string): AgentCard[] {
    return this.getAgents().filter(agent => agent.type === type)
  }

  /**
   * Handle agent discovery request
   */
  async handleDiscoveryRequest(request: DiscoveryRequest): Promise<DiscoveryResponse> {
    let agents = this.getAgents()

    // Filter by domain if specified
    if (request.domain) {
      agents = agents.filter(agent => 
        agent.metadata?.domain === request.domain
      )
    }

    // Filter by capabilities if specified
    if (request.capabilities && request.capabilities.length > 0) {
      agents = agents.filter(agent => {
        const agentCapabilities = this.capabilities.get(agent.id) || []
        return request.capabilities!.some(requestedCap =>
          agentCapabilities.some(cap => cap.name === requestedCap)
        )
      })
    }

    return {
      agents,
      responderId: 'registry' // Registry acts as responder
    }
  }

  /**
   * Update agent heartbeat
   */
  updateHeartbeat(agentId: AgentId, heartbeat: Heartbeat): void {
    this.heartbeats.set(agentId, heartbeat)
    this.emit('agent:heartbeat', heartbeat)
  }

  /**
   * Get agent status/heartbeat
   */
  getAgentStatus(agentId: AgentId): Heartbeat | null {
    return this.heartbeats.get(agentId) || null
  }

  /**
   * Check if agent is considered offline
   */
  private isAgentOffline(agentId: AgentId): boolean {
    const heartbeat = this.heartbeats.get(agentId)
    if (!heartbeat) return true

    const lastSeen = new Date(heartbeat.lastSeen)
    const now = new Date()
    const timeDiff = now.getTime() - lastSeen.getTime()
    
    // Consider offline if no heartbeat for 60 seconds
    return timeDiff > 60000
  }

  /**
   * Score an agent for a given task
   */
  private scoreAgentForTask(
    agent: AgentCard,
    capabilities: AgentCapability[],
    heartbeat: Heartbeat,
    task: Partial<Task>
  ): number {
    let score = 0

    // Relevance score (has relevant capabilities)
    const relevanceScore = capabilities.length > 0 ? 1 : 0
    score += relevanceScore * this.scoringWeights.relevance

    // Freshness score (recent heartbeat)
    const lastSeen = new Date(heartbeat.lastSeen)
    const now = new Date()
    const timeDiff = now.getTime() - lastSeen.getTime()
    const freshnessScore = Math.max(0, 1 - (timeDiff / 30000)) // Decay over 30s
    score += freshnessScore * this.scoringWeights.freshness

    // Cost score (lower cost = higher score)
    const costScore = agent.cost_estimate ? 0.5 : 1 // Simple cost scoring
    score += costScore * this.scoringWeights.cost

    // Load score (fewer active tasks = higher score)
    const loadScore = Math.max(0, 1 - (heartbeat.activeTasks / 10))
    score += loadScore * this.scoringWeights.load

    return score
  }

  /**
   * Refresh agent capabilities
   */
  private async refreshAgentCapabilities(agentId: AgentId): Promise<void> {
    const agent = this.agentInstances.get(agentId)
    if (!agent) return

    try {
      // For now, we'll derive capabilities from the agent card
      // In a full implementation, this would query the agent's capabilities
      const card = this.agents.get(agentId)
      if (card?.capabilities) {
        // Convert agent card capabilities to structured capabilities
        const capabilities: AgentCapability[] = Object.entries(card.capabilities).map(([name, config]) => ({
          name,
          description: `${name} capability`,
          inputs: [],
          outputs: [],
          streaming: config?.streaming || false,
          pushNotifications: config?.pushNotifications || false
        }))
        
        this.capabilities.set(agentId, capabilities)
      }
    } catch (error) {
      console.warn(`Failed to refresh capabilities for ${agentId}:`, error)
    }
  }

  /**
   * Start monitoring agent heartbeats
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      for (const [agentId, heartbeat] of this.heartbeats) {
        if (this.isAgentOffline(agentId)) {
          this.emit('agent:offline', agentId)
          console.warn(`⚠️  Agent ${agentId} appears to be offline`)
        }
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Update scoring weights for agent selection
   */
  updateScoringWeights(weights: Partial<ScoringWeights>): void {
    this.scoringWeights = { ...this.scoringWeights, ...weights }
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const agents = this.getAgents()
    const online = agents.filter(agent => !this.isAgentOffline(agent.id))
    
    return {
      total: agents.length,
      online: online.length,
      offline: agents.length - online.length,
      byType: agents.reduce((acc, agent) => {
        acc[agent.type] = (acc[agent.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }
} 