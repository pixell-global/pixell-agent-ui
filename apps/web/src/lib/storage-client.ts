/**
 * Supabase Storage client utilities for file uploads with signed URLs
 */

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
 * Client-side storage utilities
 */
export class ClientStorageManager {
  private supabase
  private bucket: string

  constructor() {
    // DISABLED: Supabase is legacy and no longer used
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseAnonKey) {
      this.supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
    } else {
      // Set to null to prevent errors
      this.supabase = null as any
      console.warn('[ClientStorageManager] Supabase is disabled. Storage operations will fail.')
    }
    this.bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'pixell-files'
  }

  /**
   * Generate a signed URL for file upload
   */
  async createSignedUploadUrl(
    filename: string,
    options: FileUploadOptions = {}
  ): Promise<SignedUploadResult> {
    const { folder = 'uploads', upsert = true } = options
    
    // Generate unique filename if not provided
    const finalFilename = options.filename || `${Date.now()}-${filename}`
    const path = folder ? `${folder}/${finalFilename}` : finalFilename

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(path, {
        upsert,
      })

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    return {
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    }
  }

  /**
   * Upload file using signed URL
   */
  async uploadFileWithSignedUrl(
    file: File,
    signedUrl: string,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    const { contentType = file.type, cacheControl = '3600' } = options

    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
        },
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      // Extract path from signed URL
      const urlParts = signedUrl.split('/')
      const pathIndex = urlParts.findIndex(part => part === 'object')
      const path = pathIndex !== -1 ? urlParts.slice(pathIndex + 1).join('/').split('?')[0] : ''

      const publicUrl = this.getPublicUrl(path)

      return {
        success: true,
        path,
        publicUrl,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }
    }
  }

  /**
   * Complete file upload flow (create signed URL + upload)
   */
  async uploadFile(
    file: File,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    try {
      // Create signed upload URL
      const { signedUrl, path } = await this.createSignedUploadUrl(file.name, options)

      // Upload file
      const result = await this.uploadFileWithSignedUrl(file, signedUrl, options)

      return {
        ...result,
        path,
        publicUrl: result.success ? this.getPublicUrl(path) : undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(path)

    return data.publicUrl
  }

  /**
   * Delete file
   */
  async deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .remove([path])

      if (error) {
        throw new Error(error.message)
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      }
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folder: string = ''): Promise<any[]> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .list(folder)

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<any> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .list('', { search: path })

    if (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`)
    }

    return data?.[0] || null
  }
}

/**
 * Server-side storage utilities
 */
export class ServerStorageManager {
  private bucket: string

  constructor() {
    this.bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'pixell-files'
  }

  private async getSupabaseClient() {
    const cookieStore = await cookies()
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
  }

  /**
   * Create signed URL for upload (server-side)
   */
  async createSignedUploadUrl(
    filename: string,
    options: FileUploadOptions = {}
  ): Promise<SignedUploadResult> {
    const supabase = await this.getSupabaseClient()
    const { folder = 'uploads', upsert = true } = options
    
    const finalFilename = options.filename || `${Date.now()}-${filename}`
    const path = folder ? `${folder}/${finalFilename}` : finalFilename

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(path, {
        upsert,
      })

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    return {
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    }
  }

  /**
   * Get public URL for a file (server-side)
   */
  async getPublicUrl(path: string): Promise<string> {
    const supabase = await this.getSupabaseClient()
    
    const { data } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(path)

    return data.publicUrl
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