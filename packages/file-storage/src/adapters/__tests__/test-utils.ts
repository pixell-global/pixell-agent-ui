import crypto from 'crypto'

/**
 * Test utilities for S3Adapter tests
 */

/**
 * Generate a unique test bucket name
 */
export function generateTestBucketName(prefix: string = 'paf-test'): string {
  const timestamp = Date.now()
  const randomSuffix = crypto.randomBytes(4).toString('hex')
  return `${prefix}-${timestamp}-${randomSuffix}`.toLowerCase()
}

/**
 * Generate a unique organization ID for testing
 */
export function generateTestOrgId(): string {
  return crypto.randomUUID()
}

/**
 * Generate a unique user ID for testing
 */
export function generateTestUserId(): string {
  return crypto.randomUUID()
}

/**
 * Sleep for specified milliseconds (useful for eventual consistency waits)
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if integration tests should run
 */
export function shouldRunIntegrationTests(): boolean {
  return process.env.RUN_S3_INTEGRATION_TESTS === 'true' &&
         !!process.env.AWS_ACCESS_KEY_ID &&
         !!process.env.AWS_SECRET_ACCESS_KEY
}

/**
 * Mock AWS credentials for testing
 */
export const MOCK_AWS_CONFIG = {
  region: 'us-east-2',
  accessKeyId: 'test-access-key-id',
  secretAccessKey: 'test-secret-access-key'
}

/**
 * Test data generators
 */
export const TestData = {
  /**
   * Generate test file content
   */
  fileContent: (size: number = 100): string => {
    return crypto.randomBytes(size).toString('base64')
  },

  /**
   * Generate test organization name
   */
  orgName: (): string => {
    const names = ['Acme Corp', 'VividAI', 'TechStart', 'DataCo', 'CloudFirst']
    return names[Math.floor(Math.random() * names.length)]
  },

  /**
   * Generate test file path
   */
  filePath: (context: 'user' | 'team' | 'brand' | 'shared' = 'user'): string => {
    const filename = `test-file-${Date.now()}.txt`
    switch (context) {
      case 'user':
        return `/users/${generateTestUserId()}/workspace-files/${filename}`
      case 'team':
        return `/teams/${generateTestOrgId()}/shared/${filename}`
      case 'brand':
        return `/brands/${generateTestOrgId()}/assets/${filename}`
      case 'shared':
        return `/shared/${filename}`
    }
  }
}
