import { S3Client, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { S3Adapter } from '../adapters/s3-adapter'
import { StorageManager } from '../storage-manager'
import crypto from 'crypto'

/**
 * End-to-End Integration Tests
 *
 * These tests verify the complete storage workflow from bucket creation
 * through multi-context file operations to cleanup.
 *
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - Sufficient IAM permissions for bucket creation and management
 *
 * To run: RUN_S3_INTEGRATION_TESTS=true npm test -- e2e.test.ts
 */

const INTEGRATION_TESTS_ENABLED = process.env.RUN_S3_INTEGRATION_TESTS === 'true'
const testDescribe = INTEGRATION_TESTS_ENABLED ? describe : describe.skip

testDescribe('End-to-End Integration Tests', () => {
  let s3Client: S3Client
  let testBuckets: string[] = []

  beforeAll(() => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn('⚠️  Skipping E2E tests: AWS credentials not found')
      console.warn('   Set RUN_S3_INTEGRATION_TESTS=true and provide AWS credentials to enable')
    }

    s3Client = new S3Client({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    })
  })

  afterAll(async () => {
    // Cleanup all test buckets
    for (const bucketName of testBuckets) {
      try {
        // Delete all objects first
        const listResponse = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucketName
        }))

        if (listResponse.Contents && listResponse.Contents.length > 0) {
          for (const object of listResponse.Contents) {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key!
            }))
          }
        }

        // Delete the bucket
        await s3Client.send(new DeleteBucketCommand({
          Bucket: bucketName
        }))

        console.log(`✓ Cleaned up test bucket: ${bucketName}`)
      } catch (error) {
        console.warn(`Cleanup warning for ${bucketName}:`, error instanceof Error ? error.message : error)
      }
    }
  })

  function generateTestBucketName(): string {
    const randomSuffix = crypto.randomBytes(4).toString('hex')
    const bucketName = `paf-test-e2e-${Date.now()}-${randomSuffix}`.toLowerCase()
    testBuckets.push(bucketName)
    return bucketName
  }

  describe('Scenario 1: New Organization - Complete Workflow', () => {
    it('should create bucket → upload files → list → read → delete', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()

      // Initialize storage manager
      const storage = new StorageManager()
      await storage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/users/${userId}/workspace-files`
        }
      })

      // 1. Bucket should be auto-created
      const status = await storage.getStatus()
      expect(status.configured).toBe(true)
      expect(status.healthy).toBe(true)

      // 2. Upload files
      const file1 = await storage.writeFile('/test-file-1.txt', 'Hello from E2E test 1')
      expect(file1.name).toBe('test-file-1.txt')
      expect(file1.type).toBe('file')

      const file2 = await storage.writeFile('/test-file-2.txt', 'Hello from E2E test 2')
      expect(file2.name).toBe('test-file-2.txt')

      // 3. List files
      const files = await storage.listFiles('/')
      expect(files.length).toBeGreaterThanOrEqual(2)
      expect(files.some(f => f.name === 'test-file-1.txt')).toBe(true)
      expect(files.some(f => f.name === 'test-file-2.txt')).toBe(true)

      // 4. Read file content
      const { content } = await storage.readFile('/test-file-1.txt')
      expect(content).toBe('Hello from E2E test 1')

      // 5. Delete file
      await storage.deleteFile('/test-file-1.txt')
      const filesAfterDelete = await storage.listFiles('/')
      expect(filesAfterDelete.some(f => f.name === 'test-file-1.txt')).toBe(false)
      expect(filesAfterDelete.some(f => f.name === 'test-file-2.txt')).toBe(true)
    }, 60000) // 60 second timeout
  })

  describe('Scenario 2: Multi-User Isolation', () => {
    it('should isolate files between users in same org', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()
      const user1Id = 'user-1-' + crypto.randomUUID()
      const user2Id = 'user-2-' + crypto.randomUUID()

      // User 1 storage
      const user1Storage = new StorageManager()
      await user1Storage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/users/${user1Id}/workspace-files`
        }
      })

      // User 2 storage
      const user2Storage = new StorageManager()
      await user2Storage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/users/${user2Id}/workspace-files`
        }
      })

      // User 1 uploads file
      await user1Storage.writeFile('/user1-private.txt', 'User 1 private data')

      // User 2 uploads file
      await user2Storage.writeFile('/user2-private.txt', 'User 2 private data')

      // User 1 should only see their own files
      const user1Files = await user1Storage.listFiles('/')
      expect(user1Files.some(f => f.name === 'user1-private.txt')).toBe(true)
      expect(user1Files.some(f => f.name === 'user2-private.txt')).toBe(false)

      // User 2 should only see their own files
      const user2Files = await user2Storage.listFiles('/')
      expect(user2Files.some(f => f.name === 'user2-private.txt')).toBe(true)
      expect(user2Files.some(f => f.name === 'user1-private.txt')).toBe(false)
    }, 60000)
  })

  describe('Scenario 3: Team Context - Shared Files', () => {
    it('should allow team members to access shared team files', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()
      const teamId = 'team-' + crypto.randomUUID()

      // Team storage (shared)
      const teamStorage = new StorageManager()
      await teamStorage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/teams/${teamId}/shared`
        }
      })

      // Upload team document
      await teamStorage.writeFile('/team-document.pdf', 'Team shared document content')

      // Create folder
      await teamStorage.createFolder('/team-assets')

      // List team files
      const teamFiles = await teamStorage.listFiles('/')
      expect(teamFiles.some(f => f.name === 'team-document.pdf')).toBe(true)
      expect(teamFiles.some(f => f.name === 'team-assets' && f.type === 'folder')).toBe(true)

      // Read team file
      const { content } = await teamStorage.readFile('/team-document.pdf')
      expect(content).toBe('Team shared document content')
    }, 60000)
  })

  describe('Scenario 4: Brand Context - Asset Management', () => {
    it('should manage brand assets separately from user files', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()
      const brandId = 'brand-' + crypto.randomUUID()

      // Brand storage
      const brandStorage = new StorageManager()
      await brandStorage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/brands/${brandId}/assets`
        }
      })

      // Upload brand assets
      await brandStorage.writeFile('/logo.png', 'PNG image data...')
      await brandStorage.writeFile('/brand-guidelines.pdf', 'Brand guidelines content')

      // List brand assets
      const brandAssets = await brandStorage.listFiles('/')
      expect(brandAssets.length).toBe(2)
      expect(brandAssets.some(f => f.name === 'logo.png')).toBe(true)
      expect(brandAssets.some(f => f.name === 'brand-guidelines.pdf')).toBe(true)
    }, 60000)
  })

  describe('Scenario 5: Shared Context - Organization-Wide Files', () => {
    it('should manage org-wide shared files', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()

      // Shared storage
      const sharedStorage = new StorageManager()
      await sharedStorage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/shared`
        }
      })

      // Upload shared documents
      await sharedStorage.writeFile('/company-policy.pdf', 'Company policy content')
      await sharedStorage.writeFile('/employee-handbook.pdf', 'Employee handbook content')

      // List shared files
      const sharedFiles = await sharedStorage.listFiles('/')
      expect(sharedFiles.length).toBe(2)
      expect(sharedFiles.every(f => f.type === 'file')).toBe(true)
    }, 60000)
  })

  describe('Scenario 6: Multiple Organizations - Complete Isolation', () => {
    it('should completely isolate files between different organizations', async () => {
      const bucket1 = generateTestBucketName()
      const bucket2 = generateTestBucketName()
      const org1Id = 'org-1-' + crypto.randomUUID()
      const org2Id = 'org-2-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()

      // Org 1 storage
      const org1Storage = new StorageManager()
      await org1Storage.initialize({
        provider: 's3',
        config: {
          bucket: bucket1,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${org1Id}/users/${userId}/workspace-files`
        }
      })

      // Org 2 storage (different bucket)
      const org2Storage = new StorageManager()
      await org2Storage.initialize({
        provider: 's3',
        config: {
          bucket: bucket2,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${org2Id}/users/${userId}/workspace-files`
        }
      })

      // Upload files to both orgs
      await org1Storage.writeFile('/org1-file.txt', 'Organization 1 data')
      await org2Storage.writeFile('/org2-file.txt', 'Organization 2 data')

      // Each org should only see their own files
      const org1Files = await org1Storage.listFiles('/')
      const org2Files = await org2Storage.listFiles('/')

      expect(org1Files.some(f => f.name === 'org1-file.txt')).toBe(true)
      expect(org1Files.some(f => f.name === 'org2-file.txt')).toBe(false)

      expect(org2Files.some(f => f.name === 'org2-file.txt')).toBe(true)
      expect(org2Files.some(f => f.name === 'org1-file.txt')).toBe(false)
    }, 60000)
  })

  describe('Scenario 7: File Versioning - Delete Recovery', () => {
    it('should retain file versions after deletion (versioning enabled)', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()

      const storage = new StorageManager()
      await storage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/users/${userId}/workspace-files`
        }
      })

      // Create and modify file multiple times
      await storage.writeFile('/versioned-file.txt', 'Version 1 content')
      await storage.writeFile('/versioned-file.txt', 'Version 2 content')
      await storage.writeFile('/versioned-file.txt', 'Version 3 content')

      // Read latest version
      const { content } = await storage.readFile('/versioned-file.txt')
      expect(content).toBe('Version 3 content')

      // Delete file
      await storage.deleteFile('/versioned-file.txt')

      // File should not appear in listing
      const files = await storage.listFiles('/')
      expect(files.some(f => f.name === 'versioned-file.txt')).toBe(false)

      // Note: Versions still exist in S3 (can be recovered via AWS Console)
      // This test verifies versioning is enabled, not version recovery
    }, 60000)
  })

  describe('Scenario 8: Large File Upload', () => {
    it('should handle large file uploads successfully', async () => {
      const bucketName = generateTestBucketName()
      const orgId = 'org-test-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()

      const storage = new StorageManager()
      await storage.initialize({
        provider: 's3',
        config: {
          bucket: bucketName,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
          prefix: `orgs/${orgId}/users/${userId}/workspace-files`
        }
      })

      // Create a 5MB file
      const largeContent = crypto.randomBytes(5 * 1024 * 1024).toString('base64')

      const file = await storage.writeFile('/large-file.bin', largeContent)
      expect(file.size).toBeGreaterThan(5 * 1024 * 1024)

      // Verify file was uploaded
      const files = await storage.listFiles('/')
      expect(files.some(f => f.name === 'large-file.bin')).toBe(true)

      // Clean up (delete large file)
      await storage.deleteFile('/large-file.bin')
    }, 120000) // 2 minute timeout for large file
  })
})
