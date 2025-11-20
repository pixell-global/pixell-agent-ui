import { S3Adapter } from '@pixell/file-storage/src/adapters/s3-adapter'

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn(async () => ({})) })),
    ListObjectsV2Command: class {},
    GetObjectCommand: class {},
    PutObjectCommand: class {},
    DeleteObjectCommand: class {},
    HeadObjectCommand: class {},
  }
})

describe('S3Adapter (mocked)', () => {
  test('initializes with bucketResolver', async () => {
    const adapter = new S3Adapter()
    await adapter.initialize({ bucketResolver: async () => 'paf-org-test-12345678', region: 'us-east-2' })
    const healthy = await adapter.isHealthy()
    expect(healthy).toBe(true)
  })
})


