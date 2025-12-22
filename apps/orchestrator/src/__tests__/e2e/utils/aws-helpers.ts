/**
 * AWS Helpers for E2E Tests
 *
 * Provides utilities for S3 operations using AWS CLI.
 * Used to verify file uploads from agent → orchestrator → S3.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const S3_BUCKET = process.env.STORAGE_S3_BUCKET || 'pixell-agents'
const S3_REGION = process.env.STORAGE_S3_REGION || 'us-east-2'

/**
 * Create environment for AWS CLI that uses ~/.aws/credentials
 * by removing any AWS_ACCESS_KEY_ID/SECRET that might be set from .env files
 */
function getCleanAwsEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.AWS_ACCESS_KEY_ID
  delete env.AWS_SECRET_ACCESS_KEY
  delete env.AWS_SESSION_TOKEN
  delete env.STORAGE_S3_ACCESS_KEY_ID
  delete env.STORAGE_S3_SECRET_ACCESS_KEY
  return env
}

/**
 * Build the S3 path for a user's outputs folder
 */
export function buildS3OutputsPath(userId: string, orgId: string): string {
  return `s3://${S3_BUCKET}/orgs/${orgId}/users/${userId}/outputs/`
}

/**
 * List files in a user's S3 outputs folder
 */
export async function s3ListFiles(
  userId: string,
  orgId: string
): Promise<string[]> {
  const path = buildS3OutputsPath(userId, orgId)

  try {
    const cmd = `aws s3 ls ${path} --region ${S3_REGION}`
    if (process.env.DEBUG_E2E) {
      console.log(`[s3ListFiles] Running: ${cmd}`)
    }

    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000, env: getCleanAwsEnv() })

    if (process.env.DEBUG_E2E && stderr) {
      console.log(`[s3ListFiles] stderr: ${stderr}`)
    }

    // Parse ls output: "2024-01-01 12:00:00      1234 filename.html"
    const files = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/)
        return parts[parts.length - 1] // Last part is the filename
      })
      .filter(Boolean)

    if (process.env.DEBUG_E2E) {
      console.log(`[s3ListFiles] Found ${files.length} files:`, files)
    }

    return files
  } catch (error: any) {
    if (process.env.DEBUG_E2E) {
      console.log(`[s3ListFiles] AWS CLI error:`, {
        message: error.message,
        stderr: error.stderr,
        code: error.code,
      })
    }
    // If path doesn't exist, return empty array
    if (error.stderr?.includes('does not exist') || error.code === 1) {
      return []
    }
    throw error
  }
}

/**
 * Get file content from S3
 */
export async function s3GetFileContent(
  userId: string,
  orgId: string,
  filename: string
): Promise<string> {
  const path = `s3://${S3_BUCKET}/orgs/${orgId}/users/${userId}/outputs/${filename}`

  const { stdout } = await execAsync(
    `aws s3 cp ${path} - --region ${S3_REGION}`,
    { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: getCleanAwsEnv() } // 10MB buffer
  )

  return stdout
}

/**
 * Check if a file exists in S3
 */
export async function s3FileExists(
  userId: string,
  orgId: string,
  filename: string
): Promise<boolean> {
  const path = `s3://${S3_BUCKET}/orgs/${orgId}/users/${userId}/outputs/${filename}`

  try {
    await execAsync(`aws s3 ls ${path} --region ${S3_REGION}`, {
      timeout: 30000,
      env: getCleanAwsEnv(),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Delete all files in a user's outputs folder
 */
export async function s3DeleteOutputs(
  userId: string,
  orgId: string
): Promise<void> {
  const path = buildS3OutputsPath(userId, orgId)

  try {
    await execAsync(`aws s3 rm ${path} --recursive --region ${S3_REGION}`, {
      timeout: 60000,
      env: getCleanAwsEnv(),
    })
  } catch (error: any) {
    // Ignore if path doesn't exist
    if (!error.stderr?.includes('does not exist')) {
      console.warn(`Warning: Failed to clean S3 path ${path}:`, error.message)
    }
  }
}

/**
 * Wait for a file to appear in S3 (with retries)
 */
export async function s3WaitForFile(
  userId: string,
  orgId: string,
  filenamePattern: RegExp,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 2000
): Promise<string | null> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const files = await s3ListFiles(userId, orgId)
    const match = files.find((f) => filenamePattern.test(f))

    if (match) {
      return match
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  return null
}

/**
 * Get S3 file metadata (size, last modified)
 */
export async function s3GetFileMetadata(
  userId: string,
  orgId: string,
  filename: string
): Promise<{ size: number; lastModified: string } | null> {
  const path = `s3://${S3_BUCKET}/orgs/${orgId}/users/${userId}/outputs/${filename}`

  try {
    const { stdout } = await execAsync(
      `aws s3api head-object --bucket ${S3_BUCKET} --key orgs/${orgId}/users/${userId}/outputs/${filename} --region ${S3_REGION}`,
      { timeout: 30000, env: getCleanAwsEnv() }
    )

    const metadata = JSON.parse(stdout)
    return {
      size: metadata.ContentLength,
      lastModified: metadata.LastModified,
    }
  } catch {
    return null
  }
}

/**
 * Verify AWS CLI is configured and accessible
 */
export async function verifyAwsAccess(): Promise<boolean> {
  try {
    // Just list the bucket root (limited output)
    await execAsync(`aws s3 ls s3://${S3_BUCKET}/ --region ${S3_REGION} 2>&1 | head -1`, {
      timeout: 10000,
      shell: '/bin/bash',
      env: getCleanAwsEnv(),
    })
    return true
  } catch (error: any) {
    console.error('AWS access verification failed:', error.message)
    return false
  }
}
