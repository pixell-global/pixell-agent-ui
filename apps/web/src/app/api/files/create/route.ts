import { NextRequest, NextResponse } from 'next/server'
import { getUserScopedStorage } from '@/lib/user-storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get user-scoped storage (authenticated only)
    const userContext = await getUserScopedStorage(request)

    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const storage = userContext.storage

    let filePath: string
    let content: string = ''
    let type: string = 'file'
    let uploadedFile: File | null = null

    const contentType = request.headers.get('content-type')

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData for file uploads
      const formData = await request.formData()
      const file = formData.get('file') as File
      const pathFromForm = formData.get('path') as string

      if (file && pathFromForm) {
        uploadedFile = file
        filePath = pathFromForm.endsWith('/') ? `${pathFromForm}${file.name}` : `${pathFromForm}/${file.name}`
        type = 'file'
      } else {
        return NextResponse.json(
          { success: false, error: 'File and path are required for file upload' },
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

    // Normalize path (remove leading slash)
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath

    try {
      if (type === 'folder') {
        const folder = await storage.createFolder(normalizedPath)

        return NextResponse.json({
          success: true,
          message: `Folder created: ${filePath}`,
          path: filePath,
          type: 'folder',
          file: folder
        })
      } else {
        let createdFile

        if (uploadedFile) {
          // Handle file upload
          createdFile = await storage.uploadFile(normalizedPath, uploadedFile)
        } else {
          // Create file with text content (or empty)
          createdFile = await storage.writeFile(normalizedPath, content)
        }

        return NextResponse.json({
          success: true,
          message: `File created: ${filePath}`,
          path: filePath,
          type: 'file',
          size: createdFile.size,
          lastModified: createdFile.lastModified,
          file: createdFile
        })
      }
    } catch (error) {
      console.error('Error creating file/folder:', error)
      return NextResponse.json(
        { success: false, error: `Failed to create ${type}: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error parsing request:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
} 