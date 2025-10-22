import { S3Client, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command, GetBucketVersioningCommand, GetBucketEncryptionCommand, GetPublicAccessBlockCommand } from '@aws-sdk/client-s3'
import { S3Adapter } from '../s3-adapter'
import crypto from 'crypto'

/**
 * Integration tests for S3Adapter
 * These tests require real AWS credentials and will create/delete actual S3 buckets
 *
 * To run: AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy npm test -- s3-adapter.integration.test.ts
 *
 * Skip these tests in CI if AWS credentials are not available
 */

const INTEGRATION_TESTS_ENABLED = process.env.RUN_S3_INTEGRATION_TESTS === 'true'
const testDescribe = INTEGRATION_TESTS_ENABLED ? describe : describe.skip

testDescribe('S3Adapter - Integration Tests', () => {
  let adapter: S3Adapter
  let testBucketName: string
  let s3Client: S3Client

  beforeAll(() => {
    // Verify AWS credentials are available
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn('⚠️  Skipping S3 integration tests: AWS credentials not found')
      console.warn('   Set RUN_S3_INTEGRATION_TESTS=true and provide AWS credentials to enable')
    }
  })

  beforeEach(() => {
    // Generate unique bucket name for this test
    const randomSuffix = crypto.randomBytes(4).toString('hex')
    testBucketName = `paf-test-${Date.now()}-${randomSuffix}`.toLowerCase()

    adapter = new S3Adapter()
    s3Client = new S3Client({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    })
  })

  afterEach(async () => {
    // Cleanup: Delete all objects and the test bucket
    try {
      // List and delete all objects first
      const listResponse = await s3Client.send(new ListObjectsV2Command({
        Bucket: testBucketName
      }))

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const object of listResponse.Contents) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: testBucketName,
            Key: object.Key!
          }))
        }
      }

      // Delete the bucket
      await s3Client.send(new DeleteBucketCommand({
        Bucket: testBucketName
      }))

      console.log(`✓ Cleaned up test bucket: ${testBucketName}`)
    } catch (error) {
      // Bucket might not exist, ignore cleanup errors
      console.warn(`Cleanup warning for ${testBucketName}:`, error instanceof Error ? error.message : error)
    }
  })

  describe('bucket auto-creation', () => {
    it('should create a new bucket with all security settings', async () => {
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      })

      // Verify bucket was created
      const status = await adapter.getStatus()
      expect(status.configured).toBe(true)
      expect(status.healthy).toBe(true)
    }, 30000) // 30 second timeout

    it('should enable versioning on created buckets', async () => {
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })

      // Check versioning is enabled
      const versioningResponse = await s3Client.send(new GetBucketVersioningCommand({
        Bucket: testBucketName
      }))

      expect(versioningResponse.Status).toBe('Enabled')
    }, 30000)

    it('should enable encryption on created buckets', async () => {
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })

      // Check encryption is enabled
      const encryptionResponse = await s3Client.send(new GetBucketEncryptionCommand({
        Bucket: testBucketName
      }))

      expect(encryptionResponse.ServerSideEncryptionConfiguration).toBeDefined()
      const rules = encryptionResponse.ServerSideEncryptionConfiguration?.Rules
      expect(rules).toBeDefined()
      expect(rules![0].ApplyServerSideEncryptionByDefault?.SSEAlgorithm).toBe('AES256')
    }, 30000)

    it('should block public access on created buckets', async () => {
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })

      // Check public access is blocked
      const publicAccessResponse = await s3Client.send(new GetPublicAccessBlockCommand({
        Bucket: testBucketName
      }))

      expect(publicAccessResponse.PublicAccessBlockConfiguration).toMatchObject({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      })
    }, 30000)

    it('should handle existing bucket without errors', async () => {
      // Initialize once to create bucket
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })

      // Initialize again with same bucket - should not error
      const adapter2 = new S3Adapter()
      await expect(adapter2.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })).resolves.not.toThrow()

      const status = await adapter2.getStatus()
      expect(status.configured).toBe(true)
    }, 30000)
  })

  describe('file operations', () => {
    beforeEach(async () => {
      // Initialize adapter with test bucket
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })
    })

    it('should upload and read files successfully', async () => {
      const testContent = 'Hello from S3 integration test!'
      const testPath = '/test-file.txt'

      // Write file
      const writeResult = await adapter.writeFile(testPath, testContent)
      expect(writeResult.path).toBe(testPath)
      expect(writeResult.type).toBe('file')

      // Read file
      const readResult = await adapter.readFile(testPath)
      expect(readResult.content).toBe(testContent)
    }, 30000)

    it('should list files correctly', async () => {
      // Create some test files
      await adapter.writeFile('/file1.txt', 'content1')
      await adapter.writeFile('/file2.txt', 'content2')
      await adapter.createFolder('/folder1')

      // List files
      const files = await adapter.listFiles('/')

      expect(files.length).toBeGreaterThanOrEqual(2)
      expect(files.some(f => f.name === 'file1.txt')).toBe(true)
      expect(files.some(f => f.name === 'file2.txt')).toBe(true)
    }, 30000)

    it('should delete files successfully', async () => {
      const testPath = '/delete-me.txt'

      // Create file
      await adapter.writeFile(testPath, 'to be deleted')

      // Verify it exists
      const filesBeforeDelete = await adapter.listFiles('/')
      expect(filesBeforeDelete.some(f => f.name === 'delete-me.txt')).toBe(true)

      // Delete file
      await adapter.deleteFile(testPath)

      // Verify it's gone
      const filesAfterDelete = await adapter.listFiles('/')
      expect(filesAfterDelete.some(f => f.name === 'delete-me.txt')).toBe(false)
    }, 30000)
  })

  describe('health checks', () => {
    it('should report healthy when bucket is accessible', async () => {
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })

      const healthy = await adapter.isHealthy()
      expect(healthy).toBe(true)
    }, 30000)

    it('should report unhealthy when bucket does not exist', async () => {
      await adapter.initialize({
        bucket: testBucketName,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-2'
      })

      // Delete the bucket to make it inaccessible
      await s3Client.send(new DeleteBucketCommand({
        Bucket: testBucketName
      }))

      const healthy = await adapter.isHealthy()
      expect(healthy).toBe(false)
    }, 30000)
  })
})
