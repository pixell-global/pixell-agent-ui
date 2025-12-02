import { NextRequest, NextResponse } from 'next/server'
import { getDb, waitlist } from '@pixell/db-mysql'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://pixellagents.com',
  'https://www.pixellagents.com',
  'https://pixell.global',
  'https://www.pixell.global',
]

// Allow localhost in development
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003')
}

// Slack webhook URL from environment
const SLACK_WEBHOOK_URL = process.env.SLACK_WAITLIST_WEBHOOK_URL

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Verify origin (skip in development if no origin)
  if (process.env.NODE_ENV !== 'development') {
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json(
        { error: 'Unauthorized origin' },
        { status: 403, headers: corsHeaders }
      )
    }
  }

  try {
    const body = await request.json()
    const { email } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400, headers: corsHeaders }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const db = await getDb()

    // Check for duplicate
    const [existing] = await db.select()
      .from(waitlist)
      .where(eq(waitlist.email, normalizedEmail))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { success: true, message: 'Already on waitlist' },
        { status: 200, headers: corsHeaders }
      )
    }

    // Get client IP
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip')
      || null

    // Insert new signup
    await db.insert(waitlist).values({
      email: normalizedEmail,
      source: origin || 'unknown',
      ipAddress,
    })

    // Send Slack notification (async, don't block response)
    sendSlackNotification(normalizedEmail, origin || 'unknown').catch(console.error)

    return NextResponse.json(
      { success: true, message: 'Added to waitlist' },
      { status: 201, headers: corsHeaders }
    )

  } catch (error) {
    console.error('[Waitlist] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

async function sendSlackNotification(email: string, source: string) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[Waitlist] Slack webhook URL not configured')
    return
  }

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🎉 New waitlist signup!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Waitlist Signup*\n📧 ${email}\n🌐 Source: ${source}\n⏰ ${new Date().toISOString()}`,
            },
          },
        ],
      }),
    })
  } catch (error) {
    console.error('[Waitlist] Failed to send Slack notification:', error)
  }
}
