import {
  FileText,
  Code,
  MessageSquare,
  Search,
  BarChart3,
  TrendingUp,
  Users,
  Hash,
  Target,
  Sparkles,
  Database,
  LineChart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface AgentPrompt {
  id: string
  icon: LucideIcon
  title: string
  description: string
  promptText: string
}

export interface AgentCapabilityInfo {
  name: string
  description: string
}

/**
 * Agent-specific prompts - 3 per agent
 * These are hardcoded in frontend by agent ID
 */
export const AGENT_PROMPTS: Record<string, AgentPrompt[]> = {
  'tiktok-agent': [
    {
      id: 'tiktok-1',
      icon: Search,
      title: 'Find Influencers',
      description: 'Discover TikTok creators in your niche',
      promptText: 'Find TikTok influencers in the fitness and wellness niche',
    },
    {
      id: 'tiktok-2',
      icon: Hash,
      title: 'Hashtag Analysis',
      description: 'Analyze trending hashtags and their performance',
      promptText: 'Analyze trending hashtags for beauty and skincare content',
    },
    {
      id: 'tiktok-3',
      icon: TrendingUp,
      title: 'Content Trends',
      description: 'Discover what content is performing well',
      promptText: 'What content trends are working well for tech brands on TikTok?',
    },
  ],

  'reddit-agent': [
    {
      id: 'reddit-1',
      icon: Users,
      title: 'Community Discovery',
      description: 'Find relevant subreddits for your topic',
      promptText: 'Find subreddits related to personal finance and investing',
    },
    {
      id: 'reddit-2',
      icon: BarChart3,
      title: 'Sentiment Analysis',
      description: 'Analyze community sentiment about a topic',
      promptText: 'Analyze what Reddit communities are saying about remote work',
    },
    {
      id: 'reddit-3',
      icon: Target,
      title: 'Audience Research',
      description: 'Understand your target audience on Reddit',
      promptText: 'Help me understand the gaming community audience on Reddit',
    },
  ],

  'analytics-agent': [
    {
      id: 'analytics-1',
      icon: LineChart,
      title: 'Data Analysis',
      description: 'Analyze your datasets and find insights',
      promptText: 'Analyze my sales data and identify key trends',
    },
    {
      id: 'analytics-2',
      icon: Database,
      title: 'Report Generation',
      description: 'Generate comprehensive reports from your data',
      promptText: 'Generate a performance report from my dataset',
    },
    {
      id: 'analytics-3',
      icon: Sparkles,
      title: 'Predictive Insights',
      description: 'Get predictions and forecasts from your data',
      promptText: 'What predictions can you make from my customer data?',
    },
  ],
}

/**
 * Default prompts for unknown agents
 */
export const DEFAULT_PROMPTS: AgentPrompt[] = [
  {
    id: 'default-1',
    icon: MessageSquare,
    title: 'Get Started',
    description: 'Start a conversation with the AI agent',
    promptText: 'Hello, what can you help me with?',
  },
  {
    id: 'default-2',
    icon: Search,
    title: 'Explore Capabilities',
    description: 'Learn what this agent can do',
    promptText: 'What are your main capabilities?',
  },
  {
    id: 'default-3',
    icon: FileText,
    title: 'Help with Tasks',
    description: 'Get assistance with your work',
    promptText: 'Help me with my current task',
  },
]

/**
 * Get prompts for a specific agent, with fallback to defaults
 */
export function getPromptsForAgent(agentId: string | undefined): AgentPrompt[] {
  if (!agentId) return DEFAULT_PROMPTS
  return AGENT_PROMPTS[agentId] || DEFAULT_PROMPTS
}

/**
 * Agent capability descriptions for tooltips
 */
export const AGENT_CAPABILITIES: Record<string, AgentCapabilityInfo[]> = {
  'tiktok-agent': [
    { name: 'clarification', description: 'Asks clarifying questions' },
    { name: 'search_plan', description: 'Creates search strategies' },
    { name: 'streaming', description: 'Real-time response streaming' },
  ],
  'reddit-agent': [
    { name: 'clarification', description: 'Asks clarifying questions' },
    { name: 'discovery', description: 'Finds relevant communities' },
    { name: 'search_plan', description: 'Creates search strategies' },
    { name: 'streaming', description: 'Real-time response streaming' },
  ],
  'analytics-agent': [
    { name: 'data_analysis', description: 'Processes and analyzes datasets' },
    { name: 'visualization', description: 'Creates charts and graphs' },
    { name: 'export', description: 'Exports results to various formats' },
  ],
}

/**
 * Get capabilities for a specific agent
 */
export function getCapabilitiesForAgent(
  agentId: string | undefined,
  fallbackCapabilities?: string[]
): AgentCapabilityInfo[] {
  if (!agentId) return []

  // Use predefined descriptions if available
  if (AGENT_CAPABILITIES[agentId]) {
    return AGENT_CAPABILITIES[agentId]
  }

  // Fall back to generic descriptions from capability strings
  if (fallbackCapabilities) {
    return fallbackCapabilities.map((cap) => ({
      name: cap,
      description: cap.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
  }

  return []
}
