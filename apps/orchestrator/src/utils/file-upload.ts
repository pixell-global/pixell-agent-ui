/**
 * File Upload Utility
 *
 * Handles uploading agent-generated files to user's S3 storage.
 */

import { StorageManager } from '@pixell/file-storage'

export interface UploadAgentOutputParams {
  userId: string
  orgId: string
  localFilePath: string
  filename: string
  agentUrl: string
}

export interface UploadResult {
  success: boolean
  s3Path?: string
  error?: string
}

/**
 * Fetch file content from an agent's file download endpoint
 */
async function fetchFileFromAgent(agentUrl: string, filePath: string): Promise<Buffer> {
  // Normalize the agent URL (remove trailing slash if present)
  const baseUrl = agentUrl.replace(/\/$/, '')

  // Build the download URL
  const downloadUrl = `${baseUrl}/files/download?path=${encodeURIComponent(filePath)}`

  console.log(`📥 Fetching file from agent: ${downloadUrl}`)

  const response = await fetch(downloadUrl)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch file from agent: ${response.status} - ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Upload an agent-generated output file to the user's S3 storage
 *
 * @param params - Upload parameters
 * @returns Upload result with S3 path or error
 */
export async function uploadAgentOutputToS3(params: UploadAgentOutputParams): Promise<UploadResult> {
  const { userId, orgId, localFilePath, filename, agentUrl } = params

  try {
    // Validate required params
    if (!userId || !orgId) {
      return {
        success: false,
        error: 'Missing userId or orgId'
      }
    }

    if (!localFilePath || !filename) {
      return {
        success: false,
        error: 'Missing localFilePath or filename'
      }
    }

    console.log(`📤 Uploading agent output to S3:`, {
      userId,
      orgId,
      localFilePath,
      filename,
      agentUrl
    })

    // Fetch file content from agent
    const fileContent = await fetchFileFromAgent(agentUrl, localFilePath)

    console.log(`📦 Fetched file from agent: ${fileContent.length} bytes`)

    // Create user-scoped storage manager
    const storage = await StorageManager.createForUser(userId, orgId)

    // Ensure outputs folder exists (try to create, ignore if exists)
    try {
      await storage.createFolder('outputs')
    } catch (e) {
      // Folder might already exist, that's fine
    }

    // Upload to outputs/ folder
    const outputPath = `outputs/${filename}`
    await storage.writeFile(outputPath, fileContent)

    console.log(`✅ File uploaded to S3: ${outputPath}`)

    return {
      success: true,
      s3Path: outputPath
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed to upload agent output to S3:`, errorMessage)

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Get the appropriate file path from event data
 * Handles both absolute paths and relative paths
 */
export function extractFilePath(eventData: Record<string, any>): string | null {
  // Try different path fields
  const path = eventData.path || eventData.filepath || eventData.file_path

  if (!path) {
    return null
  }

  // If it's an absolute path, extract just the filename for the exports lookup
  if (typeof path === 'string') {
    // Extract the filename from the path
    const parts = path.split('/')
    return parts[parts.length - 1]
  }

  return null
}

/**
 * Get filename from event data
 */
export function extractFilename(eventData: Record<string, any>): string {
  // Try various field names
  const name = eventData.name || eventData.filename || eventData.file_name

  if (name) {
    return name
  }

  // Fall back to extracting from path
  const path = eventData.path || eventData.filepath || eventData.file_path
  if (path && typeof path === 'string') {
    const parts = path.split('/')
    return parts[parts.length - 1]
  }

  // Generate a default name
  const format = eventData.format || 'html'
  return `output_${Date.now()}.${format}`
}
