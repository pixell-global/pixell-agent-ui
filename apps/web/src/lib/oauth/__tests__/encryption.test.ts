/**
 * Token Encryption Tests
 *
 * Tests for AES-256-GCM encryption/decryption utilities.
 */

import {
  encryptToken,
  decryptToken,
  encryptTokenData,
  decryptTokenData,
  generateEncryptionKey,
  isEncryptionConfigured,
} from '../encryption'

// Test encryption key (64 hex chars = 32 bytes)
const TEST_KEY = 'a'.repeat(64)

describe('Token Encryption', () => {
  beforeEach(() => {
    // Set test encryption key before each test
    process.env.OAUTH_ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    // Clean up
    delete process.env.OAUTH_ENCRYPTION_KEY
  })

  describe('encryptToken', () => {
    it('should encrypt a string', () => {
      const plaintext = 'test-access-token-12345'
      const encrypted = encryptToken(plaintext)

      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted).not.toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'test-token'
      const encrypted1 = encryptToken(plaintext)
      const encrypted2 = encryptToken(plaintext)

      // Due to random IV, encryptions should be different
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should produce base64 encoded output', () => {
      const plaintext = 'test-token'
      const encrypted = encryptToken(plaintext)

      // Valid base64 should not throw when decoded
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow()
    })

    it('should throw error for empty plaintext', () => {
      expect(() => encryptToken('')).toThrow('Cannot encrypt empty plaintext')
    })

    it('should handle special characters', () => {
      const plaintext = 'token!@#$%^&*()_+-=[]{}|;:,.<>?`~'
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle unicode characters', () => {
      const plaintext = 'token_with_emoji_🎉_and_日本語'
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle long tokens', () => {
      const plaintext = 'x'.repeat(10000)
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('decryptToken', () => {
    it('should decrypt an encrypted token', () => {
      const plaintext = 'my-secret-token'
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should throw error for empty encrypted data', () => {
      expect(() => decryptToken('')).toThrow('Cannot decrypt empty data')
    })

    it('should throw error for invalid base64', () => {
      expect(() => decryptToken('not-valid-base64!!!')).toThrow()
    })

    it('should throw error for too short data', () => {
      // Less than IV + auth tag (28 bytes)
      const shortData = Buffer.from('short').toString('base64')
      expect(() => decryptToken(shortData)).toThrow('Invalid encrypted data: too short')
    })

    it('should throw error for tampered ciphertext', () => {
      const encrypted = encryptToken('test-token')
      const buffer = Buffer.from(encrypted, 'base64')

      // Tamper with the ciphertext
      buffer[buffer.length - 1] ^= 0xff

      const tampered = buffer.toString('base64')
      expect(() => decryptToken(tampered)).toThrow('Failed to decrypt token')
    })

    it('should throw error when using wrong key', () => {
      const encrypted = encryptToken('test-token')

      // Change the key
      process.env.OAUTH_ENCRYPTION_KEY = 'b'.repeat(64)

      expect(() => decryptToken(encrypted)).toThrow('Failed to decrypt token')
    })
  })

  describe('encryptTokenData', () => {
    it('should encrypt access token only', () => {
      const result = encryptTokenData({
        accessToken: 'access-123',
      })

      expect(result.accessTokenEncrypted).toBeDefined()
      expect(result.refreshTokenEncrypted).toBeUndefined()
    })

    it('should encrypt both access and refresh tokens', () => {
      const result = encryptTokenData({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      })

      expect(result.accessTokenEncrypted).toBeDefined()
      expect(result.refreshTokenEncrypted).toBeDefined()
    })
  })

  describe('decryptTokenData', () => {
    it('should decrypt access token only', () => {
      const encrypted = encryptTokenData({
        accessToken: 'access-123',
      })

      const decrypted = decryptTokenData({
        accessTokenEncrypted: encrypted.accessTokenEncrypted,
      })

      expect(decrypted.accessToken).toBe('access-123')
      expect(decrypted.refreshToken).toBeUndefined()
    })

    it('should decrypt both tokens', () => {
      const encrypted = encryptTokenData({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      })

      const decrypted = decryptTokenData({
        accessTokenEncrypted: encrypted.accessTokenEncrypted,
        refreshTokenEncrypted: encrypted.refreshTokenEncrypted,
      })

      expect(decrypted.accessToken).toBe('access-123')
      expect(decrypted.refreshToken).toBe('refresh-456')
    })

    it('should handle null refresh token', () => {
      const encrypted = encryptTokenData({
        accessToken: 'access-123',
      })

      const decrypted = decryptTokenData({
        accessTokenEncrypted: encrypted.accessTokenEncrypted,
        refreshTokenEncrypted: null,
      })

      expect(decrypted.accessToken).toBe('access-123')
      expect(decrypted.refreshToken).toBeUndefined()
    })
  })

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey()

      expect(key.length).toBe(64)
      expect(/^[0-9a-f]+$/.test(key)).toBe(true)
    })

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey()
      const key2 = generateEncryptionKey()

      expect(key1).not.toBe(key2)
    })

    it('should generate keys usable for encryption', () => {
      const key = generateEncryptionKey()
      process.env.OAUTH_ENCRYPTION_KEY = key

      const plaintext = 'test-token'
      const encrypted = encryptToken(plaintext)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('isEncryptionConfigured', () => {
    it('should return true when key is configured', () => {
      expect(isEncryptionConfigured()).toBe(true)
    })

    it('should return false when key is not set', () => {
      delete process.env.OAUTH_ENCRYPTION_KEY
      expect(isEncryptionConfigured()).toBe(false)
    })

    it('should return false when key is wrong length', () => {
      process.env.OAUTH_ENCRYPTION_KEY = 'tooshort'
      expect(isEncryptionConfigured()).toBe(false)
    })

    it('should return false when key is not hex', () => {
      process.env.OAUTH_ENCRYPTION_KEY = 'z'.repeat(64) // z is not hex
      expect(isEncryptionConfigured()).toBe(false)
    })
  })

  describe('missing encryption key', () => {
    beforeEach(() => {
      delete process.env.OAUTH_ENCRYPTION_KEY
    })

    it('should throw when encrypting without key', () => {
      expect(() => encryptToken('test')).toThrow(
        'OAUTH_ENCRYPTION_KEY environment variable is not set'
      )
    })

    it('should throw when decrypting without key', () => {
      expect(() => decryptToken('dGVzdA==')).toThrow(
        'OAUTH_ENCRYPTION_KEY environment variable is not set'
      )
    })
  })

  describe('invalid encryption key', () => {
    it('should throw for key too short', () => {
      process.env.OAUTH_ENCRYPTION_KEY = 'abcd'
      expect(() => encryptToken('test')).toThrow(
        'OAUTH_ENCRYPTION_KEY must be exactly 64 hex characters'
      )
    })

    it('should throw for key too long', () => {
      process.env.OAUTH_ENCRYPTION_KEY = 'a'.repeat(128)
      expect(() => encryptToken('test')).toThrow(
        'OAUTH_ENCRYPTION_KEY must be exactly 64 hex characters'
      )
    })

    it('should throw for non-hex key', () => {
      process.env.OAUTH_ENCRYPTION_KEY = 'g'.repeat(64) // g is not hex
      expect(() => encryptToken('test')).toThrow(
        'OAUTH_ENCRYPTION_KEY must be a valid hex string'
      )
    })
  })
})
