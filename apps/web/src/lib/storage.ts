import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'

export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  lastModified: string
  children?: FileNode[]
  metadata?: {
    size: number
    mimeType: string
    lastModified: string
    createdAt: string
    checksum?: string
  }
}

export interface FileMetadata {
  size: number
  mimeType: string
  lastModified: string
  createdAt: string
  checksum?: string
}

export class LocalAdapter {
  private rootPath: string = ''
  private initialized = false

  async initialize(config: { rootPath: string }): Promise<void> {
    this.rootPath = config.rootPath
    await fs.ensureDir(this.rootPath)
    this.initialized = true
  }

  async listFiles(relativePath: string = '/'): Promise<FileNode[]> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const fullPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
    if (!await fs.pathExists(fullPath)) {
      return []
    }

    const items = await fs.readdir(fullPath, { withFileTypes: true })
    const nodes: FileNode[] = []

    for (const item of items) {
      const itemPath = path.join(fullPath, item.name)
      const stats = await fs.stat(itemPath)
      const relativePath = '/' + path.relative(this.rootPath, itemPath).replace(/\\/g, '/')

      const node: FileNode = {
        id: this.generateId(itemPath),
        name: item.name,
        path: relativePath,
        type: item.isDirectory() ? 'folder' : 'file',
        lastModified: stats.mtime.toISOString(),
        metadata: {
          size: stats.size,
          mimeType: item.isFile() ? 'application/octet-stream' : 'folder',
          lastModified: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString()
        }
      }

      if (item.isFile()) {
        node.size = stats.size
      }

      nodes.push(node)
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  async readFile(relativePath: string): Promise<{ content: string; metadata: FileMetadata }> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const fullPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${relativePath}`)
    }

    const stats = await fs.stat(fullPath)
    const content = await fs.readFile(fullPath, 'utf-8')
    
    const metadata: FileMetadata = {
      size: stats.size,
      mimeType: 'text/plain',
      lastModified: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      checksum: createHash('md5').update(content).digest('hex')
    }

    return { content, metadata }
  }

  async writeFile(relativePath: string, content: string): Promise<FileNode> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const fullPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
    await fs.ensureDir(path.dirname(fullPath))
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
        mimeType: 'text/plain',
        lastModified: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      }
    }
  }

  async uploadFile(relativePath: string, file: File): Promise<FileNode> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const fullPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
    await fs.ensureDir(path.dirname(fullPath))
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(fullPath, buffer)
    
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
        mimeType: file.type || 'application/octet-stream',
        lastModified: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      }
    }
  }

  async createFolder(relativePath: string): Promise<FileNode> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const fullPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
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

  async deleteFile(relativePath: string): Promise<void> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const fullPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${relativePath}`)
    }

    await fs.remove(fullPath)
  }

  async searchFiles(query: string, relativePath: string = '/'): Promise<FileNode[]> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
    const results: FileNode[] = []
    const searchPath = path.join(this.rootPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath)
    
    const searchRecursive = async (dir: string) => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name)
          
          if (item.name.toLowerCase().includes(query.toLowerCase())) {
            const stats = await fs.stat(itemPath)
            const relPath = '/' + path.relative(this.rootPath, itemPath).replace(/\\/g, '/')
            
            results.push({
              id: this.generateId(itemPath),
              name: item.name,
              path: relPath,
              type: item.isDirectory() ? 'folder' : 'file',
              size: item.isFile() ? stats.size : undefined,
              lastModified: stats.mtime.toISOString(),
              metadata: {
                size: stats.size,
                mimeType: item.isFile() ? 'application/octet-stream' : 'folder',
                lastModified: stats.mtime.toISOString(),
                createdAt: stats.birthtime.toISOString()
              }
            })
          }
          
          if (item.isDirectory()) {
            await searchRecursive(itemPath)
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    }
    
    await searchRecursive(searchPath)
    return results.slice(0, 50)
  }

  async getStorageStats(): Promise<{ totalSize: number; fileCount: number; folderCount: number; lastUpdated: string }> {
    if (!this.initialized) throw new Error('Adapter not initialized')
    
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

  async getStatus(): Promise<{ provider: string; configured: boolean; healthy: boolean }> {
    return {
      provider: 'local',
      configured: this.initialized,
      healthy: this.initialized
    }
  }

  private generateId(fullPath: string): string {
    return createHash('md5').update(fullPath).digest('hex').slice(0, 8)
  }
}

export class StorageManager {
  private adapter?: LocalAdapter

  async initialize(config: { adapter: LocalAdapter; config: any }): Promise<void> {
    this.adapter = config.adapter
    await this.adapter.initialize(config.config)
  }

  async listFiles(path: string): Promise<FileNode[]> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.listFiles(path)
  }

  async readFile(path: string): Promise<{ content: string; metadata: FileMetadata }> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.readFile(path)
  }

  async writeFile(path: string, content: string): Promise<FileNode> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.writeFile(path, content)
  }

  async uploadFile(path: string, file: File): Promise<FileNode> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.uploadFile(path, file)
  }

  async createFolder(path: string): Promise<FileNode> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.createFolder(path)
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.deleteFile(path)
  }

  async searchFiles(query: string, path?: string): Promise<FileNode[]> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.searchFiles(query, path)
  }

  async getStorageStats(): Promise<{ totalSize: number; fileCount: number; folderCount: number; lastUpdated: string }> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.getStorageStats()
  }

  async getStatus(): Promise<{ provider: string; configured: boolean; healthy: boolean }> {
    if (!this.adapter) throw new Error('Storage not initialized')
    return this.adapter.getStatus()
  }
} 