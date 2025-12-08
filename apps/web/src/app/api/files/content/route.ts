import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

// Helper to check if path exists
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}


// Get workspace path from environment or default
const getWorkspacePath = () => {
  return process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'workspace-files')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')
    const format = searchParams.get('format') // 'base64' for binary files
    
    console.log('🔍 [API] files/content 요청:', { filePath, format })
    
    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      )
    }
    
    const workspacePath = getWorkspacePath()
    
    // Remove leading slash for proper path joining on Windows
    const normalizedFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath
    const fullPath = path.join(workspacePath, normalizedFilePath)
    
    console.log('🔍 [API] 경로 정보:', {
      workspacePath,
      originalFilePath: filePath,
      normalizedFilePath,
      fullPath,
      workspaceExists: await pathExists(workspacePath),
      fileExists: await pathExists(fullPath)
    })
    
    // Ensure the path is within workspace (security check)
    if (!fullPath.startsWith(workspacePath)) {
      console.log('❌ [API] 보안 검사 실패:', { fullPath, workspacePath })
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      )
    }
    
    try {
      // Check if file exists and get stats
      console.log('🔍 [API] 파일 상태 확인 중:', fullPath)
      const stats = await fs.stat(fullPath)
      
      if (stats.isDirectory()) {
        return NextResponse.json(
          { success: false, error: 'Cannot read directory as file' },
          { status: 400 }
        )
      }
      
      // Check file size limit (10MB for content reading)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (stats.size > maxSize) {
        return NextResponse.json(
          { success: false, error: `File too large to read (max ${maxSize / (1024 * 1024)}MB)` },
          { status: 400 }
        )
      }
      
      let content: string
      let detectedEncoding: 'utf8' | 'utf16le' = 'utf8'
      
      console.log('🔍 [API] 파일 읽기 시작:', { format, fileSize: stats.size })
      
      if (format === 'base64') {
        console.log('🔍 [API] Base64로 파일 읽기')
        // Read binary file as base64
        const buffer = await fs.readFile(fullPath)
        content = buffer.toString('base64')
        console.log('✅ [API] Base64 읽기 완료:', { contentLength: content.length })
      } else {
        console.log('🔍 [API] 텍스트로 파일 읽기 - 인코딩 자동 감지')
        // Read as raw buffer first to detect BOM/encoding
        const raw = await fs.readFile(fullPath)
        // UTF-8 BOM
        if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
          content = raw.slice(3).toString('utf8')
          detectedEncoding = 'utf8'
        } else if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
          // UTF-16 LE BOM
          content = raw.slice(2).toString('utf16le')
          detectedEncoding = 'utf16le'
        } else if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
          // UTF-16 BE BOM → convert to LE by swapping bytes
          const le = Buffer.allocUnsafe(raw.length - 2)
          for (let i = 2; i < raw.length; i += 2) {
            const a = raw[i]
            const b = raw[i + 1]
            le[i - 2] = b
            le[i - 1] = a
          }
          content = le.toString('utf16le')
          detectedEncoding = 'utf16le'
        } else {
          // Default to UTF‑8
          content = raw.toString('utf8')
          detectedEncoding = 'utf8'
        }
        console.log('✅ [API] 텍스트 읽기 완료:', { contentLength: content.length, detectedEncoding })
      }
      
      return NextResponse.json({
        success: true,
        content: content,
        path: filePath,
        size: stats.size,
        format: format || 'text',
        encoding: detectedEncoding,
        lastModified: stats.mtime.toISOString()
      })
    } catch (error) {
      console.error('❌ [API] 파일 읽기 에러:', error)
      
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.error('❌ [API] 파일 없음:', fullPath)
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        )
      }
      
      console.error('❌ [API] 일반적인 파일 읽기 에러:', error)
      return NextResponse.json(
        { success: false, error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ [API] 요청 처리 에러:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
} 