/**
 * Next.js Instrumentation File
 *
 * This file is executed once when the Node.js server starts.
 * It's the perfect place to load environment variables from AWS Secrets Manager.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { loadSecretsToEnv } from './lib/aws-secrets'

/**
 * Register function - called once on server startup
 */
export async function register() {
  // Only run on server side (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting - loading environment variables...')

    // Check if we should load from AWS Secrets Manager
    const useAwsSecrets = process.env.USE_AWS_SECRETS_MANAGER === 'true' ||
                          process.env.PIXELL_ENV === 'dev' ||
                          process.env.PIXELL_ENV === 'prod' ||
                          process.env.PIXELL_ENV === 'production'

    if (useAwsSecrets) {
      try {
        console.log('[Instrumentation] Loading secrets from AWS Secrets Manager...')
        await loadSecretsToEnv()
        console.log('[Instrumentation] Successfully loaded secrets from AWS Secrets Manager')
      } catch (error) {
        console.error('[Instrumentation] Failed to load from AWS Secrets Manager:', error)
        console.log('[Instrumentation] Server will use existing environment variables')
      }
    } else {
      console.log('[Instrumentation] Using local .env files (PIXELL_ENV not set to dev/prod)')
    }
  }
}
