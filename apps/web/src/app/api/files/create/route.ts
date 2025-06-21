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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path: filePath, content = '', type } = body
    
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
      if (type === 'folder') {
        // Create directory using filesystem CLI
        await execAsync(`mkdir -p "${fullPath}"`, {
          cwd: workspacePath
        })
        
        return NextResponse.json({
          success: true,
          message: `Folder created: ${filePath}`,
          path: filePath,
          type: 'folder'
        })
      } else {
        // Create file using filesystem CLI
        // First ensure parent directory exists
        const parentDir = path.dirname(fullPath)
        await fs.ensureDir(parentDir)
        
        // Create the file with content
        if (content) {
          await fs.writeFile(fullPath, content, 'utf-8')
        } else {
          // Use touch command for empty file
          await execAsync(`touch "${fullPath}"`, {
            cwd: workspacePath
          })
        }
        
        const stats = await fs.stat(fullPath)
        
        return NextResponse.json({
          success: true,
          message: `File created: ${filePath}`,
          path: filePath,
          type: 'file',
          size: stats.size,
          lastModified: stats.mtime.toISOString()
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