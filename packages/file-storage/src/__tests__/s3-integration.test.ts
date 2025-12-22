/**
 * S3 Integration Tests
 *
 * These tests run against the actual S3 bucket to verify:
 * 1. User-scoped file operations work correctly
 * 2. Path isolation is enforced
 * 3. File CRUD operations function properly
 *
 * Prerequisites:
 * - Valid AWS credentials in environment
 * - STORAGE_S3_BUCKET set to 'pixell-agents'
 * - STORAGE_S3_REGION set to 'us-east-2'
 *
 * Run with: npm test -- --grep "S3 Integration"
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { StorageManager } from '../storage-manager'
import { randomUUID } from 'crypto'

// Skip if credentials not available
const hasS3Credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.STORAGE_S3_BUCKET

describe.skipIf(!hasS3Credentials)('S3 Integration Tests', () => {
  let storage: StorageManager

  // Test identifiers for cleanup
  const testPrefix = `test-${Date.now()}`
  const testOrgId = `test-org-${randomUUID()}`
  const testUserId = `test-user-${randomUUID()}`

  beforeAll(async () => {
    // Force S3 provider
    process.env.STORAGE_PROVIDER = 's3'

    // Create user-scoped storage
    storage = await StorageManager.createForUser(testUserId, testOrgId)
  })

  afterAll(async () => {
    // Cleanup test files
    try {
      const files = await storage.listFiles('/')
      for (const file of files) {
        if (file.name.startsWith(testPrefix) || file.path?.includes(testPrefix)) {
          await storage.deleteFile(file.path || file.name)
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  })

  describe('Storage Initialization', () => {
    it('should initialize with S3 provider', async () => {
      const info = storage.getProviderInfo()
      expect(info.primary).toBe('s3')
    })

    it('should be healthy', async () => {
      const healthy = await storage.isHealthy()
      expect(healthy).toBe(true)
    })

    it('should report correct status', async () => {
      const status = await storage.getStatus()
      expect(status.provider).toBe('s3')
      expect(status.configured).toBe(true)
      expect(status.healthy).toBe(true)
    })
  })

  describe('File Operations', () => {
    const testFileName = `${testPrefix}-test-file.txt`
    const testContent = 'Hello, S3 Storage!'

    it('should write a file', async () => {
      const result = await storage.writeFile(testFileName, testContent)

      expect(result).toBeDefined()
      expect(result.name).toBe(testFileName)
      expect(result.type).toBe('file')
    })

    it('should read the file back', async () => {
      const { content, metadata } = await storage.readFile(testFileName)

      expect(content).toBe(testContent)
      expect(metadata).toBeDefined()
    })

    it('should list files including the test file', async () => {
      const files = await storage.listFiles('/')

      const testFile = files.find((f) => f.name === testFileName)
      expect(testFile).toBeDefined()
    })

    it('should delete the file', async () => {
      await storage.deleteFile(testFileName)

      // Verify deletion
      const files = await storage.listFiles('/')
      const testFile = files.find((f) => f.name === testFileName)
      expect(testFile).toBeUndefined()
    })
  })

  describe('Folder Operations', () => {
    const testFolder = `${testPrefix}-folder`

    it('should create a folder', async () => {
      const result = await storage.createFolder(testFolder)

      expect(result).toBeDefined()
      expect(result.type).toBe('folder')
    })

    it('should write file to folder', async () => {
      const filePath = `${testFolder}/nested-file.txt`
      const result = await storage.writeFile(filePath, 'Nested content')

      expect(result).toBeDefined()
    })

    it('should list folder contents', async () => {
      const files = await storage.listFiles(testFolder)

      expect(files.length).toBeGreaterThan(0)
      const nestedFile = files.find((f) => f.name === 'nested-file.txt')
      expect(nestedFile).toBeDefined()
    })
  })

  describe('Deep Nested Structure', () => {
    const deepPath = `${testPrefix}/level1/level2/level3/level4`
    const deepFileName = 'deep-file.txt'

    it('should write file to deep nested path', async () => {
      const fullPath = `${deepPath}/${deepFileName}`
      const result = await storage.writeFile(fullPath, 'Deep nested content')

      expect(result).toBeDefined()
    })

    it('should read file from deep nested path', async () => {
      const fullPath = `${deepPath}/${deepFileName}`
      const { content } = await storage.readFile(fullPath)

      expect(content).toBe('Deep nested content')
    })
  })

  describe('Binary File Support', () => {
    const binaryFileName = `${testPrefix}-binary.bin`

    it('should write binary content', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd])
      const result = await storage.writeFile(binaryFileName, binaryContent)

      expect(result).toBeDefined()
    })

    it('should read binary content back', async () => {
      const { content } = await storage.readFile(binaryFileName)

      // Content may be base64 encoded or buffer
      expect(content).toBeDefined()
    })
  })

  describe('Search Functionality', () => {
    beforeAll(async () => {
      // Create some files to search
      await storage.writeFile(`${testPrefix}-search-a.txt`, 'Content A')
      await storage.writeFile(`${testPrefix}-search-b.txt`, 'Content B')
      await storage.writeFile(`${testPrefix}-search-c.md`, 'Content C')
    })

    it('should find files by name pattern', async () => {
      const results = await storage.searchFiles('search', '/')

      expect(results.length).toBeGreaterThanOrEqual(3)
    })

    it('should find specific file extension', async () => {
      const results = await storage.searchFiles('.md', '/')

      const mdFiles = results.filter((f) => f.name.endsWith('.md'))
      expect(mdFiles.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Storage Stats', () => {
    it('should return storage statistics', async () => {
      const stats = await storage.getStorageStats()

      expect(stats).toBeDefined()
      expect(typeof stats.totalSize).toBe('number')
      expect(typeof stats.fileCount).toBe('number')
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent file gracefully', async () => {
      await expect(storage.readFile('non-existent-file-12345.txt')).rejects.toThrow()
    })

    it('should handle invalid path characters', async () => {
      // Some characters may need special handling
      const result = await storage.writeFile(`${testPrefix}-special @#$%^.txt`, 'Special chars')

      // Should either succeed with encoding or reject cleanly
      expect(result).toBeDefined()
    })
  })
})

describe.skipIf(!hasS3Credentials)('S3 Multi-User Isolation Test', () => {
  const testOrgId = `isolation-org-${randomUUID()}`
  const user1Id = `user1-${randomUUID()}`
  const user2Id = `user2-${randomUUID()}`

  let storage1: StorageManager
  let storage2: StorageManager

  const testFileName = 'isolation-test.txt'
  const user1Content = 'This is User 1 content'
  const user2Content = 'This is User 2 content'

  beforeAll(async () => {
    process.env.STORAGE_PROVIDER = 's3'

    // Create separate storage instances for each user
    storage1 = await StorageManager.createForUser(user1Id, testOrgId)
    storage2 = await StorageManager.createForUser(user2Id, testOrgId)
  })

  afterAll(async () => {
    // Cleanup
    try {
      await storage1.deleteFile(testFileName)
    } catch (e) {
      // Ignore
    }
    try {
      await storage2.deleteFile(testFileName)
    } catch (e) {
      // Ignore
    }
  })

  it('should allow user 1 to write to their path', async () => {
    const result = await storage1.writeFile(testFileName, user1Content)
    expect(result).toBeDefined()
  })

  it('should allow user 2 to write to their path with same filename', async () => {
    const result = await storage2.writeFile(testFileName, user2Content)
    expect(result).toBeDefined()
  })

  it('user 1 should read only their own content', async () => {
    const { content } = await storage1.readFile(testFileName)
    expect(content).toBe(user1Content)
  })

  it('user 2 should read only their own content', async () => {
    const { content } = await storage2.readFile(testFileName)
    expect(content).toBe(user2Content)
  })

  it('files should be stored in different S3 paths', async () => {
    const info1 = storage1.getProviderInfo()
    const info2 = storage2.getProviderInfo()

    // Both should have different prefixes configured
    // The actual paths are: orgs/{orgId}/users/{userId1} vs orgs/{orgId}/users/{userId2}
    expect(info1.config?.config?.prefix).not.toBe(info2.config?.config?.prefix)
  })
})

describe.skipIf(!hasS3Credentials)('S3 Cross-Org Isolation Test', () => {
  const org1Id = `org1-${randomUUID()}`
  const org2Id = `org2-${randomUUID()}`
  const sharedUserId = `shared-user-${randomUUID()}`

  let storage1: StorageManager
  let storage2: StorageManager

  const testFileName = 'cross-org-test.txt'

  beforeAll(async () => {
    process.env.STORAGE_PROVIDER = 's3'

    // Same user in different orgs should have different storage
    storage1 = await StorageManager.createForUser(sharedUserId, org1Id)
    storage2 = await StorageManager.createForUser(sharedUserId, org2Id)
  })

  afterAll(async () => {
    try {
      await storage1.deleteFile(testFileName)
    } catch (e) {
      // Ignore
    }
    try {
      await storage2.deleteFile(testFileName)
    } catch (e) {
      // Ignore
    }
  })

  it('same user should have isolated storage per org', async () => {
    await storage1.writeFile(testFileName, 'Org 1 content')
    await storage2.writeFile(testFileName, 'Org 2 content')

    const { content: content1 } = await storage1.readFile(testFileName)
    const { content: content2 } = await storage2.readFile(testFileName)

    expect(content1).toBe('Org 1 content')
    expect(content2).toBe('Org 2 content')
    expect(content1).not.toBe(content2)
  })
})
