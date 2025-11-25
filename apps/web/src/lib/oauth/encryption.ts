/**
 * Token Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for OAuth tokens.
 * Uses the Web Crypto API for cryptographic operations.
 *
 * Security considerations:
 * - Never log decrypted tokens
 * - Key should be stored in environment variable (OAUTH_ENCRYPTION_KEY)
 * - IV is randomly generated for each encryption and prepended to ciphertext
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

// AES-256-GCM parameters
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM recommended IV length
const AUTH_TAG_LENGTH = 16 // GCM auth tag length

/**
 * Get the encryption key from environment variable
 * Key must be exactly 64 hex characters (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY

  if (!key) {
    throw new Error('OAUTH_ENCRYPTION_KEY environment variable is not set')
  }

  if (key.length !== 64) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'
    )
  }

  // Validate hex string
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be a valid hex string')
  }

  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a string using AES-256-GCM
 *
 * Output format: base64(iv + authTag + ciphertext)
 *
 * @param plaintext - The string to encrypt
 * @returns Base64 encoded encrypted data
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty plaintext')
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  // Combine IV + auth tag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])

  return combined.toString('base64')
}

/**
 * Decrypt a string encrypted with encryptToken
 *
 * @param encryptedData - Base64 encoded encrypted data
 * @returns The decrypted plaintext
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty data')
  }

  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract IV, auth tag, and ciphertext
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    throw new Error('Failed to decrypt token: invalid data or wrong key')
  }
}

/**
 * Encrypt token data with additional metadata validation
 *
 * @param tokenData - Object containing token and optional metadata
 * @returns Base64 encoded encrypted JSON
 */
export function encryptTokenData(tokenData: {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes?: string[]
}): { accessTokenEncrypted: string; refreshTokenEncrypted?: string } {
  const result: { accessTokenEncrypted: string; refreshTokenEncrypted?: string } = {
    accessTokenEncrypted: encryptToken(tokenData.accessToken),
  }

  if (tokenData.refreshToken) {
    result.refreshTokenEncrypted = encryptToken(tokenData.refreshToken)
  }

  return result
}

/**
 * Decrypt token data
 *
 * @param encryptedData - Object containing encrypted tokens
 * @returns Decrypted token data
 */
export function decryptTokenData(encryptedData: {
  accessTokenEncrypted: string
  refreshTokenEncrypted?: string | null
}): { accessToken: string; refreshToken?: string } {
  const result: { accessToken: string; refreshToken?: string } = {
    accessToken: decryptToken(encryptedData.accessTokenEncrypted),
  }

  if (encryptedData.refreshTokenEncrypted) {
    result.refreshToken = decryptToken(encryptedData.refreshTokenEncrypted)
  }

  return result
}

/**
 * Generate a new random encryption key
 * Use this to create a new OAUTH_ENCRYPTION_KEY
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Check if the encryption key is properly configured
 *
 * @returns true if key is valid, false otherwise
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}
