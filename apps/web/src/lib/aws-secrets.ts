import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

// Cache secrets to avoid repeated AWS API calls
let secretsCache: Record<string, any> = {}
let secretsCacheLoaded = false

/**
 * Fetch secrets from AWS Secrets Manager
 * @param secretName - The name of the secret (e.g., 'pixell/dev' or 'pixell/prod')
 * @param region - AWS region (defaults to us-east-2)
 * @returns Parsed secret object
 */
export async function getAwsSecrets(
  secretName: string,
  region: string = 'us-east-2'
): Promise<Record<string, string>> {
  // Return cached secrets if already loaded
  if (secretsCacheLoaded && secretsCache[secretName]) {
    return secretsCache[secretName]
  }

  const client = new SecretsManagerClient({ region })

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    })

    const response = await client.send(command)

    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no SecretString value`)
    }

    const secrets = JSON.parse(response.SecretString)
    secretsCache[secretName] = secrets
    secretsCacheLoaded = true

    return secrets
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error)
    throw error
  }
}

/**
 * Load environment variables from AWS Secrets Manager
 * Determines which secret to load based on PIXELL_ENV or NODE_ENV
 */
export async function loadSecretsToEnv(): Promise<void> {
  // Only run on server side
  if (typeof window !== 'undefined') return

  // Skip if already loaded
  if (secretsCacheLoaded) return

  // Determine environment
  const pixellEnv = process.env.PIXELL_ENV || process.env.NODE_ENV

  // Map environment to secret name
  let secretName: string | null = null
  if (pixellEnv === 'production' || pixellEnv === 'prod') {
    secretName = 'pixell/prod'
  } else if (pixellEnv === 'development' || pixellEnv === 'dev') {
    secretName = 'pixell/dev'
  }

  // If no valid environment, skip AWS Secrets Manager
  if (!secretName) {
    console.log('No PIXELL_ENV or NODE_ENV set for AWS Secrets Manager, using local .env files')
    return
  }

  try {
    console.log(`Loading secrets from AWS Secrets Manager: ${secretName}`)
    const secrets = await getAwsSecrets(secretName)

    // Load all secrets into process.env (only if not already set)
    for (const [key, value] of Object.entries(secrets)) {
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }

    console.log(`Successfully loaded ${Object.keys(secrets).length} environment variables from ${secretName}`)
  } catch (error) {
    console.error('Failed to load secrets from AWS Secrets Manager:', error)
    console.log('Falling back to local .env files')
    // Don't throw - allow fallback to .env files
  }
}

/**
 * Clear the secrets cache (useful for testing)
 */
export function clearSecretsCache(): void {
  secretsCache = {}
  secretsCacheLoaded = false
}
