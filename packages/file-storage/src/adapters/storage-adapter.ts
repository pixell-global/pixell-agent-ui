/**
 * Storage Adapter Interface - Pluggable file storage system
 * 
 * This allows the Pixell Agent Framework to work with different storage
 * backends while providing a consistent API.
 */

export interface FileStorageAdapter {
  /**
   * Initialize the storage adapter
   */
  initialize(config: Record<string, any>): Promise<void>

  /**
   * List files and folders at a given path
   */
  listFiles(path: string): Promise<FileNode[]>

  /**
   * List files recursively, building a nested tree with all folder contents
   */
  listFilesRecursive(path: string): Promise<FileNode[]>

  /**
   * Read file content
   */
  readFile(path: string): Promise<{ content: string; metadata: FileMetadata }>

  /**
   * Write file content
   */
  writeFile(path: string, content: string | Buffer, metadata?: Partial<FileMetadata>): Promise<FileNode>

  /**
   * Delete file or folder
   */
  deleteFile(path: string): Promise<void>

  /**
   * Create folder
   */
  createFolder(path: string): Promise<FileNode>

  /**
   * Upload file with progress tracking
   */
  uploadFile(
    path: string, 
    file: File | Buffer, 
    onProgress?: (progress: number) => void
  ): Promise<FileNode>

  /**
   * Search files by name or content
   */
  searchFiles(query: string, path?: string): Promise<FileNode[]>

  /**
   * Get storage usage statistics
   */
  getStorageStats(): Promise<StorageStats>

  /**
   * Check if adapter is healthy and accessible
   */
  isHealthy(): Promise<boolean>

  /**
   * Get adapter configuration and status
   */
  getStatus(): Promise<AdapterStatus>
}

export interface FileMetadata {
  size: number
  mimeType: string
  lastModified: string
  createdAt: string
  checksum?: string
  tags?: Record<string, string>
}

export interface StorageStats {
  totalSize: number
  fileCount: number
  folderCount: number
  lastUpdated: string
}

export interface AdapterStatus {
  provider: string
  configured: boolean
  healthy: boolean
  lastCheck: string
  capabilities: string[]
  limits?: {
    maxFileSize: number
    maxTotalSize?: number
    allowedTypes?: string[]
  }
}

export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  lastModified: string
  children?: FileNode[]
  isExpanded?: boolean
  content?: string
  uploadProgress?: number
  metadata?: FileMetadata
} 