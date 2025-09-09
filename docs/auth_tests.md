# Auth Test Plan — Brands & Teams

**Based on:** `auth_implementation_steps.md` and `auth_checklist.md`  
**Purpose:** Comprehensive testing strategy for multi-tenant auth with Brands & Teams  
**Coverage:** Unit, Integration, E2E, Performance, and Security testing  

---

## Test Strategy Overview

### Testing Pyramid
```
    E2E Tests (10%)
   Integration Tests (20%)
  Unit Tests (70%)
```

### Test Categories
1. **Unit Tests** - Individual functions and methods
2. **Integration Tests** - API endpoints and database interactions
3. **E2E Tests** - Complete user workflows
4. **Performance Tests** - Load and stress testing
5. **Security Tests** - Authentication and authorization
6. **Accessibility Tests** - UI/UX compliance

---

## Phase 1: Database & Schema Tests

### 1.1 Schema Validation Tests
```typescript
// packages/db-mysql/__tests__/schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../src/connection'
import { users, organizations, teams, brands } from '../src/schema'

describe('Database Schema', () => {
  beforeAll(async () => {
    // Setup test database
  })

  afterAll(async () => {
    // Cleanup test database
  })

  it('should create users table with correct constraints', async () => {
    const result = await db.insert(users).values({
      id: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User'
    })
    expect(result).toBeDefined()
  })

  it('should enforce unique email constraint', async () => {
    await expect(
      db.insert(users).values({
        id: 'test-user-456',
        email: 'test@example.com', // Duplicate email
        displayName: 'Another User'
      })
    ).rejects.toThrow()
  })

  it('should create organizations with proper foreign keys', async () => {
    const result = await db.insert(organizations).values({
      id: 'test-org-123',
      name: 'Test Organization',
      createdBy: 'test-user-123'
    })
    expect(result).toBeDefined()
  })

  it('should enforce foreign key constraints', async () => {
    await expect(
      db.insert(organizations).values({
        id: 'test-org-456',
        name: 'Invalid Org',
        createdBy: 'non-existent-user' // Invalid foreign key
      })
    ).rejects.toThrow()
  })
})
```

### 1.2 Migration Tests
```typescript
// packages/db-mysql/__tests__/migrations.test.ts
import { describe, it, expect } from 'vitest'
import { migrate } from 'drizzle-orm/mysql2/migrator'

describe('Database Migrations', () => {
  it('should apply all migrations successfully', async () => {
    await expect(migrate(db, { migrationsFolder: './migrations' })).resolves.not.toThrow()
  })

  it('should handle migration rollbacks', async () => {
    // Test rollback functionality
  })

  it('should maintain data integrity during migrations', async () => {
    // Test that existing data is preserved
  })
})
```

---

## Phase 2: Repository Layer Tests

### 2.1 Base Repository Tests
```typescript
// packages/db-mysql/__tests__/repositories/base.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { BaseRepository } from '../../src/repositories/base'
import { db } from '../../src/connection'

class TestRepository extends BaseRepository {
  // Expose protected methods for testing
  public async testEnsureUserInOrg(userId: string, orgId: string) {
    return this.ensureUserInOrg(userId, orgId)
  }

  public async testGetUserOrgRole(userId: string, orgId: string) {
    return this.getUserOrgRole(userId, orgId)
  }

  public testHasOrgOverride(role: string) {
    return this.hasOrgOverride(role)
  }
}

describe('BaseRepository', () => {
  let repo: TestRepository

  beforeEach(() => {
    repo = new TestRepository()
  })

  describe('ensureUserInOrg', () => {
    it('should return true for valid user-org relationship', async () => {
      const result = await repo.testEnsureUserInOrg('user-123', 'org-123')
      expect(result).toBe(true)
    })

    it('should return false for invalid user-org relationship', async () => {
      const result = await repo.testEnsureUserInOrg('user-123', 'org-456')
      expect(result).toBe(false)
    })
  })

  describe('getUserOrgRole', () => {
    it('should return correct role for user in organization', async () => {
      const role = await repo.testGetUserOrgRole('user-123', 'org-123')
      expect(role).toBe('member')
    })

    it('should return null for user not in organization', async () => {
      const role = await repo.testGetUserOrgRole('user-123', 'org-456')
      expect(role).toBeNull()
    })
  })

  describe('hasOrgOverride', () => {
    it('should return true for owner role', () => {
      expect(repo.testHasOrgOverride('owner')).toBe(true)
    })

    it('should return true for admin role', () => {
      expect(repo.testHasOrgOverride('admin')).toBe(true)
    })

    it('should return false for member role', () => {
      expect(repo.testHasOrgOverride('member')).toBe(false)
    })

    it('should return false for viewer role', () => {
      expect(repo.testHasOrgOverride('viewer')).toBe(false)
    })
  })
})
```

### 2.2 Teams Repository Tests
```typescript
// packages/db-mysql/__tests__/repositories/teams.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TeamsRepo } from '../../src/repositories/teams'
import { db } from '../../src/connection'

describe('TeamsRepo', () => {
  let teamsRepo: TeamsRepo

  beforeEach(() => {
    teamsRepo = new TeamsRepo()
  })

  afterEach(async () => {
    // Cleanup test data
    await db.delete(teams).where(eq(teams.orgId, 'test-org'))
  })

  describe('create', () => {
    it('should create team successfully', async () => {
      const team = await teamsRepo.create('test-org', 'Test Team', 'Test Description')
      expect(team.name).toBe('Test Team')
      expect(team.orgId).toBe('test-org')
      expect(team.description).toBe('Test Description')
    })

    it('should throw error if user not in organization', async () => {
      await expect(
        teamsRepo.create('test-org', 'Test Team', 'Test Description', 'invalid-user')
      ).rejects.toThrow('User not in organization')
    })

    it('should generate UUID for team ID', async () => {
      const team = await teamsRepo.create('test-org', 'Test Team')
      expect(team.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
  })

  describe('addMember', () => {
    it('should add member to team successfully', async () => {
      const team = await teamsRepo.create('test-org', 'Test Team')
      await expect(
        teamsRepo.addMember(team.id, 'user-123', 'member')
      ).resolves.not.toThrow()
    })

    it('should validate team member roles', async () => {
      const team = await teamsRepo.create('test-org', 'Test Team')
      await expect(
        teamsRepo.addMember(team.id, 'user-123', 'invalid-role' as any)
      ).rejects.toThrow()
    })
  })

  describe('listByOrg', () => {
    it('should return all teams for organization', async () => {
      await teamsRepo.create('test-org', 'Team 1')
      await teamsRepo.create('test-org', 'Team 2')
      
      const teams = await teamsRepo.listByOrg('test-org')
      expect(teams).toHaveLength(2)
      expect(teams.map(t => t.name)).toContain('Team 1')
      expect(teams.map(t => t.name)).toContain('Team 2')
    })
  })
})
```

### 2.3 Brands Repository Tests
```typescript
// packages/db-mysql/__tests__/repositories/brands.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrandsRepo } from '../../src/repositories/brands'
import { db } from '../../src/connection'

describe('BrandsRepo', () => {
  let brandsRepo: BrandsRepo

  beforeEach(() => {
    brandsRepo = new BrandsRepo()
  })

  afterEach(async () => {
    // Cleanup test data
    await db.delete(brands).where(eq(brands.orgId, 'test-org'))
  })

  describe('create', () => {
    it('should create brand successfully', async () => {
      const brand = await brandsRepo.create('test-org', 'Test Brand', 'TEST')
      expect(brand.name).toBe('Test Brand')
      expect(brand.code).toBe('TEST')
      expect(brand.orgId).toBe('test-org')
    })

    it('should enforce unique brand codes', async () => {
      await brandsRepo.create('test-org', 'Brand 1', 'TEST')
      await expect(
        brandsRepo.create('test-org', 'Brand 2', 'TEST')
      ).rejects.toThrow()
    })
  })

  describe('assignTeam', () => {
    it('should assign team to brand in shared mode', async () => {
      const brand = await brandsRepo.create('test-org', 'Test Brand')
      const teamId = 'test-team-123'
      
      await expect(
        brandsRepo.assignTeam(brand.id, teamId, 'editor')
      ).resolves.not.toThrow()
    })

    it('should enforce isolation mode restrictions', async () => {
      // Setup org in isolated mode
      await db.insert(orgSettings).values({
        orgId: 'test-org',
        brandAccessMode: 'isolated'
      })

      const brand = await brandsRepo.create('test-org', 'Test Brand', undefined, 'primary-team')
      const nonPrimaryTeam = 'non-primary-team'
      
      await expect(
        brandsRepo.assignTeam(brand.id, nonPrimaryTeam, 'editor')
      ).rejects.toThrow('In isolated mode, only primary team can access brand')
    })
  })

  describe('listByUser', () => {
    it('should return all brands for org owner', async () => {
      await brandsRepo.create('test-org', 'Brand 1')
      await brandsRepo.create('test-org', 'Brand 2')
      
      const brands = await brandsRepo.listByUser('test-org', 'owner-user')
      expect(brands).toHaveLength(2)
    })

    it('should return only accessible brands for regular user', async () => {
      const brand1 = await brandsRepo.create('test-org', 'Brand 1')
      await brandsRepo.create('test-org', 'Brand 2')
      
      // Grant user access to only Brand 1
      await brandsRepo.grantUser(brand1.id, 'regular-user', 'viewer')
      
      const brands = await brandsRepo.listByUser('test-org', 'regular-user')
      expect(brands).toHaveLength(1)
      expect(brands[0].name).toBe('Brand 1')
    })

    it('should respect permission precedence', async () => {
      const brand = await brandsRepo.create('test-org', 'Test Brand')
      
      // Grant user access via team
      await brandsRepo.assignTeam(brand.id, 'user-team', 'viewer')
      
      // Grant user direct access with higher role
      await brandsRepo.grantUser(brand.id, 'regular-user', 'editor')
      
      // Should return brand with highest permission level
      const brands = await brandsRepo.listByUser('test-org', 'regular-user')
      expect(brands).toHaveLength(1)
    })
  })
})
```

---

## Phase 3: Usage Tracking Tests

### 3.1 Usage Client Tests
```typescript
// packages/usage/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsageClient } from '../src/client'

// Mock fetch
global.fetch = vi.fn()

describe('UsageClient', () => {
  let client: UsageClient

  beforeEach(() => {
    client = new UsageClient('https://api.example.com', 'test-api-key')
    vi.clearAllMocks()
  })

  describe('track', () => {
    it('should send usage event successfully', async () => {
      const mockResponse = { ok: true }
      ;(fetch as any).mockResolvedValue(mockResponse)

      await client.track({
        actionKey: 'test_action',
        units: 1,
        metadata: { feature: 'test' },
        brandId: 'test-brand'
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/usage/track',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: JSON.stringify({
            actionKey: 'test_action',
            units: 1,
            metadata: { feature: 'test' },
            brandId: 'test-brand'
          })
        })
      )
    })

    it('should handle network errors', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'))

      await expect(
        client.track({ actionKey: 'test_action' })
      ).rejects.toThrow('Usage tracking failed: Network error')
    })

    it('should handle HTTP error responses', async () => {
      const mockResponse = { 
        ok: false, 
        statusText: 'Bad Request' 
      }
      ;(fetch as any).mockResolvedValue(mockResponse)

      await expect(
        client.track({ actionKey: 'test_action' })
      ).rejects.toThrow('Usage tracking failed: Bad Request')
    })
  })
})
```

### 3.2 Usage Server Tests
```typescript
// packages/usage/__tests__/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { trackUsage } from '../src/server'
import { db } from '@pixell/db-mysql'

describe('Usage Server', () => {
  beforeEach(async () => {
    // Setup test database
  })

  afterEach(async () => {
    // Cleanup test data
    await db.delete(actionEvents).where(eq(actionEvents.orgId, 'test-org'))
  })

  describe('trackUsage', () => {
    it('should record usage event successfully', async () => {
      const params = {
        orgId: 'test-org',
        userId: 'test-user',
        actionKey: 'test_action',
        units: 5,
        metadata: { feature: 'test' },
        brandId: 'test-brand'
      }

      await trackUsage(params)

      const events = await db
        .select()
        .from(actionEvents)
        .where(eq(actionEvents.orgId, 'test-org'))

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        orgId: 'test-org',
        userId: 'test-user',
        actionKey: 'test_action',
        units: 5,
        brandId: 'test-brand'
      })
    })

    it('should handle idempotency keys', async () => {
      const params = {
        orgId: 'test-org',
        userId: 'test-user',
        actionKey: 'test_action',
        idempotencyKey: 'unique-key-123'
      }

      // Record same event twice with same idempotency key
      await trackUsage(params)
      await trackUsage(params)

      const events = await db
        .select()
        .from(actionEvents)
        .where(eq(actionEvents.orgId, 'test-org'))

      // Should only have one event due to idempotency
      expect(events).toHaveLength(1)
    })
  })
})
```

---

## Phase 4: API Route Tests

### 4.1 Brands API Tests
```typescript
// apps/web/__tests__/api/brands.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import { POST, PATCH } from '../../src/app/api/brands/route'
import { getSession } from '@pixell/auth-firebase/server'

// Mock Firebase auth
vi.mock('@pixell/auth-firebase/server', () => ({
  getSession: vi.fn()
}))

describe('/api/brands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should create brand successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Brand',
          code: 'TEST'
        },
        headers: {
          'x-org-id': 'test-org'
        }
      })

      ;(getSession as any).mockResolvedValue({ uid: 'test-user' })

      await POST(req)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.name).toBe('Test Brand')
      expect(data.code).toBe('TEST')
    })

    it('should return 401 for unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { name: 'Test Brand' }
      })

      ;(getSession as any).mockResolvedValue(null)

      await POST(req)

      expect(res._getStatusCode()).toBe(401)
    })

    it('should return 400 for missing organization ID', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { name: 'Test Brand' }
      })

      ;(getSession as any).mockResolvedValue({ uid: 'test-user' })

      await POST(req)

      expect(res._getStatusCode()).toBe(400)
    })
  })
})
```

### 4.2 Teams API Tests
```typescript
// apps/web/__tests__/api/teams.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import { POST, GET } from '../../src/app/api/teams/route'

describe('/api/teams', () => {
  describe('POST', () => {
    it('should create team successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Team',
          description: 'Test Description'
        },
        headers: {
          'x-org-id': 'test-org'
        }
      })

      ;(getSession as any).mockResolvedValue({ uid: 'test-user' })

      await POST(req)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.name).toBe('Test Team')
      expect(data.description).toBe('Test Description')
    })
  })

  describe('GET', () => {
    it('should return teams for organization', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-org-id': 'test-org'
        }
      })

      ;(getSession as any).mockResolvedValue({ uid: 'test-user' })

      await GET(req)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(Array.isArray(data)).toBe(true)
    })
  })
})
```

---

## Phase 5: Frontend Component Tests

### 5.1 Brand Components Tests
```typescript
// apps/web/__tests__/components/brands/BrandList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrandList } from '../../../src/components/brands/BrandList'

// Mock fetch
global.fetch = vi.fn()

describe('BrandList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    render(<BrandList orgId="test-org" />)
    expect(screen.getByText('Loading brands...')).toBeInTheDocument()
  })

  it('should render brands after loading', async () => {
    const mockBrands = [
      { id: '1', name: 'Brand 1', code: 'B1' },
      { id: '2', name: 'Brand 2', code: 'B2' }
    ]

    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBrands)
    })

    render(<BrandList orgId="test-org" />)

    await waitFor(() => {
      expect(screen.getByText('Brand 1')).toBeInTheDocument()
      expect(screen.getByText('Brand 2')).toBeInTheDocument()
      expect(screen.getByText('B1')).toBeInTheDocument()
      expect(screen.getByText('B2')).toBeInTheDocument()
    })
  })

  it('should handle API errors gracefully', async () => {
    ;(fetch as any).mockRejectedValue(new Error('API Error'))

    render(<BrandList orgId="test-org" />)

    await waitFor(() => {
      expect(screen.getByText('Loading brands...')).toBeInTheDocument()
    })
  })
})
```

### 5.2 Brand Context Tests
```typescript
// apps/web/__tests__/components/brands/BrandContext.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrandProvider, useBrandContext } from '../../../src/components/brands/BrandContext'

const TestComponent = () => {
  const { selectedBrand, setSelectedBrand, requireBrandContext } = useBrandContext()
  
  return (
    <div>
      <div data-testid="selected-brand">{selectedBrand?.name || 'None'}</div>
      <div data-testid="require-context">{requireBrandContext.toString()}</div>
      <button onClick={() => setSelectedBrand({ id: '1', name: 'Test Brand' })}>
        Select Brand
      </button>
    </div>
  )
}

describe('BrandContext', () => {
  it('should provide brand context to children', () => {
    render(
      <BrandProvider requireBrandContext={true}>
        <TestComponent />
      </BrandProvider>
    )

    expect(screen.getByTestId('selected-brand')).toHaveTextContent('None')
    expect(screen.getByTestId('require-context')).toHaveTextContent('true')
  })

  it('should update selected brand when setSelectedBrand is called', () => {
    render(
      <BrandProvider>
        <TestComponent />
      </BrandProvider>
    )

    fireEvent.click(screen.getByText('Select Brand'))
    expect(screen.getByTestId('selected-brand')).toHaveTextContent('Test Brand')
  })

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => render(<TestComponent />)).toThrow(
      'useBrandContext must be used within a BrandProvider'
    )
    
    consoleSpy.mockRestore()
  })
})
```

---

## Phase 6: Middleware Tests

### 6.1 Middleware Tests
```typescript
// apps/web/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../../middleware'

// Mock Firebase auth
vi.mock('@pixell/auth-firebase/server', () => ({
  verifySession: vi.fn()
}))

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should redirect to signin for unauthenticated requests', async () => {
    const request = new NextRequest('https://example.com/api/test')
    ;(verifySession as any).mockResolvedValue(null)

    const response = await middleware(request)
    
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toContain('/signin')
  })

  it('should redirect to organizations for missing org ID', async () => {
    const request = new NextRequest('https://example.com/api/test')
    ;(verifySession as any).mockResolvedValue({ uid: 'test-user' })

    const response = await middleware(request)
    
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toContain('/organizations')
  })

  it('should add context headers for valid requests', async () => {
    const request = new NextRequest('https://test-org.example.com/api/test')
    ;(verifySession as any).mockResolvedValue({ uid: 'test-user' })

    const response = await middleware(request)
    
    expect(response?.headers.get('x-org-id')).toBe('test-org')
    expect(response?.headers.get('x-user-id')).toBe('test-user')
  })

  it('should require brand context for brand-scoped routes', async () => {
    const request = new NextRequest('https://test-org.example.com/api/usage/track')
    ;(verifySession as any).mockResolvedValue({ uid: 'test-user' })

    const response = await middleware(request)
    
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toContain('/brands')
  })
})
```

---

## Phase 7: E2E Tests

### 7.1 Complete User Flow Tests
```typescript
// apps/web/__tests__/e2e/auth-flows.test.ts
import { test, expect } from '@playwright/test'

test.describe('Auth Flows with Brands & Teams', () => {
  test('new user signup flow', async ({ page }) => {
    // 1. Sign up
    await page.goto('/signup')
    await page.fill('[name="email"]', 'newuser@example.com')
    await page.click('button[type="submit"]')
    
    // Should show email sent message
    await expect(page.locator('text=Check your email')).toBeVisible()
    
    // 2. Email verification (simulate)
    await page.goto('/signup/verify?email=newuser@example.com')
    
    // 3. Onboarding - Organization
    await page.waitForURL('/onboarding')
    await page.fill('[name="orgName"]', 'Test Organization')
    await page.click('button[type="submit"]')
    
    // 4. Onboarding - Brand
    await page.waitForURL('/onboarding/brand')
    await page.fill('[name="brandName"]', 'Test Brand')
    await page.fill('[name="brandCode"]', 'TEST')
    await page.selectOption('[name="accessMode"]', 'shared')
    await page.click('button[type="submit"]')
    
    // 5. Should redirect to dashboard
    await page.waitForURL('/dashboard')
  })

  test('returning user signin flow', async ({ page }) => {
    // 1. Sign in
    await page.goto('/signin')
    await page.fill('[name="email"]', 'existinguser@example.com')
    await page.click('button[type="submit"]')
    
    // Should show email sent message
    await expect(page.locator('text=Check your email')).toBeVisible()
    
    // 2. Email verification (simulate)
    await page.goto('/signin/verify?email=existinguser@example.com')
    
    // 3. Should redirect to dashboard or org picker
    await expect(page).toHaveURL(/\/dashboard|\/organizations/)
  })

  test('invite acceptance flow', async ({ page }) => {
    // 1. Access invite link
    await page.goto('/accept-invite?token=valid-invite-token')
    
    // 2. Should show invite preview
    await expect(page.locator('text=You\'ve been invited')).toBeVisible()
    await expect(page.locator('text=Test Organization')).toBeVisible()
    
    // 3. Accept invite
    await page.click('button:has-text("Accept Invite")')
    
    // 4. Should redirect to dashboard
    await page.waitForURL('/dashboard')
  })

  test('complete flow: org → team → brand → access → usage', async ({ page }) => {
    // Setup: User is already signed in
    await page.goto('/dashboard')
    
    // 1. Create team
    await page.goto('/teams/create')
    await page.fill('[name="name"]', 'Marketing Team')
    await page.fill('[name="description"]', 'Team for marketing activities')
    await page.click('button[type="submit"]')
    await page.waitForURL('/teams')
    
    // 2. Create brand
    await page.goto('/brands/create')
    await page.fill('[name="name"]', 'Test Brand')
    await page.fill('[name="code"]', 'TEST')
    await page.click('button[type="submit"]')
    await page.waitForURL('/brands')
    
    // 3. Assign team to brand
    await page.goto('/brands/*/access')
    await page.selectOption('[name="teamId"]', 'Marketing Team')
    await page.selectOption('[name="role"]', 'editor')
    await page.click('button[type="submit"]')
    
    // 4. Verify usage tracking
    await page.goto('/dashboard')
    await page.click('[data-testid="agent-action"]')
    
    // Check that usage was tracked with brand ID
    const usageRequest = await page.waitForRequest('/api/usage/track')
    const requestBody = usageRequest.postDataJSON()
    expect(requestBody).toHaveProperty('brandId')
    expect(requestBody.actionKey).toBe('agent_action')
  })

  test('isolated mode restrictions', async ({ page }) => {
    // Setup org in isolated mode
    await page.goto('/settings/organization')
    await page.selectOption('[name="brandAccessMode"]', 'isolated')
    await page.click('button[type="submit"]')
    
    // Create brand with primary team
    await page.goto('/brands/create')
    await page.fill('[name="name"]', 'Isolated Brand')
    await page.selectOption('[name="primaryTeamId"]', 'Marketing Team')
    await page.click('button[type="submit"]')
    
    // Try to assign non-primary team (should fail)
    await page.goto('/brands/*/access')
    await page.selectOption('[name="teamId"]', 'Other Team')
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('.error-message')).toContainText(
      'In isolated mode, only primary team can access brand'
    )
  })

  test('permission precedence', async ({ page }) => {
    // Create brand and assign team access
    await page.goto('/brands/create')
    await page.fill('[name="name"]', 'Test Brand')
    await page.click('button[type="submit"]')
    
    // Assign team with viewer role
    await page.goto('/brands/*/access')
    await page.selectOption('[name="teamId"]', 'Marketing Team')
    await page.selectOption('[name="role"]', 'viewer')
    await page.click('button[type="submit"]')
    
    // Grant user direct access with editor role
    await page.goto('/brands/*/users')
    await page.fill('[name="userId"]', 'test-user')
    await page.selectOption('[name="role"]', 'editor')
    await page.click('button[type="submit"]')
    
    // Verify user has editor access (highest permission)
    await page.goto('/brands')
    const brandCard = page.locator('[data-testid="brand-card"]').first()
    await expect(brandCard.locator('.role-badge')).toContainText('Editor')
  })
})
```

---

## Performance Tests

### 7.2 Load Testing
```typescript
// apps/web/__tests__/performance/load.test.ts
import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test('should handle concurrent brand creation', async ({ browser }) => {
    const context = await browser.newContext()
    const pages = await Promise.all(
      Array.from({ length: 10 }, () => context.newPage())
    )

    const startTime = Date.now()
    
    await Promise.all(
      pages.map(async (page, index) => {
        await page.goto('/brands/create')
        await page.fill('[name="name"]', `Brand ${index}`)
        await page.click('button[type="submit"]')
        await page.waitForURL('/brands')
      })
    )

    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Should complete within 30 seconds
    expect(duration).toBeLessThan(30000)
  })

  test('should handle large brand lists', async ({ page }) => {
    // Create 100 brands
    for (let i = 0; i < 100; i++) {
      await page.goto('/brands/create')
      await page.fill('[name="name"]', `Brand ${i}`)
      await page.click('button[type="submit"]')
      await page.waitForURL('/brands')
    }

    // Load brand list page
    const startTime = Date.now()
    await page.goto('/brands')
    await page.waitForSelector('[data-testid="brand-card"]')
    const endTime = Date.now()
    
    // Should load within 5 seconds
    expect(endTime - startTime).toBeLessThan(5000)
    
    // Should show all brands
    const brandCards = await page.locator('[data-testid="brand-card"]').count()
    expect(brandCards).toBe(100)
  })
})
```

---

## Security Tests

### 7.3 Security Testing
```typescript
// apps/web/__tests__/security/auth.test.ts
import { test, expect } from '@playwright/test'

test.describe('Security Tests', () => {
  test('should prevent unauthorized brand access', async ({ page }) => {
    // Try to access brand without authentication
    await page.goto('/brands/create')
    
    // Should redirect to signin
    await expect(page).toHaveURL(/.*signin.*/)
  })

  test('should prevent cross-organization access', async ({ page }) => {
    // Sign in as user from org A
    await page.goto('/signin')
    await page.fill('[name="email"]', 'user-org-a@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Try to access brand from org B
    await page.goto('/brands/org-b-brand-id')
    
    // Should show 403 or redirect
    await expect(page.locator('body')).toContainText('Forbidden')
  })

  test('should validate CSRF tokens', async ({ page }) => {
    // Test CSRF protection on brand creation
    await page.goto('/brands/create')
    
    // Try to submit without CSRF token
    await page.evaluate(() => {
      document.querySelector('input[name="csrf"]')?.remove()
    })
    
    await page.fill('[name="name"]', 'Test Brand')
    await page.click('button[type="submit"]')
    
    // Should show CSRF error
    await expect(page.locator('.error-message')).toContainText('CSRF')
  })

  test('should prevent SQL injection', async ({ page }) => {
    await page.goto('/brands/create')
    
    // Try SQL injection in brand name
    await page.fill('[name="name"]', "'; DROP TABLE brands; --")
    await page.click('button[type="submit"]')
    
    // Should handle safely (not crash)
    await expect(page).not.toHaveURL('/error')
  })
})
```

---

## Test Configuration

### 7.4 Test Setup
```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

### 7.5 Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## Test Execution Commands

### 7.6 Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:performance": "playwright test --grep 'Performance Tests'",
    "test:security": "playwright test --grep 'Security Tests'",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

---

## Test Coverage Requirements

### 7.7 Coverage Targets
- **Unit Tests**: 90%+ coverage for all business logic
- **Integration Tests**: 80%+ coverage for API endpoints
- **E2E Tests**: 100% coverage for critical user flows
- **Performance Tests**: Response time < 2s for 95th percentile
- **Security Tests**: 100% pass rate for all security checks

### 7.8 Test Categories Summary
- **Unit Tests**: 70% of total test suite
- **Integration Tests**: 20% of total test suite  
- **E2E Tests**: 10% of total test suite
- **Performance Tests**: Separate test suite
- **Security Tests**: Separate test suite

---

## Continuous Integration

### 7.9 CI/CD Pipeline
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
      - run: npm run test:performance
      - run: npm run test:security
```

This comprehensive test plan ensures thorough coverage of all implementation phases with proper testing at each level of the testing pyramid.
