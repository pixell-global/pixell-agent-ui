import { StorageManager } from '@pixell/file-storage/src/storage-manager'

describe('StorageManager env config', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  test('defaults to local with org-scoped root path', () => {
    delete process.env.STORAGE_PROVIDER
    const cfg = StorageManager.getConfigFromEnv()
    expect(cfg.provider).toBe('local')
    expect(cfg.config.rootPath).toContain('workspace-files')
  })

  test('s3 region defaults to us-east-2 when not provided', () => {
    process.env.STORAGE_PROVIDER = 's3'
    delete process.env.STORAGE_S3_REGION
    delete process.env.AWS_DEFAULT_REGION
    const cfg = StorageManager.getConfigFromEnv()
    expect(cfg.provider).toBe('s3')
    expect(cfg.config.region).toBe('us-east-2')
  })
})


