import { NextRequest, NextResponse } from 'next/server'
import { getUserScopedStorage } from '@/lib/user-storage'
import { createRateLimit, getClientIP } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Rate limiting for file uploads
const rateLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // Max 10 uploads per 15 minutes
})

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const { limited, remaining } = rateLimiter(req)
    if (limited) {
      return NextResponse.json(
        { error: 'Too many upload requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': remaining.toString(),
          }
        }
      )
    }

    // Get user-scoped storage (authenticated only)
    const userContext = await getUserScopedStorage(req)

    if (!userContext) {
      return NextResponse.json(
        { error: 'Authentication required', success: false },
        { status: 401 }
      )
    }

    const storage = userContext.storage

    const body = await req.json()
    const { filename, folder, contentType } = body

    // Validate inputs
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Check file extension for security
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', // Images
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // Documents
      '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', // Text files
      '.zip', '.tar', '.gz', '.rar', // Archives
      '.mp4', '.webm', '.mov', '.avi', // Videos
      '.mp3', '.wav', '.ogg', '.flac', // Audio
    ]

    const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Use provided folder or default to uploads
    const uploadFolder = folder || 'uploads'
    const finalFilename = `${Date.now()}-${filename}`
    const uploadPath = `${uploadFolder}/${finalFilename}`

    // Log upload attempt
    console.log('File upload initiated:', {
      userId: userContext?.userId || 'anonymous',
      storagePath: userContext?.storagePath || 'anonymous',
      filename,
      folder: uploadFolder,
      path: uploadPath,
      ip: getClientIP(req),
    })

    return NextResponse.json({
      success: true,
      path: uploadPath,
      storagePath: userContext?.storagePath || null,
    })
  } catch (error) {
    console.error('File upload error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
        success: false
      },
      { status: 500 }
    )
  }
}

// Handle direct file upload via FormData
export async function PUT(req: NextRequest) {
  try {
    // Get user-scoped storage (authenticated only)
    const userContext = await getUserScopedStorage(req)

    if (!userContext) {
      return NextResponse.json(
        { error: 'Authentication required', success: false },
        { status: 401 }
      )
    }

    const storage = userContext.storage

    const formData = await req.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'uploads'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const uploadPath = `${folder}/${file.name}`
    const uploadedFile = await storage.uploadFile(uploadPath, file)

    console.log('File uploaded:', {
      userId: userContext?.userId || 'anonymous',
      storagePath: userContext?.storagePath || 'anonymous',
      path: uploadPath,
      ip: getClientIP(req),
    })

    return NextResponse.json({
      success: true,
      file: uploadedFile,
    })
  } catch (error) {
    console.error('File upload error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
        success: false
      },
      { status: 500 }
    )
  }
}
