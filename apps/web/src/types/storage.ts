// Storage types for Pixell Agent Framework

export interface FileMetadata {
  id: string
  name: string
  path: string
  size: number
  type: string
  lastModified: string
  url?: string
  thumbnailUrl?: string
}

export interface UploadResult {
  success: boolean
  file?: FileMetadata
  error?: string
}

export interface StorageAdapter {
  upload(file: File, path: string): Promise<UploadResult>
  delete(path: string): Promise<void>
  getUrl(path: string): Promise<string>
  list(path: string): Promise<FileMetadata[]>
  createFolder(path: string): Promise<void>
}

export interface StorageConfig {
  type: 'local' | 'supabase' | 's3' | 'database'
  maxFileSize: string
  allowedTypes: string[]
  local?: LocalStorageConfig
  supabase?: SupabaseStorageConfig
  s3?: S3StorageConfig
  database?: DatabaseStorageConfig
}

export interface LocalStorageConfig {
  uploadsDir: string
  baseUrl: string
}

export interface SupabaseStorageConfig {
  bucketName: string
  publicUrl: string
  serviceRoleKey: string
}

export interface S3StorageConfig {
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
}

export interface DatabaseStorageConfig {
  tableName: string
  connectionString: string
}

export interface UploadProgress {
  id: string
  fileName: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
} 