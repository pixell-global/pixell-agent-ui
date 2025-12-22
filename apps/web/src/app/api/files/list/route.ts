import { NextRequest, NextResponse } from 'next/server'
import { StorageManager } from '@pixell/file-storage'
import { resolveUserAndOrg, buildStorageConfigForContext } from '@/lib/workspace-path'
import { getDefaultContext, type StorageContext } from '@/lib/storage-context'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await resolveUserAndOrg(request)

    // If no user is authenticated, return empty file list
    if (!userId) {
      return NextResponse.json({
        success: true,
        files: [],
        path: '/',
        message: 'No files available - please sign in'
      })
    }

    // Get storage context from query params or default to user context
    const searchParams = request.nextUrl.searchParams
    const contextType = searchParams.get('context') || 'user'
    const contextId = searchParams.get('contextId')
    const recursive = searchParams.get('recursive') === 'true'

    let context: StorageContext
    switch (contextType) {
      case 'team':
        if (!contextId) {
          return NextResponse.json({
            success: false,
            error: 'teamId required for team context'
          }, { status: 400 })
        }
        context = { type: 'team', teamId: contextId }
        break

      case 'brand':
        if (!contextId) {
          return NextResponse.json({
            success: false,
            error: 'brandId required for brand context'
          }, { status: 400 })
        }
        context = { type: 'brand', brandId: contextId }
        break

      case 'shared':
        context = { type: 'shared' }
        break

      case 'user':
      default:
        context = getDefaultContext(userId)
        break
    }

    const config = buildStorageConfigForContext(orgId, context)
    const storage = new StorageManager()
    await storage.initialize(config)

    const relativePath = searchParams.get('path') || '/'
    const files = recursive
      ? await storage.listFilesRecursive(relativePath)
      : await storage.listFiles(relativePath)

    return NextResponse.json({
      success: true,
      files,
      path: relativePath,
      context: context.type
    })
  } catch (error) {
    console.error('Error listing files:', error)
    // Return a more user-friendly response for storage errors
    return NextResponse.json({
      success: true,
      files: [],
      path: '/',
      message: 'File storage temporarily unavailable'
    })
  }
}