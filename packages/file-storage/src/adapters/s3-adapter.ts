import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  PutBucketEncryptionCommand,
  PutPublicAccessBlockCommand,
  PutBucketLifecycleConfigurationCommand
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash } from 'crypto'
import mime from 'mime-types'
import { FileStorageAdapter, FileNode, FileMetadata, StorageStats, AdapterStatus } from './storage-adapter'

// Utility function to safely extract error message
const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

/**
 * S3Adapter - S3-compatible storage for production deployments
 * 
 * Works with AWS S3, MinIO, DigitalOcean Spaces, and other S3-compatible services.
 * Provides scalable, production-ready file storage.
 */
export class S3Adapter implements FileStorageAdapter {
  private s3Client!: S3Client
  private bucket!:  string
  private prefix: string = ''
  private initialized = false
  private maxFileSize = 100 * 1024 * 1024 // 100MB default
  private allowedTypes: string[] = []
  private bucketResolver?: () => Promise<string>

  async initialize(config: Record<string, any>): Promise<void> {
    this.bucket = config.bucket
    this.prefix = config.prefix || 'workspace-files'
    this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024
    this.allowedTypes = config.allowedTypes || []
    this.bucketResolver = typeof config.bucketResolver === 'function' ? config.bucketResolver : undefined

    // Region default precedence: config -> env -> us-east-2 (framework default)
    const region = config.region || process.env.AWS_DEFAULT_REGION || 'us-east-2'

    this.s3Client = new S3Client({
      region,
      endpoint: config.endpoint, // For non-AWS S3 services
      credentials: config.credentials || {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || config.accessKeyId,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || config.secretAccessKey
      },
      forcePathStyle: config.forcePathStyle || false // For MinIO
    })

    // Test connection
    try {
      // Resolve bucket dynamically if needed
      if (!this.bucket && this.bucketResolver) {
        this.bucket = await this.bucketResolver()
      }
      if (!this.bucket) {
        throw new Error('S3 bucket name is required')
      }

      // Ensure bucket exists (create if missing) for per-org buckets
      await this.ensureBucketExists(this.bucket)

      // Verify bucket is accessible
      await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1
      }))
      this.initialized = true
      console.log(`☁️ S3 storage initialized: s3://${this.bucket}/${this.prefix}`)
    } catch (error) {
      throw new Error(`Failed to initialize S3 storage: ${getErrorMessage(error)}`)
    }
  }

  async listFiles(relativePath: string = '/'): Promise<FileNode[]> {
    this.ensureInitialized()
    
    const prefix = this.buildS3Key(relativePath)
    const delimiter = '/'
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: delimiter,
        MaxKeys: 1000
      })

      const response = await this.s3Client.send(command)
      const nodes: FileNode[] = []

      // Add folders (common prefixes)
      if (response.CommonPrefixes) {
        for (const commonPrefix of response.CommonPrefixes) {
          const folderPath = this.s3KeyToPath(commonPrefix.Prefix!)
          const folderName = folderPath.split('/').filter(Boolean).pop() || ''
          
          nodes.push({
            id: this.generateId(folderPath),
            name: folderName,
            path: folderPath,
            type: 'folder',
            lastModified: new Date().toISOString(),
            metadata: {
              size: 0,
              mimeType: 'folder',
              lastModified: new Date().toISOString(),
              createdAt: new Date().toISOString()
            }
          })
        }
      }

      // Add files
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key === prefix) continue // Skip the folder itself
          
          const filePath = this.s3KeyToPath(object.Key!)
          const fileName = filePath.split('/').filter(Boolean).pop() || ''
          
          // Skip nested files (only direct children)
          const pathDepth = filePath.replace(relativePath, '').split('/').filter(Boolean).length
          if (pathDepth > 1) continue

          nodes.push({
            id: this.generateId(filePath),
            name: fileName,
            path: filePath,
            type: 'file',
            size: object.Size,
            lastModified: object.LastModified?.toISOString() || new Date().toISOString(),
            metadata: {
              size: object.Size || 0,
              mimeType: mime.lookup(fileName) || 'application/octet-stream',
              lastModified: object.LastModified?.toISOString() || new Date().toISOString(),
              createdAt: object.LastModified?.toISOString() || new Date().toISOString(),
              checksum: object.ETag?.replace(/"/g, '') || ''
            }
          })
        }
      }

      // Sort: folders first, then files
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

    } catch (error) {
      console.error('S3 listFiles error:', error)
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async readFile(relativePath: string): Promise<{ content: string; metadata: FileMetadata }> {
    this.ensureInitialized()
    
    const key = this.buildS3Key(relativePath)
    
    try {
      // Get object metadata first
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
      const headResponse = await this.s3Client.send(headCommand)

      // Check file size limit
      if (headResponse.ContentLength && headResponse.ContentLength > this.maxFileSize) {
        throw new Error(`File too large to read: ${relativePath} (${headResponse.ContentLength} bytes)`)
      }

      // Get object content
      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
      const response = await this.s3Client.send(getCommand)

      if (!response.Body) {
        throw new Error(`No content found for file: ${relativePath}`)
      }

      const content = await response.Body.transformToString()

      const metadata: FileMetadata = {
        size: headResponse.ContentLength || 0,
        mimeType: headResponse.ContentType || 'application/octet-stream',
        lastModified: headResponse.LastModified?.toISOString() || new Date().toISOString(),
        createdAt: headResponse.LastModified?.toISOString() || new Date().toISOString(),
        checksum: headResponse.ETag?.replace(/"/g, '') || ''
      }

      return { content, metadata }

    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        throw new Error(`File not found: ${relativePath}`)
      }
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async writeFile(
    relativePath: string, 
    content: string | Buffer, 
    metadata?: Partial<FileMetadata>
  ): Promise<FileNode> {
    this.ensureInitialized()
    
    const key = this.buildS3Key(relativePath)
    
    // Validate file type
    const fileName = relativePath.split('/').pop() || ''
    const extension = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : ''
    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(extension)) {
      throw new Error(`File type not allowed: ${extension}`)
    }

    // Validate file size
    const contentLength = typeof content === 'string' ? Buffer.byteLength(content, 'utf-8') : content.length
    if (contentLength > this.maxFileSize) {
      throw new Error(`File too large: ${contentLength} bytes (max ${this.maxFileSize})`)
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: metadata?.mimeType || mime.lookup(fileName) || 'application/octet-stream',
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      })

      const response = await this.s3Client.send(command)

      return {
        id: this.generateId(relativePath),
        name: fileName,
        path: relativePath,
        type: 'file',
        size: contentLength,
        lastModified: new Date().toISOString(),
        metadata: {
          size: contentLength,
          mimeType: metadata?.mimeType || mime.lookup(fileName) || 'application/octet-stream',
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          checksum: response.ETag?.replace(/"/g, '') || '',
          ...metadata
        }
      }

    } catch (error) {
      throw new Error(`Failed to write file: ${getErrorMessage(error)}`)
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    this.ensureInitialized()
    
    const key = this.buildS3Key(relativePath)
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      await this.s3Client.send(command)

    } catch (error) {
      throw new Error(`Failed to delete file: ${getErrorMessage(error)}`)
    }
  }

  async createFolder(relativePath: string): Promise<FileNode> {
    this.ensureInitialized()
    
    // S3 doesn't have real folders, so we create a marker object
    const key = this.buildS3Key(relativePath) + '/'
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: '',
        ContentType: 'application/x-directory'
      })

      await this.s3Client.send(command)

      return {
        id: this.generateId(relativePath),
        name: relativePath.split('/').filter(Boolean).pop() || '',
        path: relativePath,
        type: 'folder',
        lastModified: new Date().toISOString(),
        metadata: {
          size: 0,
          mimeType: 'folder',
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      }

    } catch (error) {
      throw new Error(`Failed to create folder: ${getErrorMessage(error)}`)
    }
  }

  async uploadFile(
    relativePath: string, 
    file: File | Buffer, 
    onProgress?: (progress: number) => void
  ): Promise<FileNode> {
    this.ensureInitialized()
    
    const key = this.buildS3Key(relativePath)
    const fileName = relativePath.split('/').pop() || ''
    
    // Validate file size
    const fileSize = file instanceof File ? file.size : file.length
    if (fileSize > this.maxFileSize) {
      throw new Error(`File too large: ${fileSize} bytes (max ${this.maxFileSize})`)
    }

    // Validate file type
    const extension = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : ''
    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(extension)) {
      throw new Error(`File type not allowed: ${extension}`)
    }

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file,
          ContentType: mime.lookup(fileName) || 'application/octet-stream',
          Metadata: {
            originalName: fileName,
            uploadedAt: new Date().toISOString()
          }
        }
      })

      // Track upload progress
      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          if (progress.loaded && progress.total) {
            const percent = (progress.loaded / progress.total) * 100
            onProgress(percent)
          }
        })
      }

      const response = await upload.done()

      return {
        id: this.generateId(relativePath),
        name: fileName,
        path: relativePath,
        type: 'file',
        size: fileSize,
        lastModified: new Date().toISOString(),
        metadata: {
          size: fileSize,
          mimeType: mime.lookup(fileName) || 'application/octet-stream',
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          checksum: response.ETag?.replace(/"/g, '') || ''
        }
      }

    } catch (error) {
      throw new Error(`Failed to upload file: ${getErrorMessage(error)}`)
    }
  }

  async searchFiles(query: string, relativePath: string = '/'): Promise<FileNode[]> {
    this.ensureInitialized()
    
    const prefix = this.buildS3Key(relativePath)
    const results: FileNode[] = []
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1000
      })

      const response = await this.s3Client.send(command)

      if (response.Contents) {
        for (const object of response.Contents) {
          const filePath = this.s3KeyToPath(object.Key!)
          const fileName = filePath.split('/').filter(Boolean).pop() || ''
          
          // Check if name matches query
          if (fileName.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              id: this.generateId(filePath),
              name: fileName,
              path: filePath,
              type: 'file',
              size: object.Size,
              lastModified: object.LastModified?.toISOString() || new Date().toISOString(),
              metadata: {
                size: object.Size || 0,
                mimeType: mime.lookup(fileName) || 'application/octet-stream',
                lastModified: object.LastModified?.toISOString() || new Date().toISOString(),
                createdAt: object.LastModified?.toISOString() || new Date().toISOString(),
                checksum: object.ETag?.replace(/"/g, '') || ''
              }
            })
          }
        }
      }

      return results.slice(0, 50) // Limit results

    } catch (error) {
      throw new Error(`Failed to search files: ${getErrorMessage(error)}`)
    }
  }

  async getStorageStats(): Promise<StorageStats> {
    this.ensureInitialized()
    
    let totalSize = 0
    let fileCount = 0
    let folderCount = 0
    
    try {
      let continuationToken: string | undefined
      
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken
        })

        const response = await this.s3Client.send(command)

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key?.endsWith('/')) {
              folderCount++
            } else {
              fileCount++
              totalSize += object.Size || 0
            }
          }
        }

        continuationToken = response.NextContinuationToken
      } while (continuationToken)

      return {
        totalSize,
        fileCount,
        folderCount,
        lastUpdated: new Date().toISOString()
      }

    } catch (error) {
      throw new Error(`Failed to get storage stats: ${getErrorMessage(error)}`)
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) return false
    
    try {
      // Test bucket access
      await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1
      }))
      return true
    } catch {
      return false
    }
  }

  async getStatus(): Promise<AdapterStatus> {
    return {
      provider: 's3',
      configured: this.initialized,
      healthy: await this.isHealthy(),
      lastCheck: new Date().toISOString(),
      capabilities: ['read', 'write', 'delete', 'upload', 'search', 'presigned-urls'],
      limits: {
        maxFileSize: this.maxFileSize,
        allowedTypes: this.allowedTypes
      }
    }
  }

  // S3-specific methods
  async getPresignedUrl(relativePath: string, expiresIn: number = 3600): Promise<string> {
    this.ensureInitialized()
    
    const key = this.buildS3Key(relativePath)
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    })

    return await getSignedUrl(this.s3Client, command, { expiresIn })
  }

  // Private helper methods
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('S3Adapter not initialized. Call initialize() first.')
    }
  }

  /**
   * Ensure S3 bucket exists, creating it with security settings if needed
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      // Check if bucket exists
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }))
      console.log(`✓ S3 bucket exists: ${bucketName}`)
    } catch (error: any) {
      if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
        // Bucket doesn't exist, create it
        console.log(`Creating S3 bucket: ${bucketName}`)
        await this.createBucket(bucketName)
      } else {
        // Some other error (access denied, network issue, etc.)
        throw error
      }
    }
  }

  /**
   * Create a new S3 bucket with security best practices:
   * - Versioning enabled
   * - Encryption enabled (AES-256)
   * - Public access blocked
   * - Lifecycle policies configured
   */
  private async createBucket(bucketName: string): Promise<void> {
    try {
      // 1. Create the bucket
      await this.s3Client.send(new CreateBucketCommand({
        Bucket: bucketName
      }))
      console.log(`✓ Created S3 bucket: ${bucketName}`)

      // 2. Enable versioning
      await this.s3Client.send(new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }))
      console.log(`✓ Enabled versioning for: ${bucketName}`)

      // 3. Enable server-side encryption (AES-256)
      await this.s3Client.send(new PutBucketEncryptionCommand({
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
              },
              BucketKeyEnabled: true
            }
          ]
        }
      }))
      console.log(`✓ Enabled encryption for: ${bucketName}`)

      // 4. Block all public access
      await this.s3Client.send(new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      }))
      console.log(`✓ Blocked public access for: ${bucketName}`)

      // 5. Set lifecycle policy (archive to Glacier after 30 days, delete after 90 days)
      try {
        await this.s3Client.send(new PutBucketLifecycleConfigurationCommand({
          Bucket: bucketName,
          LifecycleConfiguration: {
            Rules: [
              {
                Id: 'archive-old-files',
                Status: 'Enabled',
                Transitions: [
                  {
                    Days: 30,
                    StorageClass: 'GLACIER'
                  }
                ],
                Expiration: {
                  Days: 90
                },
                Filter: {
                  Prefix: ''
                }
              }
            ]
          }
        }))
        console.log(`✓ Set lifecycle policy for: ${bucketName}`)
      } catch (lifecycleError) {
        // Lifecycle policies are optional - warn but don't fail
        console.warn(`⚠️  Could not set lifecycle policy for ${bucketName}:`, getErrorMessage(lifecycleError))
      }

      console.log(`✅ Successfully configured S3 bucket: ${bucketName}`)

    } catch (error: any) {
      // Handle specific bucket creation errors
      if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
        // Bucket was created by another process/thread in the meantime - that's ok
        console.log(`✓ Bucket already exists: ${bucketName}`)
        return
      }

      if (error.name === 'AccessDenied' || error.message?.includes('Access Denied')) {
        throw new Error(
          `AWS IAM permissions insufficient. Need s3:CreateBucket permission for ${bucketName}. ` +
          `Please update your IAM policy to allow bucket creation.`
        )
      }

      if (error.name === 'InvalidBucketName') {
        throw new Error(`Generated bucket name is invalid: ${bucketName}. Must be DNS-compliant and <63 characters.`)
      }

      // Re-throw other errors with context
      throw new Error(`Failed to create S3 bucket ${bucketName}: ${getErrorMessage(error)}`)
    }
  }

  private buildS3Key(relativePath: string): string {
    const normalized = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
    return this.prefix ? `${this.prefix}/${normalized}` : normalized
  }

  private s3KeyToPath(key: string): string {
    if (this.prefix && key.startsWith(this.prefix)) {
      key = key.slice(this.prefix.length + 1)
    }
    return '/' + key
  }

  private generateId(path: string): string {
    return createHash('md5').update(path).digest('hex').slice(0, 8)
  }
} 