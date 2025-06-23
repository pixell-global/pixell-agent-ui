import { EventEmitter } from 'events'
import { UserId } from '@pixell/protocols'

export interface RecentContext {
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    metadata?: Record<string, any>
  }>
  currentTopic?: string
  activeEntities: Array<{
    name: string
    type: string
    confidence: number
  }>
  workingMemory: Record<string, any>
}

export interface UserPreferences {
  communicationStyle: 'concise' | 'detailed' | 'adaptive'
  preferredAgents: string[]
  domainExpertise: string[]
  riskTolerance: 'low' | 'medium' | 'high'
  feedbackPreferences: {
    frequency: 'minimal' | 'moderate' | 'verbose'
    types: string[]
  }
}

export interface ProjectState {
  activeProjects: Array<{
    id: string
    name: string
    status: 'active' | 'paused' | 'completed'
    context: Record<string, any>
    lastActivity: string
  }>
  recentTasks: Array<{
    id: string
    name: string
    status: string
    outcome: string
    lessons: string[]
  }>
}

export interface DomainExpertise {
  domains: Record<string, {
    level: 'novice' | 'intermediate' | 'expert'
    keywords: string[]
    commonPatterns: string[]
    preferredApproaches: string[]
  }>
  crossDomainConnections: Array<{
    from: string
    to: string
    relationship: string
  }>
}

export interface ConversationMemory {
  shortTerm: RecentContext
  longTerm: UserPreferences
  projectContext: ProjectState
  domainKnowledge: DomainExpertise
}

export interface MemoryQuery {
  type: 'similar_context' | 'user_preference' | 'project_history' | 'domain_knowledge'
  query: string
  userId: UserId
  limit?: number
  threshold?: number
}

export interface MemorySearchResult {
  items: Array<{
    content: any
    relevance: number
    source: 'short_term' | 'long_term' | 'project' | 'domain'
    timestamp?: string
  }>
  totalFound: number
}

/**
 * ConversationMemoryManager - Manages contextual memory for enhanced understanding
 * 
 * Provides multi-layered memory storage and retrieval for:
 * - Short-term conversation context
 * - Long-term user preferences and patterns
 * - Project-specific context and history
 * - Domain knowledge and expertise mapping
 */
export class ConversationMemoryManager extends EventEmitter {
  private memories = new Map<UserId, ConversationMemory>()
  private contextWindow = 10 // Number of recent messages to keep in short-term
  private maxWorkingMemory = 50 // Maximum working memory entries

  constructor() {
    super()
  }

  /**
   * Initialize memory for a user
   */
  async initializeUser(userId: UserId): Promise<void> {
    if (this.memories.has(userId)) return

    const memory: ConversationMemory = {
      shortTerm: {
        messages: [],
        activeEntities: [],
        workingMemory: {}
      },
      longTerm: {
        communicationStyle: 'adaptive',
        preferredAgents: [],
        domainExpertise: [],
        riskTolerance: 'medium',
        feedbackPreferences: {
          frequency: 'moderate',
          types: ['progress', 'completion', 'errors']
        }
      },
      projectContext: {
        activeProjects: [],
        recentTasks: []
      },
      domainKnowledge: {
        domains: {},
        crossDomainConnections: []
      }
    }

    this.memories.set(userId, memory)
    
    // In production, this would load from persistent storage
    await this.loadUserMemory(userId)
    
    this.emit('user:initialized', userId)
  }

  /**
   * Store a new message in conversation memory
   */
  async storeMessage(userId: UserId, message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.initializeUser(userId)
    const memory = this.memories.get(userId)!

    // Add to short-term memory
    memory.shortTerm.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    })

    // Maintain context window size
    if (memory.shortTerm.messages.length > this.contextWindow) {
      memory.shortTerm.messages = memory.shortTerm.messages.slice(-this.contextWindow)
    }

    // Extract and update entities
    await this.updateActiveEntities(memory, message.content)

    // Update working memory
    await this.updateWorkingMemory(memory, message)

    this.emit('message:stored', userId, message)
  }

  /**
   * Retrieve conversation context for understanding
   */
  async getContext(userId: UserId): Promise<ConversationMemory | null> {
    await this.initializeUser(userId)
    return this.memories.get(userId) || null
  }

  /**
   * Search memory for relevant information
   */
  async searchMemory(query: MemoryQuery): Promise<MemorySearchResult> {
    const memory = this.memories.get(query.userId)
    if (!memory) {
      return { items: [], totalFound: 0 }
    }

    const results: Array<{
      content: any
      relevance: number
      source: 'short_term' | 'long_term' | 'project' | 'domain'
      timestamp?: string
    }> = []

    // Search based on query type
    switch (query.type) {
      case 'similar_context':
        results.push(...await this.searchSimilarContext(memory, query.query))
        break
      case 'user_preference':
        results.push(...await this.searchUserPreferences(memory, query.query))
        break
      case 'project_history':
        results.push(...await this.searchProjectHistory(memory, query.query))
        break
      case 'domain_knowledge':
        results.push(...await this.searchDomainKnowledge(memory, query.query))
        break
    }

    // Sort by relevance and limit results
    const sortedResults = results
      .filter(r => r.relevance >= (query.threshold || 0.3))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, query.limit || 10)

    return {
      items: sortedResults,
      totalFound: results.length
    }
  }

  /**
   * Update user preferences based on interaction patterns
   */
  async updatePreferences(userId: UserId, updates: Partial<UserPreferences>): Promise<void> {
    const memory = this.memories.get(userId)
    if (!memory) return

    memory.longTerm = { ...memory.longTerm, ...updates }
    
    // In production, persist to database
    await this.saveUserMemory(userId)
    
    this.emit('preferences:updated', userId, updates)
  }

  /**
   * Update project context
   */
  async updateProjectContext(userId: UserId, updates: Partial<ProjectState>): Promise<void> {
    const memory = this.memories.get(userId)
    if (!memory) return

    memory.projectContext = { ...memory.projectContext, ...updates }
    
    await this.saveUserMemory(userId)
    
    this.emit('project:updated', userId, updates)
  }

  /**
   * Update domain knowledge based on interactions
   */
  async updateDomainKnowledge(userId: UserId, domain: string, updates: {
    level?: 'novice' | 'intermediate' | 'expert'
    keywords?: string[]
    patterns?: string[]
    approaches?: string[]
  }): Promise<void> {
    const memory = this.memories.get(userId)
    if (!memory) return

    if (!memory.domainKnowledge.domains[domain]) {
      memory.domainKnowledge.domains[domain] = {
        level: 'novice',
        keywords: [],
        commonPatterns: [],
        preferredApproaches: []
      }
    }

    const domainInfo = memory.domainKnowledge.domains[domain]
    if (updates.level) domainInfo.level = updates.level
    if (updates.keywords) domainInfo.keywords = [...new Set([...domainInfo.keywords, ...updates.keywords])]
    if (updates.patterns) domainInfo.commonPatterns = [...new Set([...domainInfo.commonPatterns, ...updates.patterns])]
    if (updates.approaches) domainInfo.preferredApproaches = [...new Set([...domainInfo.preferredApproaches, ...updates.approaches])]

    await this.saveUserMemory(userId)
    
    this.emit('domain:updated', userId, domain, updates)
  }

  /**
   * Clear memory for a user (useful for testing or privacy)
   */
  async clearUserMemory(userId: UserId): Promise<void> {
    this.memories.delete(userId)
    this.emit('memory:cleared', userId)
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(userId: UserId): Record<string, any> | null {
    const memory = this.memories.get(userId)
    if (!memory) return null

    return {
      shortTerm: {
        messageCount: memory.shortTerm.messages.length,
        entityCount: memory.shortTerm.activeEntities.length,
        workingMemorySize: Object.keys(memory.shortTerm.workingMemory).length
      },
      longTerm: {
        domainCount: memory.longTerm.domainExpertise.length,
        preferredAgentCount: memory.longTerm.preferredAgents.length
      },
      projects: {
        activeProjectCount: memory.projectContext.activeProjects.length,
        recentTaskCount: memory.projectContext.recentTasks.length
      },
      domains: {
        domainCount: Object.keys(memory.domainKnowledge.domains).length,
        connectionCount: memory.domainKnowledge.crossDomainConnections.length
      }
    }
  }

  // Private helper methods

  private async updateActiveEntities(memory: ConversationMemory, content: string): Promise<void> {
    // Simple entity extraction (in production, use NLP libraries)
    const entities = this.extractEntities(content)
    
    entities.forEach(entity => {
      const existing = memory.shortTerm.activeEntities.find(e => e.name === entity.name)
      if (existing) {
        existing.confidence = Math.min(existing.confidence + 0.1, 1.0)
      } else {
        memory.shortTerm.activeEntities.push(entity)
      }
    })

    // Keep only top entities
    memory.shortTerm.activeEntities = memory.shortTerm.activeEntities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20)
  }

  private async updateWorkingMemory(memory: ConversationMemory, message: any): Promise<void> {
    // Extract key-value pairs from message metadata
    if (message.metadata) {
      Object.entries(message.metadata).forEach(([key, value]) => {
        memory.shortTerm.workingMemory[key] = value
      })
    }

    // Maintain working memory size
    const entries = Object.entries(memory.shortTerm.workingMemory)
    if (entries.length > this.maxWorkingMemory) {
      const kept = entries.slice(-this.maxWorkingMemory)
      memory.shortTerm.workingMemory = Object.fromEntries(kept)
    }
  }

  private extractEntities(content: string): Array<{ name: string; type: string; confidence: number }> {
    // Simple regex-based entity extraction (placeholder for production NLP)
    const entities: Array<{ name: string; type: string; confidence: number }> = []
    
    // Extract possible file names
    const fileMatches = content.match(/[\w\-_]+\.[a-z]{2,4}/gi)
    if (fileMatches) {
      fileMatches.forEach(match => {
        entities.push({ name: match, type: 'file', confidence: 0.8 })
      })
    }

    // Extract URLs
    const urlMatches = content.match(/https?:\/\/[^\s]+/gi)
    if (urlMatches) {
      urlMatches.forEach(match => {
        entities.push({ name: match, type: 'url', confidence: 0.9 })
      })
    }

    // Extract possible project names (capitalized words)
    const projectMatches = content.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g)
    if (projectMatches) {
      projectMatches.forEach(match => {
        entities.push({ name: match, type: 'project', confidence: 0.6 })
      })
    }

    return entities
  }

  private async searchSimilarContext(memory: ConversationMemory, query: string): Promise<Array<{ content: any; relevance: number; source: 'short_term'; timestamp?: string }>> {
    const results: Array<{ content: any; relevance: number; source: 'short_term'; timestamp?: string }> = []
    
    memory.shortTerm.messages.forEach(message => {
      const relevance = this.calculateSimilarity(query, message.content)
      if (relevance > 0.3) {
        results.push({
          content: message,
          relevance,
          source: 'short_term',
          timestamp: message.timestamp
        })
      }
    })

    return results
  }

  private async searchUserPreferences(memory: ConversationMemory, query: string): Promise<Array<{ content: any; relevance: number; source: 'long_term' }>> {
    const results: Array<{ content: any; relevance: number; source: 'long_term' }> = []
    
    // Search in domain expertise
    memory.longTerm.domainExpertise.forEach(domain => {
      if (domain.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          content: { domain, type: 'expertise' },
          relevance: 0.9,
          source: 'long_term'
        })
      }
    })

    // Search in preferred agents
    memory.longTerm.preferredAgents.forEach(agent => {
      if (agent.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          content: { agent, type: 'preferred_agent' },
          relevance: 0.8,
          source: 'long_term'
        })
      }
    })

    return results
  }

  private async searchProjectHistory(memory: ConversationMemory, query: string): Promise<Array<{ content: any; relevance: number; source: 'project'; timestamp?: string }>> {
    const results: Array<{ content: any; relevance: number; source: 'project'; timestamp?: string }> = []
    
    memory.projectContext.recentTasks.forEach(task => {
      const relevance = this.calculateSimilarity(query, task.name + ' ' + task.outcome)
      if (relevance > 0.3) {
        results.push({
          content: task,
          relevance,
          source: 'project'
        })
      }
    })

    return results
  }

  private async searchDomainKnowledge(memory: ConversationMemory, query: string): Promise<Array<{ content: any; relevance: number; source: 'domain' }>> {
    const results: Array<{ content: any; relevance: number; source: 'domain' }> = []
    
    Object.entries(memory.domainKnowledge.domains).forEach(([domain, info]) => {
      const searchText = [domain, ...info.keywords, ...info.commonPatterns].join(' ')
      const relevance = this.calculateSimilarity(query, searchText)
      if (relevance > 0.3) {
        results.push({
          content: { domain, ...info },
          relevance,
          source: 'domain'
        })
      }
    })

    return results
  }

  private calculateSimilarity(query: string, text: string): number {
    // Simple similarity calculation (in production, use better algorithms)
    const queryWords = query.toLowerCase().split(' ')
    const textWords = text.toLowerCase().split(' ')
    
    let matches = 0
    queryWords.forEach(word => {
      if (textWords.some(textWord => textWord.includes(word) || word.includes(textWord))) {
        matches++
      }
    })
    
    return matches / Math.max(queryWords.length, 1)
  }

  private async loadUserMemory(userId: UserId): Promise<void> {
    // In production, load from database
    // For now, this is a no-op
  }

  private async saveUserMemory(userId: UserId): Promise<void> {
    // In production, save to database
    // For now, this is a no-op
  }
} 