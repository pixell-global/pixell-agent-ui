import { NextRequest, NextResponse } from 'next/server'
import { getUserScopedStorage } from '@/lib/user-storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      )
    }

    // Get user-scoped storage (authenticated only)
    const userContext = await getUserScopedStorage(request)

    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const storage = userContext.storage

    // Normalize path (remove leading slash)
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath

    try {
      const { content, metadata } = await storage.readFile(normalizedPath)

      return NextResponse.json({
        success: true,
        content,
        path: filePath,
        size: metadata.size,
        format: 'text',
        encoding: 'utf8',
        lastModified: metadata.lastModified
      })
    } catch (error) {
      console.error('File read error:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('not found') || errorMessage.includes('ENOENT') || errorMessage.includes('NoSuchKey')) {
        return NextResponse.json(
          { success: false, error: `File not found: ${filePath}` },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: false, error: `Failed to read file: ${errorMessage}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Request processing error:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
} 