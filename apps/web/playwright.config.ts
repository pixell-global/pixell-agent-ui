import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

/**
 * Playwright E2E Test Configuration
 *
 * Run with: npx playwright test
 * Run specific file: npx playwright test __tests__/e2e/feature-quota-flow.test.ts
 * Run with UI: npx playwright test --ui
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'api-tests',
      testMatch: /.*\.test\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Web server configuration - expects server to already be running on port 3003
  // Start with: npm run dev
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3003',
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },
})
