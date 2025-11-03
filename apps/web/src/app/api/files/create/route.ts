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
    console.log('=== 파일 생성 API 호출 시작 ===')
    let filePath: string
    let content: string = ''
    let type: string = 'file'
    let uploadedFile: File | null = null

    const contentType = request.headers.get('content-type')
    console.log('Content-Type:', contentType)
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData for file uploads
      const formData = await request.formData()
      const file = formData.get('file') as File
      const pathFromForm = formData.get('path') as string
      
      console.log('FormData 파싱 결과:', {
        fileName: file?.name,
        fileSize: file?.size,
        pathFromForm: pathFromForm,
        hasFile: !!file
      })
      
      if (file && pathFromForm !== undefined) {
        uploadedFile = file
        // pathFromForm이 빈 문자열이면 파일명만, 아니면 경로와 파일명을 결합
        filePath = pathFromForm === '' ? file.name : path.join(pathFromForm, file.name)
        type = 'file'
        console.log('최종 filePath:', filePath)
      } else {
        console.error('파일 또는 경로가 없음:', { hasFile: !!file, pathFromForm })
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
    
    const workspacePath = getWorkspacePath()
    const fullPath = path.join(workspacePath, filePath)
    
    console.log('경로 정보:', {
      workspacePath,
      filePath,
      fullPath,
      type
    })
    
    // Ensure the path is within workspace (security check)
    if (!fullPath.startsWith(workspacePath)) {
      console.error('보안 검사 실패:', { fullPath, workspacePath })
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
        
        if (uploadedFile) {
          // Handle file upload
          console.log('파일 업로드 시작:', {
            fileName: uploadedFile.name,
            fileSize: uploadedFile.size,
            fullPath
          })
          
          const buffer = Buffer.from(await uploadedFile.arrayBuffer())
          await fs.writeFile(fullPath, buffer)
          
          console.log('파일 저장 완료:', fullPath)
        } else if (content) {
          // Create file with text content
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