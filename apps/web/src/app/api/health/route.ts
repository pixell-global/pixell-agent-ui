import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'


export async function GET() {
  // Basic health check - always return 200 to indicate the web app is running
  // The orchestrator health is checked separately by the frontend
  return NextResponse.json({
    status: 'ok',
    service: 'pixell-web',
    timestamp: new Date().toISOString()
  })
} 