import { NextRequest, NextResponse } from 'next/server'
import { ensureRootEnvLoaded } from '@/lib/root-env'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // PAF Core Agent integration disabled - return empty activity data
  return NextResponse.json({
    message: 'No activity available',
    payload: {
      activities: [],
      total: 0
    }
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
