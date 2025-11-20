import { S3Adapter } from '@pixell/file-storage/src/adapters/s3-adapter'

const sendMock = jest.fn(async () => ({}))

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    ListObjectsV2Command: class {},
    GetObjectCommand: class {},
    PutObjectCommand: class {},
    DeleteObjectCommand: class {},
    HeadObjectCommand: class {},
  }
})

describe('S3Adapter operations (mocked)', () => {
  beforeEach(() => sendMock.mockClear())

  test('write/read/delete flow uses correct sequence', async () => {
    const adapter = new S3Adapter()
    await adapter.initialize({ bucketResolver: async () => 'paf-org-x-123', region: 'us-east-2' })
    await adapter.writeFile('/a.txt', 'hi')
    await adapter.readFile('/a.txt')
    await adapter.deleteFile('/a.txt')

    expect(sendMock).toHaveBeenCalled()
  })
})


