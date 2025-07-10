import { NextRequest, NextResponse } from 'next/server'
import { getServerStorageManager } from '@/lib/storage-client'
import { createRateLimit, getClientIP } from '@/lib/security'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    // Verify authentication
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Create storage manager and generate signed URL
    const storageManager = getServerStorageManager()
    
    const userFolder = folder || `users/${session.user.id}/uploads`
    const uploadResult = await storageManager.createSignedUploadUrl(filename, {
      folder: userFolder,
      contentType,
    })

    // Log upload attempt
    console.log('File upload signed URL created:', {
      userId: session.user.id,
      filename,
      folder: userFolder,
      path: uploadResult.path,
      ip: getClientIP(req),
    })

    return NextResponse.json({
      success: true,
      signedUrl: uploadResult.signedUrl,
      path: uploadResult.path,
      token: uploadResult.token,
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

// Handle file completion notification
export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { path, success } = body

    if (!path) {
      return NextResponse.json(
        { error: 'Missing file path' },
        { status: 400 }
      )
    }

    // Get public URL for the uploaded file
    const storageManager = getServerStorageManager()
    const publicUrl = await storageManager.getPublicUrl(path)

    // Log upload completion
    console.log('File upload completed:', {
      userId: session.user.id,
      path,
      success,
      publicUrl,
      ip: getClientIP(req),
    })

    return NextResponse.json({
      success: true,
      path,
      publicUrl,
    })
  } catch (error) {
    console.error('File upload completion error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload completion failed',
        success: false 
      },
      { status: 500 }
    )
  }
}