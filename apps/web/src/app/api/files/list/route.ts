import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// Get workspace path from environment or default
const getWorkspacePath = () => {
  return process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'workspace-files')
}

// Convert filesystem output to FileNode structure
const parseFileList = (output: string, basePath: string) => {
  const lines = output.split('\n').filter(line => line.trim())
  const files = []
  
  for (const line of lines) {
    // Parse ls -la output: permissions size date time name
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue
    
    const permissions = parts[0]
    const size = parseInt(parts[4]) || 0
    const name = parts.slice(8).join(' ')
    
    if (name === '.' || name === '..') continue
    
    const isDirectory = permissions.startsWith('d')
    const filePath = basePath === '/' ? `/${name}` : `${basePath}/${name}`
    
    files.push({
      id: Buffer.from(filePath).toString('base64'),
      name,
      path: filePath,
      type: isDirectory ? 'folder' : 'file',
      size: isDirectory ? undefined : size,
      lastModified: new Date().toISOString(), // Would need more parsing for actual date
      children: isDirectory ? [] : undefined,
      isExpanded: false
    })
  }
  
  return files
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderPath = searchParams.get('path') || '/'
    const workspacePath = getWorkspacePath()
    
    // Use the filesystem CLI ls command
    const targetPath = folderPath === '/' ? workspacePath : path.join(workspacePath, folderPath)
    
    try {
      const { stdout } = await execAsync(`ls -la "${targetPath}"`, {
        cwd: workspacePath
      })
      
      const files = parseFileList(stdout, folderPath)
      
      return NextResponse.json({
        success: true,
        files,
        path: folderPath
      })
    } catch (error) {
      // If directory doesn't exist, return empty array
      return NextResponse.json({
        success: true,
        files: [],
        path: folderPath
      })
    }
  } catch (error) {
    console.error('Error listing files:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list files' },
      { status: 500 }
    )
  }
} 