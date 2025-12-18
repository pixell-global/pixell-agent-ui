import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import mime from 'mime-types'
import { FileStorageAdapter, FileNode, FileMetadata, StorageStats, AdapterStatus } from './storage-adapter'

/**
 * LocalAdapter - Local filesystem storage (default for zero setup)
 * 
 * Provides immediate functionality without external dependencies.
 * Perfect for development and simple deployments.
 */
export class LocalAdapter implements FileStorageAdapter {
  private rootPath!: string
  private initialized = false
  private allowedTypes: string[] = []
  private maxFileSize: number = 50 * 1024 * 1024 // 50MB default

  async initialize(config: Record<string, any>): Promise<void> {
    this.rootPath = config.rootPath || path.join(process.cwd(), 'workspace-files')
    this.allowedTypes = config.allowedTypes || [
      '.txt', '.md', '.json', '.js', '.ts', '.py', '.yml', '.yaml', 
      '.csv', '.xml', '.html', '.css', '.png', '.jpg', '.jpeg', '.pdf'
    ]
    this.maxFileSize = config.maxFileSize || 50 * 1024 * 1024

    // Ensure workspace directory exists
    await fs.ensureDir(this.rootPath)
    
    // Create default folders
    await fs.ensureDir(path.join(this.rootPath, 'uploads'))
    await fs.ensureDir(path.join(this.rootPath, 'documents'))
    await fs.ensureDir(path.join(this.rootPath, 'images'))

    this.initialized = true
    console.log(`📁 Local storage initialized at: ${this.rootPath}`)
  }

  async listFiles(relativePath: string = '/'): Promise<FileNode[]> {
    this.ensureInitialized()
    
    const fullPath = this.resolvePath(relativePath)
    
    if (!await fs.pathExists(fullPath)) {
      return []
    }

    const items = await fs.readdir(fullPath, { withFileTypes: true })
    const nodes: FileNode[] = []

    for (const item of items) {
      const itemPath = path.join(fullPath, item.name)
      const stats = await fs.stat(itemPath)
      const relativePath = this.getRelativePath(itemPath)

      const node: FileNode = {
        id: this.generateId(itemPath),
        name: item.name,
        path: relativePath,
        type: item.isDirectory() ? 'folder' : 'file',
        lastModified: stats.mtime.toISOString(),
        metadata: {
          size: stats.size,
          mimeType: item.isFile() ? mime.lookup(item.name) || 'application/octet-stream' : 'folder',
          lastModified: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString()
        }
      }

      if (item.isFile()) {
        node.size = stats.size
      }

      if (item.isDirectory()) {
        // Check if folder has children (for expansion indicator)
        try {
          const children = await fs.readdir(itemPath)
          node.children = children.length > 0 ? [] : undefined
        } catch {
          // Permission error or folder access issue
        }
      }

      nodes.push(node)
    }

    // Sort: folders first, then files, both alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  async listFilesRecursive(relativePath: string = '/'): Promise<FileNode[]> {
    const nodes = await this.listFiles(relativePath)

    for (const node of nodes) {
      if (node.type === 'folder') {
        node.children = await this.listFilesRecursive(node.path)
        node.isExpanded = true
      }
    }

    return nodes
  }

  async readFile(relativePath: string): Promise<{ content: string; metadata: FileMetadata }> {
    this.ensureInitialized()
    
    const fullPath = this.resolvePath(relativePath)
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${relativePath}`)
    }

    const stats = await fs.stat(fullPath)
    
    if (stats.isDirectory()) {
      throw new Error(`Cannot read directory as file: ${relativePath}`)
    }

    // Check file size limit for reading
    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large to read: ${relativePath} (${stats.size} bytes)`)
    }

    const content = await fs.readFile(fullPath, 'utf-8')
    const checksum = createHash('md5').update(content).digest('hex')

    const metadata: FileMetadata = {
      size: stats.size,
      mimeType: mime.lookup(fullPath) || 'application/octet-stream',
      lastModified: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      checksum
    }

    return { content, metadata }
  }

  async writeFile(
    relativePath: string, 
    content: string | Buffer, 
    metadata?: Partial<FileMetadata>
  ): Promise<FileNode> {
    this.ensureInitialized()
    
    const fullPath = this.resolvePath(relativePath)
    
    // Validate file type
    const extension = path.extname(relativePath).toLowerCase()
    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(extension)) {
      throw new Error(`File type not allowed: ${extension}`)
    }

    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(fullPath))
    
    // Write file
    await fs.writeFile(fullPath, content)
    
    const stats = await fs.stat(fullPath)
    
    return {
      id: this.generateId(fullPath),
      name: path.basename(relativePath),
      path: relativePath,
      type: 'file',
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      metadata: {
        size: stats.size,
        mimeType: mime.lookup(fullPath) || 'application/octet-stream',
        lastModified: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString(),
        ...metadata
      }
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    this.ensureInitialized()
    
    const fullPath = this.resolvePath(relativePath)
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${relativePath}`)
    }

    await fs.remove(fullPath)
  }

  async createFolder(relativePath: string): Promise<FileNode> {
    this.ensureInitialized()
    
    const fullPath = this.resolvePath(relativePath)
    
    await fs.ensureDir(fullPath)
    const stats = await fs.stat(fullPath)
    
    return {
      id: this.generateId(fullPath),
      name: path.basename(relativePath),
      path: relativePath,
      type: 'folder',
      lastModified: stats.mtime.toISOString(),
      metadata: {
        size: 0,
        mimeType: 'folder',
        lastModified: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      }
    }
  }

  async uploadFile(
    relativePath: string, 
    file: File | Buffer, 
    onProgress?: (progress: number) => void
  ): Promise<FileNode> {
    this.ensureInitialized()
    
    const fullPath = this.resolvePath(relativePath)
    
    // Validate file size
    const fileSize = file instanceof File ? file.size : file.length
    if (fileSize > this.maxFileSize) {
      throw new Error(`File too large: ${fileSize} bytes (max ${this.maxFileSize})`)
    }

    // Validate file type
    const extension = path.extname(relativePath).toLowerCase()
    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(extension)) {
      throw new Error(`File type not allowed: ${extension}`)
    }

    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(fullPath))
    
    // Simulate upload progress for consistency with other adapters
    if (onProgress) {
      onProgress(0)
      setTimeout(() => onProgress(50), 100)
      setTimeout(() => onProgress(100), 200)
    }

    if (file instanceof File) {
      // Convert File to Buffer for Node.js
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(fullPath, buffer)
    } else {
      await fs.writeFile(fullPath, file)
    }
    
    const stats = await fs.stat(fullPath)
    
    return {
      id: this.generateId(fullPath),
      name: path.basename(relativePath),
      path: relativePath,
      type: 'file',
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      metadata: {
        size: stats.size,
        mimeType: mime.lookup(fullPath) || 'application/octet-stream',
        lastModified: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      }
    }
  }

  async searchFiles(query: string, relativePath: string = '/'): Promise<FileNode[]> {
    this.ensureInitialized()
    
    const results: FileNode[] = []
    const searchPath = this.resolvePath(relativePath)
    
    const searchRecursive = async (dir: string) => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name)
          
          // Check if name matches query
          if (item.name.toLowerCase().includes(query.toLowerCase())) {
            const stats = await fs.stat(itemPath)
            const relPath = this.getRelativePath(itemPath)
            
            results.push({
              id: this.generateId(itemPath),
              name: item.name,
              path: relPath,
              type: item.isDirectory() ? 'folder' : 'file',
              size: item.isFile() ? stats.size : undefined,
              lastModified: stats.mtime.toISOString(),
              metadata: {
                size: stats.size,
                mimeType: item.isFile() ? mime.lookup(item.name) || 'application/octet-stream' : 'folder',
                lastModified: stats.mtime.toISOString(),
                createdAt: stats.birthtime.toISOString()
              }
            })
          }
          
          // Recurse into directories
          if (item.isDirectory()) {
            await searchRecursive(itemPath)
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
    
    await searchRecursive(searchPath)
    
    return results.slice(0, 50) // Limit results
  }

  async getStorageStats(): Promise<StorageStats> {
    this.ensureInitialized()
    
    let totalSize = 0
    let fileCount = 0
    let folderCount = 0
    
    const calculateRecursive = async (dir: string) => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name)
          
          if (item.isDirectory()) {
            folderCount++
            await calculateRecursive(itemPath)
          } else {
            fileCount++
            const stats = await fs.stat(itemPath)
            totalSize += stats.size
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
    
    await calculateRecursive(this.rootPath)
    
    return {
      totalSize,
      fileCount,
      folderCount,
      lastUpdated: new Date().toISOString()
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) return false
    
    try {
      // Test read/write access
      const testPath = path.join(this.rootPath, '.health-check')
      await fs.writeFile(testPath, 'test')
      await fs.remove(testPath)
      return true
    } catch {
      return false
    }
  }

  async getStatus(): Promise<AdapterStatus> {
    return {
      provider: 'local',
      configured: this.initialized,
      healthy: await this.isHealthy(),
      lastCheck: new Date().toISOString(),
      capabilities: ['read', 'write', 'delete', 'upload', 'search'],
      limits: {
        maxFileSize: this.maxFileSize,
        allowedTypes: this.allowedTypes
      }
    }
  }

  // Private helper methods
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LocalAdapter not initialized. Call initialize() first.')
    }
  }

  private resolvePath(relativePath: string): string {
    // Normalize and resolve path relative to root
    const normalized = path.normalize(relativePath)
    const resolved = path.resolve(this.rootPath, normalized.startsWith('/') ? normalized.slice(1) : normalized)
    
    // Security check: ensure path is within root directory
    if (!resolved.startsWith(this.rootPath)) {
      throw new Error(`Path outside workspace: ${relativePath}`)
    }
    
    return resolved
  }

  private getRelativePath(fullPath: string): string {
    return '/' + path.relative(this.rootPath, fullPath).replace(/\\/g, '/')
  }

  private generateId(fullPath: string): string {
    return createHash('md5').update(fullPath).digest('hex').slice(0, 8)
  }
} 