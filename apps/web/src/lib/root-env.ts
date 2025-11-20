import path from 'path'
import fs from 'fs'
import { loadSecretsToEnv } from './aws-secrets'

let rootEnvLoaded = false

/**
 * Load environment variables from .env files
 * This is the fallback when AWS Secrets Manager is not available
 */
function loadFromEnvFiles(): void {
  try {
    const root = path.resolve(__dirname, '..', '..', '..')
    const envName = process.env.PIXELL_ENV
    const candidates: string[] = []
    if (envName) candidates.push(path.join(root, `.env.${envName}`))
    candidates.push(path.join(root, '.env.local'))
    candidates.push(path.join(root, '.env'))

    for (const p of candidates) {
      if (!fs.existsSync(p)) continue
      try {
        const content = fs.readFileSync(p, 'utf8')
        for (const raw of content.split(/\r?\n/)) {
          const line = raw.trim()
          if (!line || line.startsWith('#')) continue
          const eq = line.indexOf('=')
          if (eq === -1) continue
          const k = line.substring(0, eq).trim()
          let v = line.substring(eq + 1).trim()
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith('\'') && v.endsWith('\''))) {
            v = v.slice(1, -1)
          }
          if (process.env[k] === undefined) process.env[k] = v
        }
        rootEnvLoaded = true
        break
      } catch {}
    }
  } catch {}
}

/**
 * Ensure environment variables are loaded
 * Priority: AWS Secrets Manager → .env files
 */
export async function ensureRootEnvLoaded(): Promise<void> {
  // Only run on server side
  if (typeof window !== 'undefined') return

  if (rootEnvLoaded) return

  // Check if we should use AWS Secrets Manager
  const useAwsSecrets = process.env.USE_AWS_SECRETS_MANAGER === 'true' ||
                        process.env.PIXELL_ENV === 'dev' ||
                        process.env.PIXELL_ENV === 'prod' ||
                        process.env.PIXELL_ENV === 'production'

  if (useAwsSecrets) {
    try {
      await loadSecretsToEnv()
      rootEnvLoaded = true
      return
    } catch (error) {
      console.error('Failed to load from AWS Secrets Manager, falling back to .env files:', error)
    }
  }

  // Fallback to .env files
  loadFromEnvFiles()
}

/**
 * Synchronous version for backwards compatibility
 * Note: This will not load from AWS Secrets Manager
 */
export function ensureRootEnvLoadedSync(): void {
  if (typeof window !== 'undefined') return
  if (rootEnvLoaded) return
  loadFromEnvFiles()
}


