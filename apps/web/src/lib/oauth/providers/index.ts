/**
 * OAuth Provider Registry
 *
 * Central registry for all OAuth providers.
 * New providers should be added here.
 */

import { OAuthProvider, OAuthProviderConfig, ProviderStatus } from './types'
import { tiktokProvider } from './tiktok'

/**
 * Registry of implemented OAuth providers
 */
const implementedProviders: Partial<Record<OAuthProvider, OAuthProviderConfig>> = {
  tiktok: tiktokProvider,
  // Future providers will be added here:
  // instagram: instagramProvider,
  // google: googleProvider,
  // reddit: redditProvider,
}

/**
 * List of all supported providers (including unimplemented)
 */
export const SUPPORTED_PROVIDERS: OAuthProvider[] = [
  'tiktok',
  'instagram',
  'google',
  'reddit',
]

/**
 * Get provider configuration
 * @throws Error if provider is not implemented
 */
export function getProvider(provider: OAuthProvider): OAuthProviderConfig {
  const config = implementedProviders[provider]

  if (!config) {
    throw new Error(
      `OAuth provider "${provider}" is not yet implemented. ` +
      `Currently supported: ${Object.keys(implementedProviders).join(', ')}`
    )
  }

  return config
}

/**
 * Check if a provider is implemented
 */
export function isProviderImplemented(provider: OAuthProvider): boolean {
  return provider in implementedProviders
}

/**
 * Get all implemented providers
 */
export function getImplementedProviders(): OAuthProviderConfig[] {
  return Object.values(implementedProviders).filter(
    (p): p is OAuthProviderConfig => p !== undefined
  )
}

/**
 * Get provider status for all supported providers
 */
export function getProviderStatuses(): ProviderStatus[] {
  return SUPPORTED_PROVIDERS.map((provider) => {
    const config = implementedProviders[provider]

    if (!config) {
      return {
        provider,
        configured: false,
        error: 'Provider not implemented',
      }
    }

    // Check if required environment variables are set
    let error: string | undefined

    if (provider === 'tiktok') {
      if (!process.env.TIKAPI_KEY) {
        error = 'TIKAPI_KEY not configured'
      }
    }

    return {
      provider,
      configured: !error,
      error,
    }
  })
}

/**
 * Get display information for all providers (for UI)
 */
export function getProviderDisplayInfo(): Array<{
  provider: OAuthProvider
  displayName: string
  icon: string
  implemented: boolean
  usesPopup: boolean
}> {
  return SUPPORTED_PROVIDERS.map((provider) => {
    const config = implementedProviders[provider]

    if (config) {
      return {
        provider,
        displayName: config.displayName,
        icon: config.icon,
        implemented: true,
        usesPopup: config.usesPopup,
      }
    }

    // Default display info for unimplemented providers
    const defaults: Record<OAuthProvider, { displayName: string; icon: string }> = {
      tiktok: { displayName: 'TikTok', icon: 'tiktok' },
      instagram: { displayName: 'Instagram', icon: 'instagram' },
      google: { displayName: 'Google', icon: 'google' },
      reddit: { displayName: 'Reddit', icon: 'reddit' },
    }

    return {
      provider,
      displayName: defaults[provider].displayName,
      icon: defaults[provider].icon,
      implemented: false,
      usesPopup: false,
    }
  })
}

// Re-export types
export * from './types'

// Re-export specific providers for direct access if needed
export { tiktokProvider } from './tiktok'
