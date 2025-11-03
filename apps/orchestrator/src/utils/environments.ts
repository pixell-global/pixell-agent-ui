import fs from 'fs-extra'
import path from 'path'

interface EnvironmentConfig {
  name: string
  type: 'local' | 'remote'
  database: {
    url?: string
    host?: string
    port?: number
    user?: string
    password?: string
    database?: string
  }
  supabase: {
    projectUrl?: string
    anonKey?: string
    serviceRoleKey?: string
  }
  pafCoreAgent?: {
    url?: string
  }
  description?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

interface EnvironmentsConfig {
  environments: EnvironmentConfig[]
}

/**
 * Get the active environment configuration
 */
export async function getActiveEnvironment(): Promise<EnvironmentConfig | null> {
  try {
    const environments = await getEnvironmentsConfig()
    const activeEnv = environments.find(env => env.isActive === true)
    return activeEnv || null
  } catch (error) {
    console.error('Failed to get active environment:', error)
    return null
  }
}

/**
 * Get environment configuration by name
 */
export async function getEnvironmentByName(name: string): Promise<EnvironmentConfig | null> {
  try {
    const environments = await getEnvironmentsConfig()
    const environment = environments.find(env => env.name?.toLowerCase() === name.toLowerCase())
    return environment || null
  } catch (error) {
    console.error(`Failed to get environment "${name}":`, error)
    return null
  }
}

/**
 * Get all environments configuration
 */
export async function getEnvironmentsConfig(): Promise<EnvironmentConfig[]> {
  const configPath = path.join(process.cwd(), '.pixell', 'environments.json')
  
  try {
    if (await fs.pathExists(configPath)) {
      const data = await fs.readJson(configPath) as EnvironmentsConfig
      
      // Handle the structure { "environments": [...] }
      if (data && data.environments && Array.isArray(data.environments)) {
        return data.environments
      }
      // Fallback: if data is directly an array
      else if (Array.isArray(data)) {
        return data as EnvironmentConfig[]
      } 
             // Fallback: if it's a single environment object
       else if (data && typeof data === 'object' && (data as any).name) {
         return [data as any as EnvironmentConfig]
       }
    }
    return []
  } catch (error) {
    console.error('Could not read environments config:', error)
    return []
  }
}

/**
 * Get PAF Core Agent URL from the active environment
 */
export async function getPafCoreAgentUrl(): Promise<string> {
  try {
    // First try to get from environment variable as fallback
    const envUrl = process.env.PAF_CORE_AGENT_URL
    if (envUrl) {
      return envUrl
    }

    // Get from active environment configuration
    const activeEnv = await getActiveEnvironment()
    if (activeEnv?.pafCoreAgent?.url) {
      return activeEnv.pafCoreAgent.url
    }

    // Default fallback
    return 'http://localhost:8000'
  } catch (error) {
    console.error('Failed to get PAF Core Agent URL:', error)
    return 'http://localhost:8000'
  }
}

export type { EnvironmentConfig, EnvironmentsConfig } 