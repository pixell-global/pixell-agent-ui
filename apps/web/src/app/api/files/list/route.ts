import { NextRequest, NextResponse } from 'next/server'
import { getUserScopedStorage } from '@/lib/user-storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestPath = searchParams.get('path') || '/'
    const recursive = searchParams.get('recursive') === 'true'

    // Get user-scoped storage (authenticated only)
    // Anonymous users get an empty file list since they have no storage allocation
    const userContext = await getUserScopedStorage(request)

    if (!userContext) {
      // User not authenticated or no org - return empty file list
      return NextResponse.json({
        success: true,
        files: [],
        path: requestPath,
        storagePath: null,
        message: 'No storage available - please sign in and create an organization'
      })
    }

    try {
      // Use recursive listing to pre-load all folder contents
      const files = recursive
        ? await userContext.storage.listFilesRecursive(requestPath)
        : await userContext.storage.listFiles(requestPath)

      return NextResponse.json({
        success: true,
        files,
        path: requestPath,
        storagePath: userContext.storagePath
      })
    } catch (error) {
      console.error('Error reading storage:', error)
      // Return empty array on storage read error (e.g., bucket doesn't have files yet)
      return NextResponse.json({
        success: true,
        files: [],
        path: requestPath,
        storagePath: userContext.storagePath
      })
    }
  } catch (error) {
    console.error('Error listing files:', error)
    // Return empty files on any error instead of 500
    return NextResponse.json({
      success: true,
      files: [],
      path: '/',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 