/**
 * Service Token Authentication
 *
 * Provides authentication for orchestrator-only API endpoints.
 * Service tokens are used for server-to-server communication.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Generate a new service token
 * Run this once to generate your SERVICE_TOKEN_SECRET
 */
export function generateServiceToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validate service token from request headers
 */
export function validateServiceToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return false
  }

  // Expected format: "Bearer <token>"
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return false
  }

  const expectedToken = process.env.SERVICE_TOKEN_SECRET

  if (!expectedToken) {
    console.error('[Service Token] SERVICE_TOKEN_SECRET not configured')
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  // First check length to avoid crypto.timingSafeEqual error
  if (token.length !== expectedToken.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken)
    )
  } catch (error) {
    // Handle any buffer comparison errors
    return false
  }
}

/**
 * Middleware wrapper for service token authentication
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authResult = requireServiceToken(request)
 *   if (authResult) return authResult
 *
 *   // ... protected route logic
 * }
 * ```
 */
export function requireServiceToken(request: NextRequest): NextResponse | null {
  try {
    if (validateServiceToken(request)) {
      return null // Token valid, proceed
    }
  } catch (error) {
    console.error('[Service Token] Validation error:', error)
  }

  return NextResponse.json(
    { error: 'Unauthorized', message: 'Valid service token required' },
    { status: 401 }
  )
}

/**
 * Helper to check if service token is configured
 */
export function isServiceTokenConfigured(): boolean {
  return !!process.env.SERVICE_TOKEN_SECRET && process.env.SERVICE_TOKEN_SECRET.length >= 32
}
