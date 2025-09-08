import { test, expect } from '@playwright/test'

test.describe('Signup → Onboarding → Brand', () => {
  test('happy path', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[type="email"]', 'e2e-user@example.com')
    await page.click('button:has-text("Sign")')
    // Simulate email verification and session cookie outside of E2E scope

    await page.goto('/onboarding')
    await page.fill('input[name="orgName"]', 'E2E Org')
    await page.click('button:has-text("Continue")')

    await page.waitForURL(/onboarding\/brand/)
    await page.fill('input[name="brandName"]', 'E2E Brand')
    await page.click('button:has-text("Finish")')

    await page.waitForURL(/\/$/)
  })
})


