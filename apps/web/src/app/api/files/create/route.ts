import { NextRequest, NextResponse } from 'next/server'
import { StorageManager } from '@pixell/file-storage'
import { resolveUserAndOrg, buildStorageConfigForContext } from '@/lib/workspace-path'
import { getDefaultContext, type StorageContext } from '@/lib/storage-context'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await resolveUserAndOrg(request)

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to create files' },
        { status: 401 }
      )
    }

    let filePath: string
    let content: string = ''
    let type: string = 'file'
    let uploadedFile: File | null = null

    const contentType = request.headers.get('content-type')
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData for file uploads
      const formData = await request.formData()
      const file = formData.get('file') as File
      const pathFromForm = (formData.get('path') as string) || ''

      if (file) {
        uploadedFile = file
        const base = pathFromForm.replace(/\/+$/g, '')
        filePath = base ? `${base}/${file.name}` : file.name
        type = 'file'
      } else {
        return NextResponse.json(
          { success: false, error: 'File is required for upload' },
          { status: 400 }
        )
      }
    } else {
      // Handle JSON for regular file/folder creation
      const body = await request.json()
      filePath = body.path
      content = body.content || ''
      type = body.type || 'file'
    }

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      )
    }
    try {
      // Get storage context from query params or request body (defaults to user context)
      const searchParams = request.nextUrl.searchParams
      const contextType = searchParams.get('context') || 'user'
      const contextId = searchParams.get('contextId')

      let context: StorageContext
      switch (contextType) {
        case 'team':
          if (!contextId) {
            return NextResponse.json({ success: false, error: 'teamId required for team context' }, { status: 400 })
          }
          context = { type: 'team', teamId: contextId }
          break
        case 'brand':
          if (!contextId) {
            return NextResponse.json({ success: false, error: 'brandId required for brand context' }, { status: 400 })
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

      // Normalize leading slash for adapter API
      const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`

      if (type === 'folder') {
        const node = await storage.createFolder(normalizedPath.replace(/\/+$/g, ''))
        return NextResponse.json({ success: true, ...node })
      } else if (uploadedFile) {
        const node = await storage.uploadFile(normalizedPath, uploadedFile)
        return NextResponse.json({ success: true, ...node })
      } else {
        const node = await storage.writeFile(normalizedPath, content)
        return NextResponse.json({ success: true, ...node })
      }
    } catch (error) {
      console.error('File creation error:', error)
      return NextResponse.json(
        { success: false, error: `File storage temporarily unavailable` },
        { status: 503 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
}