import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load environment variables from root .env.dev for E2E tests
config({ path: resolve(__dirname, '../../.env.dev') })

// Set S3 bucket for file storage (needed for E2E tests)
process.env.STORAGE_S3_BUCKET = process.env.STORAGE_S3_BUCKET || 'pixell-agents'
process.env.STORAGE_S3_REGION = process.env.STORAGE_S3_REGION || 'us-east-2'

// Check if running E2E tests
const isE2E = process.env.TEST_TYPE === 'e2e'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // E2E tests have longer timeouts and different include patterns
    include: isE2E
      ? ['src/__tests__/e2e/**/*.test.ts']
      : ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/__tests__/**/*.test.ts'],
    exclude: isE2E
      ? ['**/node_modules/**']
      : ['**/node_modules/**', '**/test-utils.ts', 'src/__tests__/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/__tests__/**', 'src/index.ts'],
    },
    // E2E tests need much longer timeouts (service startup, S3 operations)
    testTimeout: isE2E ? 180000 : 30000,
    hookTimeout: isE2E ? 180000 : 30000,
    // Needed for MSW
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // E2E tests should run sequentially
    sequence: isE2E
      ? {
          shuffle: false,
        }
      : undefined,
  },
})
