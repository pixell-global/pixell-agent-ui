import { NextRequest, NextResponse } from 'next/server'
import { createRateLimit, getClientIP, createAuditLog } from '@/lib/security'

// Rate limiting for audit endpoint
const rateLimiter = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10,
})

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const { limited, remaining } = rateLimiter(req)
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': remaining.toString(),
        }
      }
    )
  }

  try {
    // Note: Supabase auth has been removed
    // For now, we'll log audit events without user verification
    // In production, implement your own auth check here

    const body = await req.json()
    const { event, details, userId } = body

    // Create audit log entry
    const auditEntry = createAuditLog(event, {
      userId: userId || 'anonymous',
      details,
      ip: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    })

    // Log to console (replace with your own logging solution)
    console.log('[Audit]', auditEntry)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Audit endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
