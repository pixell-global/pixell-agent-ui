import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createRateLimit, getClientIP, SecurityEvents, createAuditLog } from '@/lib/security'

// Rate limiting for audit endpoint
const rateLimiter = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10,
})

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

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
    // Verify user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { event, details } = body

    // Create audit log entry
    const auditEntry = createAuditLog(event, {
      userId: session.user.id,
      details,
      ip: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    })

    // Insert into audit log table (if it exists)
    const { error } = await supabase
      .from('audit_logs')
      .insert([auditEntry])

    if (error && !error.message.includes('relation "audit_logs" does not exist')) {
      console.error('Audit log error:', error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Audit endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}