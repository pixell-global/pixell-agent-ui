import { NextRequest, NextResponse } from 'next/server'
import { StorageManager, LocalAdapter } from '../../../lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || '/'
    const action = searchParams.get('action') || 'list'

    // Initialize storage manager with local adapter for demo
    const storage = new StorageManager()
    await storage.initialize({
      adapter: new LocalAdapter(),
      config: {
        rootPath: process.cwd() + '/workspace-files'
      }
    })

    switch (action) {
      case 'list':
        const files = await storage.listFiles(path)
        return NextResponse.json({ files })

      case 'read':
        if (!path || path === '/') {
          return NextResponse.json({ error: 'File path required' }, { status: 400 })
        }
        const { content, metadata } = await storage.readFile(path)
        return NextResponse.json({ content, metadata })

      case 'search':
        const query = searchParams.get('q')
        if (!query) {
          return NextResponse.json({ error: 'Search query required' }, { status: 400 })
        }
        const results = await storage.searchFiles(query, path)
        return NextResponse.json({ files: results })

      case 'stats':
        const stats = await storage.getStorageStats()
        return NextResponse.json({ stats })

      case 'status':
        const status = await storage.getStatus()
        return NextResponse.json({ status })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('File API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const path = formData.get('path') as string || '/'
    const action = formData.get('action') as string || 'upload'

    if (!file && action === 'upload') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Initialize storage manager
    const storage = new StorageManager()
    await storage.initialize({
      adapter: new LocalAdapter(),
      config: {
        rootPath: process.cwd() + '/workspace-files'
      }
    })

    switch (action) {
      case 'upload':
        const uploadedFile = await storage.uploadFile(path, file)
        return NextResponse.json({ file: uploadedFile })

      case 'write':
        const content = formData.get('content') as string
        if (!content) {
          return NextResponse.json({ error: 'Content required' }, { status: 400 })
        }
        const writtenFile = await storage.writeFile(path, content)
        return NextResponse.json({ file: writtenFile })

      case 'create-folder':
        const folderName = formData.get('name') as string
        if (!folderName) {
          return NextResponse.json({ error: 'Folder name required' }, { status: 400 })
        }
        const folderPath = path.endsWith('/') ? `${path}${folderName}` : `${path}/${folderName}`
        const folder = await storage.createFolder(folderPath)
        return NextResponse.json({ folder })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 })
    }

    // Initialize storage manager
    const storage = new StorageManager()
    await storage.initialize({
      adapter: new LocalAdapter(),
      config: {
        rootPath: process.cwd() + '/workspace-files'
      }
    })
    
    await storage.deleteFile(path)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('File delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    )
  }
} 