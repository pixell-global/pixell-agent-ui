/**
 * Enterprise security utilities and hardening features
 */

import { NextRequest } from 'next/server'

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string
}

/**
 * In-memory rate limit store (replace with Redis in production)
 */
class InMemoryRateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key)
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key)
      return undefined
    }
    return entry
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now()
    const resetTime = now + windowMs
    
    const existing = this.get(key)
    if (existing) {
      existing.count++
      return existing
    } else {
      const newEntry = { count: 1, resetTime }
      this.store.set(key, newEntry)
      return newEntry
    }
  }

  reset(key: string): void {
    this.store.delete(key)
  }
}

const rateLimitStore = new InMemoryRateLimitStore()

/**
 * Rate limiting middleware
 */
export const createRateLimit = (config: RateLimitConfig) => {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = config

  return (req: NextRequest): { limited: boolean; remaining: number; resetTime: number } => {
    const key = keyGenerator(req)
    const { count, resetTime } = rateLimitStore.increment(key, windowMs)
    
    return {
      limited: count > maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetTime,
    }
  }
}

function defaultKeyGenerator(req: NextRequest): string {
  // Use forwarded IP or fallback to connection IP
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'
  return `rate_limit:${ip}`
}

/**
 * CSRF protection utilities
 */
export const generateCSRFToken = async (): Promise<string> => {
  if (typeof window !== 'undefined') {
    // Client-side: use crypto.getRandomValues
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  } else {
    // Server-side: use Node.js crypto
    try {
      const crypto = await import('crypto')
      return crypto.randomBytes(32).toString('hex')
    } catch {
      // Fallback if crypto is not available
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }
  }
}

export const validateCSRFToken = (token: string, sessionToken: string): boolean => {
  return token === sessionToken && token.length === 64
}

/**
 * Secure session management
 */
export interface SecureSessionConfig {
  maxAge: number // Session duration in seconds
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict' | 'lax' | 'none'
}

export const defaultSessionConfig: SecureSessionConfig = {
  maxAge: 24 * 60 * 60, // 24 hours
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
}

/**
 * Input sanitization
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Audit logging
 */
export interface AuditLogEntry {
  userId?: string
  action: string
  resource?: string
  details?: Record<string, any>
  timestamp: string
  ip?: string
  userAgent?: string
  success: boolean
}

export const createAuditLog = (
  action: string,
  options: Partial<AuditLogEntry> = {}
): AuditLogEntry => {
  return {
    action,
    timestamp: new Date().toISOString(),
    success: true,
    ...options,
  }
}

/**
 * Security headers
 */
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: unsafe-* needed for Next.js in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https:",
    "connect-src 'self' ws: wss: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

/**
 * Password strength validation
 */
export interface PasswordStrength {
  score: number // 0-4
  feedback: string[]
  isValid: boolean
}

export const validatePasswordStrength = (password: string): PasswordStrength => {
  const feedback: string[] = []
  let score = 0

  // Length check
  if (password.length >= 8) score++
  else feedback.push('Password must be at least 8 characters long')

  if (password.length >= 12) score++

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  else feedback.push('Password must contain both uppercase and lowercase letters')

  if (/\d/.test(password)) score++
  else feedback.push('Password must contain at least one number')

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++
  else feedback.push('Password must contain at least one special character')

  // Common patterns check
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters
    /123456|password|qwerty/i, // Common sequences
  ]

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      feedback.push('Password contains common patterns')
      score = Math.max(0, score - 1)
      break
    }
  }

  return {
    score,
    feedback,
    isValid: score >= 3,
  }
}

/**
 * Environment-specific security settings
 */
export const getSecurityConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'

  return {
    enforceHTTPS: isProduction,
    enableCSRF: true,
    sessionTimeout: isProduction ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 1 day prod, 7 days dev
    rateLimits: {
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: isProduction ? 5 : 20, // Stricter in production
      },
      api: {
        windowMs: 1 * 60 * 1000, // 1 minute
        maxRequests: isProduction ? 60 : 200,
      },
    },
    auditLogging: {
      enabled: true,
      logFailedAttempts: true,
      logSuccessfulAuth: isProduction,
    },
  }
}

/**
 * IP address utilities
 */
export const getClientIP = (req: NextRequest): string => {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfConnectingIp = req.headers.get('cf-connecting-ip') // Cloudflare
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return cfConnectingIp || realIp || 'unknown'
}

/**
 * Security event types for monitoring
 */
export const SecurityEvents = {
  AUTH_SUCCESS: 'auth.success',
  AUTH_FAILURE: 'auth.failure',
  RATE_LIMIT_HIT: 'security.rate_limit',
  CSRF_FAILURE: 'security.csrf_failure',
  UNAUTHORIZED_ACCESS: 'security.unauthorized',
  SUSPICIOUS_ACTIVITY: 'security.suspicious',
} as const

export type SecurityEvent = typeof SecurityEvents[keyof typeof SecurityEvents]