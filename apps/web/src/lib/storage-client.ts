/**
 * Storage client utilities - Supabase has been removed
 * This file provides mock implementations for file uploads
 */

export interface FileUploadOptions {
  folder?: string
  filename?: string
  upsert?: boolean
  cacheControl?: string
  contentType?: string
}

export interface SignedUploadResult {
  signedUrl: string
  path: string
  token: string
}

export interface FileUploadResult {
  success: boolean
  path?: string
  publicUrl?: string
  content?: string
  error?: string
}

/**
 * Client-side storage utilities (mock implementation)
 */
export class ClientStorageManager {
  private bucket: string

  constructor() {
    this.bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'pixell-files'
    console.warn('[Storage] Supabase storage has been removed. Using mock client.')
  }

  /**
   * Generate a signed URL for file upload (mock)
   */
  async createSignedUploadUrl(
    filename: string,
    options: FileUploadOptions = {}
  ): Promise<SignedUploadResult> {
    const { folder = 'uploads' } = options
    const finalFilename = options.filename || `${Date.now()}-${filename}`
    const path = folder ? `${folder}/${finalFilename}` : finalFilename

    // Mock implementation - in a real scenario you'd use your own storage service
    return {
      signedUrl: `/api/mock-upload/${path}`,
      path,
      token: 'mock-token',
    }
  }

  /**
   * Upload file using signed URL (mock)
   */
  async uploadFileWithSignedUrl(
    file: File,
    signedUrl: string,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    console.warn('[Storage] Upload attempted but Supabase storage is removed')
    return {
      success: false,
      error: 'Storage has been removed. Please implement alternative storage.',
    }
  }

  /**
   * Complete file upload flow (mock)
   */
  async uploadFile(
    file: File,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    console.warn('[Storage] Upload attempted but Supabase storage is removed')
    return {
      success: false,
      error: 'Storage has been removed. Please implement alternative storage.',
    }
  }

  /**
   * Get public URL for a file (mock)
   */
  getPublicUrl(path: string): string {
    return `/storage/${this.bucket}/${path}`
  }

  /**
   * Delete file (mock)
   */
  async deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
    console.warn('[Storage] Delete attempted but Supabase storage is removed')
    return { success: false, error: 'Storage has been removed' }
  }

  /**
   * List files in a folder (mock)
   */
  async listFiles(folder: string = ''): Promise<unknown[]> {
    console.warn('[Storage] List files attempted but Supabase storage is removed')
    return []
  }

  /**
   * Get file metadata (mock)
   */
  async getFileMetadata(path: string): Promise<unknown> {
    console.warn('[Storage] Get metadata attempted but Supabase storage is removed')
    return null
  }
}

/**
 * Server-side storage utilities (mock implementation)
 */
export class ServerStorageManager {
  private bucket: string

  constructor() {
    this.bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'pixell-files'
  }

  /**
   * Create signed URL for upload (mock)
   */
  async createSignedUploadUrl(
    filename: string,
    options: FileUploadOptions = {}
  ): Promise<SignedUploadResult> {
    const { folder = 'uploads' } = options
    const finalFilename = options.filename || `${Date.now()}-${filename}`
    const path = folder ? `${folder}/${finalFilename}` : finalFilename

    return {
      signedUrl: `/api/mock-upload/${path}`,
      path,
      token: 'mock-token',
    }
  }

  /**
   * Get public URL for a file (mock)
   */
  async getPublicUrl(path: string): Promise<string> {
    return `/storage/${this.bucket}/${path}`
  }
}

/**
 * Convenience functions for common operations
 */

// Client-side instance
let clientStorageManager: ClientStorageManager | null = null

export const getClientStorageManager = (): ClientStorageManager => {
  if (!clientStorageManager) {
    clientStorageManager = new ClientStorageManager()
  }
  return clientStorageManager
}

// Server-side instance
let serverStorageManager: ServerStorageManager | null = null

export const getServerStorageManager = (): ServerStorageManager => {
  if (!serverStorageManager) {
    serverStorageManager = new ServerStorageManager()
  }
  return serverStorageManager
}

/**
 * Generate a safe filename
 */
export const generateSafeFilename = (originalName: string): string => {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop()
  const baseName = originalName.split('.').slice(0, -1).join('.')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50)

  return `${baseName}_${timestamp}_${randomSuffix}.${extension}`
}

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Check if file type is allowed
 */
export const isFileTypeAllowed = (
  file: File,
  allowedTypes: string[] = ['image/*', 'application/pdf', 'text/*']
): boolean => {
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1))
    }
    return file.type === type
  })
}

/**
 * Validate file size
 */
export const isFileSizeValid = (file: File, maxSizeInMB: number = 10): boolean => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  return file.size <= maxSizeInBytes
}
