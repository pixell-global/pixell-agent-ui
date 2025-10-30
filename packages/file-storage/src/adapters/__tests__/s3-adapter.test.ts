import { S3Client, HeadBucketCommand, CreateBucketCommand, ListObjectsV2Command, PutBucketVersioningCommand, PutBucketEncryptionCommand, PutPublicAccessBlockCommand } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Adapter } from '../s3-adapter'

const s3Mock = mockClient(S3Client)

describe('S3Adapter - Unit Tests', () => {
  let adapter: S3Adapter

  beforeEach(() => {
    s3Mock.reset()
    adapter = new S3Adapter()
  })

  afterEach(() => {
    s3Mock.restore()
  })

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).resolves({})
      s3Mock.on(PutBucketVersioningCommand).resolves({})
      s3Mock.on(PutBucketEncryptionCommand).resolves({})
      s3Mock.on(PutPublicAccessBlockCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'test-bucket',
        region: 'us-east-2',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      })

      const status = await adapter.getStatus()
      expect(status.configured).toBe(true)
    })

    it('should throw error when bucket name is missing', async () => {
      await expect(adapter.initialize({
        region: 'us-east-2',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      })).rejects.toThrow('S3 bucket name is required')
    })

    it('should use bucketResolver when bucket is not provided', async () => {
      const bucketResolver = jest.fn().mockResolvedValue('resolved-bucket')

      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).resolves({})
      s3Mock.on(PutBucketVersioningCommand).resolves({})
      s3Mock.on(PutBucketEncryptionCommand).resolves({})
      s3Mock.on(PutPublicAccessBlockCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucketResolver,
        region: 'us-east-2',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      })

      expect(bucketResolver).toHaveBeenCalled()
    })
  })

  describe('bucket auto-creation', () => {
    it('should check if bucket exists before creating', async () => {
      s3Mock.on(HeadBucketCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'existing-bucket',
        region: 'us-east-2'
      })

      // Should call HeadBucket but not CreateBucket
      expect(s3Mock.commandCalls(CreateBucketCommand)).toHaveLength(0)
    })

    it('should create bucket when it does not exist', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).resolves({})
      s3Mock.on(PutBucketVersioningCommand).resolves({})
      s3Mock.on(PutBucketEncryptionCommand).resolves({})
      s3Mock.on(PutPublicAccessBlockCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'new-bucket',
        region: 'us-east-2'
      })

      expect(s3Mock.commandCalls(CreateBucketCommand)).toHaveLength(1)
    })

    it('should enable versioning on new buckets', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).resolves({})
      s3Mock.on(PutBucketVersioningCommand).resolves({})
      s3Mock.on(PutBucketEncryptionCommand).resolves({})
      s3Mock.on(PutPublicAccessBlockCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'new-bucket',
        region: 'us-east-2'
      })

      const versioningCalls = s3Mock.commandCalls(PutBucketVersioningCommand)
      expect(versioningCalls).toHaveLength(1)
      expect(versioningCalls[0].args[0].input).toMatchObject({
        Bucket: 'new-bucket',
        VersioningConfiguration: { Status: 'Enabled' }
      })
    })

    it('should enable AES-256 encryption on new buckets', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).resolves({})
      s3Mock.on(PutBucketVersioningCommand).resolves({})
      s3Mock.on(PutBucketEncryptionCommand).resolves({})
      s3Mock.on(PutPublicAccessBlockCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'new-bucket',
        region: 'us-east-2'
      })

      const encryptionCalls = s3Mock.commandCalls(PutBucketEncryptionCommand)
      expect(encryptionCalls).toHaveLength(1)
      expect(encryptionCalls[0].args[0].input.ServerSideEncryptionConfiguration).toBeDefined()
    })

    it('should block public access on new buckets', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).resolves({})
      s3Mock.on(PutBucketVersioningCommand).resolves({})
      s3Mock.on(PutBucketEncryptionCommand).resolves({})
      s3Mock.on(PutPublicAccessBlockCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'new-bucket',
        region: 'us-east-2'
      })

      const publicAccessCalls = s3Mock.commandCalls(PutPublicAccessBlockCommand)
      expect(publicAccessCalls).toHaveLength(1)
      expect(publicAccessCalls[0].args[0].input.PublicAccessBlockConfiguration).toMatchObject({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      })
    })

    it('should handle BucketAlreadyOwnedByYou error gracefully', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).rejects({ name: 'BucketAlreadyOwnedByYou' })
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await expect(adapter.initialize({
        bucket: 'existing-bucket',
        region: 'us-east-2'
      })).resolves.not.toThrow()
    })

    it('should throw error on AccessDenied with helpful message', async () => {
      s3Mock.on(HeadBucketCommand).rejects({ name: 'NotFound' })
      s3Mock.on(CreateBucketCommand).rejects({ name: 'AccessDenied', message: 'Access Denied' })

      await expect(adapter.initialize({
        bucket: 'denied-bucket',
        region: 'us-east-2'
      })).rejects.toThrow(/AWS IAM permissions insufficient|Access Denied/)
    })
  })

  describe('isHealthy', () => {
    it('should return false when not initialized', async () => {
      const healthy = await adapter.isHealthy()
      expect(healthy).toBe(false)
    })

    it('should return true when initialized and S3 is accessible', async () => {
      s3Mock.on(HeadBucketCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'test-bucket',
        region: 'us-east-2'
      })

      const healthy = await adapter.isHealthy()
      expect(healthy).toBe(true)
    })

    it('should return false when S3 is not accessible', async () => {
      s3Mock.on(HeadBucketCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      await adapter.initialize({
        bucket: 'test-bucket',
        region: 'us-east-2'
      })

      // Simulate S3 becoming unavailable
      s3Mock.on(ListObjectsV2Command).rejects(new Error('Network error'))

      const healthy = await adapter.isHealthy()
      expect(healthy).toBe(false)
    })
  })
})
