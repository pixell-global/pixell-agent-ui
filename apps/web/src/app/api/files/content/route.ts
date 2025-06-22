import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs-extra'

const execAsync = promisify(exec)

// Get workspace path from environment or default
const getWorkspacePath = () => {
  return process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'workspace-files')
}

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
    
    const workspacePath = getWorkspacePath()
    const fullPath = path.join(workspacePath, filePath)
    
    // Ensure the path is within workspace (security check)
    if (!fullPath.startsWith(workspacePath)) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      )
    }
    
    try {
      // Check if file exists and get stats
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
      
      // Use cat command to read file content
      const { stdout } = await execAsync(`cat "${fullPath}"`, {
        cwd: workspacePath,
        encoding: 'utf8',
        maxBuffer: maxSize
      })
      
      return NextResponse.json({
        success: true,
        content: stdout,
        path: filePath,
        size: stats.size,
        lastModified: stats.mtime.toISOString()
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        )
      }
      
      console.error('Error reading file:', error)
      return NextResponse.json(
        { success: false, error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
} 