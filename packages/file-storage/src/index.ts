// Main exports
export { StorageManager, getStorageManager, resetStorageManager } from './storage-manager'
export type { StorageProvider, StorageConfig } from './storage-manager'

// Adapter types
export type {
  FileStorageAdapter,
  FileNode,
  FileMetadata,
  StorageStats,
  AdapterStatus,
} from './adapters/storage-adapter'

// Adapters (for direct use if needed)
export { LocalAdapter } from './adapters/local-adapter'
export { S3Adapter } from './adapters/s3-adapter'
