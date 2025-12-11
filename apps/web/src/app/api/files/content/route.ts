import { NextRequest, NextResponse } from 'next/server'
import { StorageManager } from '@pixell/file-storage'
import { resolveUserAndOrg, buildStorageConfigForContext } from '@/lib/workspace-path'
import { getDefaultContext, type StorageContext } from '@/lib/storage-context'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')
    const format = searchParams.get('format') // 'base64' for binary files (not used for adapters)

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      )
    }

    const { userId, orgId } = await resolveUserAndOrg(request)

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get storage context
    const contextType = searchParams.get('context') || 'user'
    const contextId = searchParams.get('contextId')

    let context: StorageContext
    switch (contextType) {
      case 'team':
        if (!contextId) throw new Error('teamId required for team context')
        context = { type: 'team', teamId: contextId }
        break
      case 'brand':
        if (!contextId) throw new Error('brandId required for brand context')
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

    // Read via adapter; S3Adapter already handles size checks
    const { content, metadata } = await storage.readFile(filePath.startsWith('/') ? filePath : `/${filePath}`)

    return NextResponse.json({
      success: true,
      content,
      path: filePath,
      size: metadata.size,
      format: format || 'text',
      encoding: 'utf8',
      lastModified: metadata.lastModified
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to read file' },
      { status: 500 }
    )
  }
}