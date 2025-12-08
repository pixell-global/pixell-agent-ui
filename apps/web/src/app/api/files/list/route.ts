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

// Recursively read directory structure
const readDirectoryRecursive = async (dirPath: string, relativePath: string = ''): Promise<any[]> => {
  const files = []
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const item of items) {
      if (item.name.startsWith('.') && item.name !== '.temp') continue // Skip hidden files except .temp
      
      const itemPath = path.join(dirPath, item.name)
      const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name
      const stats = await fs.stat(itemPath)
      
      const fileNode = {
        id: Buffer.from(itemRelativePath).toString('base64'),
        name: item.name,
        path: `/${itemRelativePath}`,
        type: item.isDirectory() ? 'folder' : 'file',
        size: item.isDirectory() ? undefined : stats.size,
        lastModified: stats.mtime.toISOString(),
        isExpanded: false,
        children: undefined as any
      }
      
      // Recursively load children for directories
      if (item.isDirectory()) {
        try {
          const children = await readDirectoryRecursive(itemPath, itemRelativePath)
          fileNode.children = children
        } catch (error) {
          console.error(`Error reading directory ${itemPath}:`, error)
          fileNode.children = []
        }
      }
      
      files.push(fileNode)
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error)
  }
  
  return files
}

export async function GET(request: NextRequest) {
  try {
    const workspacePath = getWorkspacePath()
    
    // Check if workspace directory exists
    if (!(await pathExists(workspacePath))) {
      return NextResponse.json({
        success: true,
        files: [],
        path: '/'
      })
    }
    
    try {
      const files = await readDirectoryRecursive(workspacePath)
      
      return NextResponse.json({
        success: true,
        files,
        path: '/'
      })
    } catch (error) {
      console.error('Error reading workspace directory:', error)
      return NextResponse.json({
        success: true,
        files: [],
        path: '/'
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