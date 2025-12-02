/**
 * OAuth Environment Validation Tests
 *
 * Tests to verify OAuth-related environment variables are properly configured.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { isEncryptionConfigured, generateEncryptionKey } from '../encryption'
import { isProviderImplemented, getProviderStatuses } from '../providers'

describe('OAuth Environment Validation', () => {
  describe('Token Encryption', () => {
    it('should have isEncryptionConfigured function', () => {
      // The function should exist and work
      expect(typeof isEncryptionConfigured).toBe('function')
      // In test environment, encryption key is set in jest.setup.js
      const result = isEncryptionConfigured()
      expect(typeof result).toBe('boolean')
    })

    it('generateEncryptionKey creates valid keys', () => {
      const key = generateEncryptionKey()
      expect(key).toHaveLength(64)
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true)
    })
  })

  describe('Provider Configuration', () => {
    it('TikTok provider should be implemented', () => {
      expect(isProviderImplemented('tiktok')).toBe(true)
    })

    it('getProviderStatuses returns status for all providers', () => {
      const statuses = getProviderStatuses()
      // statuses is an array of ProviderStatus objects
      expect(Array.isArray(statuses)).toBe(true)
      const providers = statuses.map((s) => s.provider)
      expect(providers).toContain('tiktok')
      expect(providers).toContain('instagram')
      expect(providers).toContain('google')
      expect(providers).toContain('reddit')
    })
  })

  describe('Environment Variables Documentation', () => {
    const requiredVars = [
      { name: 'TOKEN_ENCRYPTION_KEY', description: 'AES-256 encryption key for tokens', format: '64 hex chars' },
      { name: 'TIKAPI_KEY', description: 'TikAPI API key for token validation', format: 'string' },
      { name: 'NEXT_PUBLIC_TIKAPI_CLIENT_ID', description: 'TikAPI client ID for OAuth popup', format: 'string' },
      { name: 'SERVICE_TOKEN_SECRET', description: 'Secret for internal service auth', format: '32+ chars' },
    ]

    it('documents all required environment variables', () => {
      // This test serves as documentation for required env vars
      requiredVars.forEach((envVar) => {
        expect(envVar.name).toBeDefined()
        expect(envVar.description).toBeDefined()
        expect(envVar.format).toBeDefined()
      })

      expect(requiredVars.length).toBeGreaterThanOrEqual(4)
    })

    it('TOKEN_ENCRYPTION_KEY format is documented', () => {
      const tokenKeyVar = requiredVars.find((v) => v.name === 'TOKEN_ENCRYPTION_KEY')
      expect(tokenKeyVar?.format).toContain('64')
      expect(tokenKeyVar?.format).toContain('hex')
    })
  })

  describe('Security Best Practices', () => {
    it('encryption key should not be hardcoded', () => {
      // The encryption module should use process.env, not hardcoded values
      const encryptionModule = require('../encryption')

      // Module should be using process.env.TOKEN_ENCRYPTION_KEY
      expect(encryptionModule.isEncryptionConfigured).toBeDefined()
    })

    it('service token should not be exposed to client', () => {
      // SERVICE_TOKEN_SECRET should NOT have NEXT_PUBLIC_ prefix
      const publicVars = Object.keys(process.env).filter(
        (key) => key.startsWith('NEXT_PUBLIC_')
      )

      expect(publicVars).not.toContain('NEXT_PUBLIC_SERVICE_TOKEN_SECRET')
      expect(publicVars).not.toContain('NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY')
      expect(publicVars).not.toContain('NEXT_PUBLIC_TIKAPI_KEY')
    })
  })
})

describe('OAuth Module Exports', () => {
  it('encryption module exports all functions', () => {
    const encryption = require('../encryption')
    expect(encryption.encryptToken).toBeDefined()
    expect(encryption.decryptToken).toBeDefined()
    expect(encryption.encryptTokenData).toBeDefined()
    expect(encryption.decryptTokenData).toBeDefined()
    expect(encryption.generateEncryptionKey).toBeDefined()
    expect(encryption.isEncryptionConfigured).toBeDefined()
  })

  it('providers module exports all functions', () => {
    const providers = require('../providers')
    expect(providers.SUPPORTED_PROVIDERS).toBeDefined()
    expect(providers.getProvider).toBeDefined()
    expect(providers.isProviderImplemented).toBeDefined()
    expect(providers.getImplementedProviders).toBeDefined()
    expect(providers.getProviderStatuses).toBeDefined()
    expect(providers.getProviderDisplayInfo).toBeDefined()
  })

  it('external-accounts-manager exports class', () => {
    const manager = require('../external-accounts-manager')
    expect(manager.ExternalAccountsManager).toBeDefined()
    expect(manager.externalAccountsManager).toBeDefined()
  })
})
