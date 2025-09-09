# Auth Implementation Checklist — Brands & Teams

**Based on:** `auth_implementation_steps.md`  
**Purpose:** Track implementation progress for multi-tenant auth with Brands & Teams  
**Total Items:** 167 tasks across 8 phases  

---

## Phase 1: Database & Schema Setup (Week 1) - 15 items

### 1.1 Create `db-mysql` Package
- [ ] Create directory `packages/db-mysql`
- [ ] Initialize npm package (`npm init -y`)
- [ ] Install dependencies: `drizzle-orm`, `mysql2`, `drizzle-kit`
- [ ] Install dev dependencies: `@types/node`, `typescript`
- [ ] Create `package.json` with proper scripts and exports

### 1.2 Setup Drizzle Schema
- [ ] Create `packages/db-mysql/src/schema.ts`
- [ ] Define `users` table schema
- [ ] Define `organizations` table schema
- [ ] Define `organization_members` table schema
- [ ] Define `org_settings` table schema
- [ ] Define `teams` table schema
- [ ] Define `team_members` table schema
- [ ] Define `brands` table schema
- [ ] Define `team_brand_access` table schema
- [ ] Define `user_brand_access` table schema
- [ ] Define `action_events` table schema with brand_id
- [ ] Add proper indexes for performance
- [ ] Add foreign key constraints
- [ ] Add proper enum types for roles

### 1.3 Setup Drizzle Config
- [ ] Create `packages/db-mysql/drizzle.config.ts`
- [ ] Configure schema path
- [ ] Configure migrations output directory
- [ ] Configure MySQL dialect
- [ ] Configure database credentials from environment

### 1.4 Generate Migrations
- [ ] Run `npx drizzle-kit generate` to create migration files
- [ ] Review generated migration SQL
- [ ] Run `npx drizzle-kit migrate` to apply migrations
- [ ] Verify tables created successfully
- [ ] Test database connection

### 1.5 Create Database Connection
- [ ] Create `packages/db-mysql/src/connection.ts`
- [ ] Setup MySQL connection pool
- [ ] Configure Drizzle ORM with connection
- [ ] Add connection error handling
- [ ] Add connection health check function

---

## Phase 2: Repository Layer (Week 2) - 25 items

### 2.1 Create Base Repository
- [ ] Create `packages/db-mysql/src/repositories/base.ts`
- [ ] Implement `ensureUserInOrg()` method
- [ ] Implement `getUserOrgRole()` method
- [ ] Implement `hasOrgOverride()` method
- [ ] Add proper error handling for database queries
- [ ] Add TypeScript interfaces for return types
- [ ] Add JSDoc documentation for methods

### 2.2 Teams Repository
- [ ] Create `packages/db-mysql/src/repositories/teams.ts`
- [ ] Extend `BaseRepository` class
- [ ] Implement `create()` method with validation
- [ ] Implement `addMember()` method
- [ ] Implement `removeMember()` method
- [ ] Implement `listMembers()` method
- [ ] Implement `listByOrg()` method
- [ ] Add UUID generation for team IDs
- [ ] Add proper error handling for team operations
- [ ] Add validation for team names and descriptions
- [ ] Add role validation for team members

### 2.3 Brands Repository
- [ ] Create `packages/db-mysql/src/repositories/brands.ts`
- [ ] Extend `BaseRepository` class
- [ ] Implement `create()` method with validation
- [ ] Implement `assignTeam()` method with isolation mode check
- [ ] Implement `revokeTeam()` method
- [ ] Implement `grantUser()` method
- [ ] Implement `revokeUser()` method
- [ ] Implement `listByUser()` method with complex permission logic
- [ ] Add isolation mode enforcement logic
- [ ] Add permission precedence logic (org role → user access → team access)
- [ ] Add UUID generation for brand IDs
- [ ] Add validation for brand names and codes
- [ ] Add metadata JSON handling
- [ ] Add proper error handling for brand operations

### 2.4 Org Settings Repository
- [ ] Create `packages/db-mysql/src/repositories/org-settings.ts`
- [ ] Extend `BaseRepository` class
- [ ] Implement `get()` method
- [ ] Implement `update()` method with upsert logic
- [ ] Add validation for brand access modes
- [ ] Add boolean conversion for require_brand_context
- [ ] Add proper error handling

---

## Phase 3: Usage Tracking Package (Week 3) - 12 items

### 3.1 Create Usage Package
- [ ] Create directory `packages/usage`
- [ ] Initialize npm package (`npm init -y`)
- [ ] Install dependencies: `drizzle-orm`, `mysql2`
- [ ] Install dev dependencies: `@types/node`, `typescript`
- [ ] Create `package.json` with proper exports

### 3.2 Usage Client
- [ ] Create `packages/usage/src/client.ts`
- [ ] Define `UsageEvent` interface
- [ ] Implement `UsageClient` class
- [ ] Implement `track()` method with fetch API
- [ ] Add proper error handling for network requests
- [ ] Add API key authentication support
- [ ] Add request timeout handling

### 3.3 Usage Server Helper
- [ ] Create `packages/usage/src/server.ts`
- [ ] Define `TrackUsageParams` interface
- [ ] Implement `trackUsage()` function
- [ ] Add UUID generation for event IDs
- [ ] Add proper error handling for database operations
- [ ] Add idempotency key support

---

## Phase 4: API Routes (Week 4) - 35 items

### 4.1 Authentication API Routes
- [ ] Create `apps/web/src/app/api/auth/session/route.ts`
- [ ] Implement session cookie creation
- [ ] Add Firebase ID token verification
- [ ] Add secure cookie configuration
- [ ] Create `apps/web/src/app/api/bootstrap/route.ts`
- [ ] Implement organization bootstrap
- [ ] Add user upsert functionality
- [ ] Add organization creation
- [ ] Add owner role assignment
- [ ] Add ORG cookie setting
- [ ] Create `apps/web/src/app/api/invites/preview/route.ts`
- [ ] Implement invite preview functionality
- [ ] Add token validation
- [ ] Add organization name retrieval
- [ ] Create `apps/web/src/app/api/invites/accept/route.ts`
- [ ] Implement invite acceptance
- [ ] Add email verification
- [ ] Add team/brand assignments
- [ ] Add invitation cleanup

### 4.2 Brands API Routes
- [ ] Create `apps/web/src/app/api/brands/route.ts`
- [ ] Implement `POST` method for creating brands
- [ ] Add session verification middleware
- [ ] Add organization ID validation
- [ ] Add request body validation
- [ ] Add proper error responses
- [ ] Create `apps/web/src/app/api/brands/[id]/route.ts`
- [ ] Implement `PATCH` method for updating brands
- [ ] Implement `GET` method for fetching brand details
- [ ] Implement `DELETE` method for deleting brands
- [ ] Add brand ID validation
- [ ] Add permission checks for brand operations

### 4.3 Teams API Routes
- [ ] Create `apps/web/src/app/api/teams/route.ts`
- [ ] Implement `POST` method for creating teams
- [ ] Implement `GET` method for listing teams
- [ ] Add session verification middleware
- [ ] Add organization ID validation
- [ ] Add request body validation
- [ ] Add proper error responses

### 4.4 Usage Tracking API
- [ ] Create `apps/web/src/app/api/usage/track/route.ts`
- [ ] Implement `POST` method for tracking usage
- [ ] Add session verification middleware
- [ ] Add organization ID validation
- [ ] Add request body validation
- [ ] Add proper error responses
- [ ] Add idempotency key handling

---

## Phase 5: Frontend Components (Week 5) - 35 items

### 5.1 Authentication Pages
- [ ] Create `apps/web/src/app/(auth)/signup/page.tsx`
- [ ] Implement email-based signup with Firebase
- [ ] Add ASCII art logo display
- [ ] Add gradient background styling
- [ ] Add glass morphism card effects
- [ ] Add loading states and error handling
- [ ] Create `apps/web/src/app/(auth)/signin/page.tsx`
- [ ] Implement email-based signin with Firebase
- [ ] Add consistent styling with signup page
- [ ] Add navigation between signup/signin
- [ ] Create `apps/web/src/app/onboarding/page.tsx`
- [ ] Implement organization creation wizard
- [ ] Add form validation for org name
- [ ] Add progress indication
- [ ] Create `apps/web/src/app/onboarding/brand/page.tsx`
- [ ] Implement brand creation wizard step
- [ ] Add access mode selection (shared/isolated)
- [ ] Add optional brand code input
- [ ] Create `apps/web/src/app/accept-invite/page.tsx`
- [ ] Implement invite acceptance flow
- [ ] Add invite preview functionality
- [ ] Add email verification for invites
- [ ] Add team/brand assignment handling

### 5.2 Brand Management Components
- [ ] Create `apps/web/src/components/brands/BrandList.tsx`
- [ ] Implement brand listing with grid layout
- [ ] Add loading states
- [ ] Add error handling for API calls
- [ ] Add brand card components with metadata display
- [ ] Add "Manage Access" button functionality
- [ ] Add brand code badge display
- [ ] Create `apps/web/src/components/brands/BrandForm.tsx`
- [ ] Implement brand creation form
- [ ] Add form validation
- [ ] Add metadata JSON editor
- [ ] Add primary team selection for isolated mode

### 5.3 Team Management Components
- [ ] Create `apps/web/src/components/teams/TeamList.tsx`
- [ ] Implement team listing with grid layout
- [ ] Add loading states
- [ ] Add error handling for API calls
- [ ] Add team card components with description display
- [ ] Add "Manage Members" button functionality
- [ ] Create `apps/web/src/components/teams/TeamForm.tsx`
- [ ] Implement team creation form
- [ ] Add form validation
- [ ] Add member management interface

### 5.4 Brand Context Provider
- [ ] Create `apps/web/src/components/brands/BrandContext.tsx`
- [ ] Implement `BrandContext` with React Context API
- [ ] Implement `BrandProvider` component
- [ ] Implement `useBrandContext` hook
- [ ] Add selected brand state management
- [ ] Add require brand context configuration
- [ ] Add proper TypeScript types for context
- [ ] Add error boundaries for context usage

---

## Phase 6: Middleware & Context (Week 6) - 15 items

### 6.1 Enhanced Middleware
- [ ] Update `apps/web/middleware.ts`
- [ ] Add session verification logic
- [ ] Implement organization ID extraction from subdomain
- [ ] Add user organization membership check
- [ ] Add brand-scoped route detection
- [ ] Add brand context requirement check
- [ ] Add context headers injection
- [ ] Implement `extractOrgIdFromHostname()` function
- [ ] Implement `checkUserInOrg()` function
- [ ] Implement `isBrandScopedRoute()` function
- [ ] Implement `getRequireBrandContext()` function
- [ ] Add proper error handling and redirects
- [ ] Add middleware configuration for route matching

### 6.2 Usage Tracking Hook
- [ ] Create `apps/web/src/hooks/use-usage-tracking.ts`
- [ ] Implement `useUsageTracking` hook
- [ ] Add brand context integration
- [ ] Add proper error handling for tracking calls
- [ ] Add request debouncing to prevent spam
- [ ] Add offline support with queue mechanism

## Phase 6.5: Global Styles & Fonts (Week 6) - 8 items

### 6.5.1 Font Configuration
- [ ] Update `apps/web/src/app/globals.css`
- [ ] Add Google Fonts imports (Poppins, Inter)
- [ ] Add CSS custom properties for colors
- [ ] Add glass morphism effects
- [ ] Add gradient background utilities
- [ ] Add animation classes
- [ ] Add custom scrollbar styling
- [ ] Update `apps/web/tailwind.config.ts`
- [ ] Add custom font families
- [ ] Add custom color palette
- [ ] Add gradient background configurations
- [ ] Add animation configurations
- [ ] Add backdrop blur utilities
- [ ] Add custom shadow configurations

---

## Phase 7: Testing & Documentation (Week 6) - 22 items

### 7.1 E2E Test Flows
- [ ] Create `apps/web/__tests__/e2e/auth-flows.test.ts`
- [ ] Implement organization creation test
- [ ] Implement team creation test
- [ ] Implement brand creation test
- [ ] Implement team-brand assignment test
- [ ] Implement usage tracking verification test
- [ ] Add test data cleanup
- [ ] Add test isolation
- [ ] Add proper assertions for each step
- [ ] Add error scenario testing

### 7.2 Documentation
- [ ] Create `docs/brands-teams-setup.md`
- [ ] Write overview section explaining concepts
- [ ] Document shared vs isolated mode differences
- [ ] Add setup steps with code examples
- [ ] Add environment variable configuration
- [ ] Add usage tracking integration guide
- [ ] Create API reference documentation
- [ ] Add troubleshooting section
- [ ] Add migration guide for existing users
- [ ] Add performance considerations
- [ ] Add security best practices
- [ ] Add deployment checklist

---

## Implementation Checklist Summary

### Phase 1: Database & Schema Setup
**Progress:** 0/15 items completed
**Priority:** Critical - Foundation for all other phases

### Phase 2: Repository Layer  
**Progress:** 0/25 items completed
**Priority:** Critical - Business logic implementation

### Phase 3: Usage Tracking Package
**Progress:** 0/12 items completed
**Priority:** High - Core functionality for billing/analytics

### Phase 4: API Routes
**Progress:** 0/35 items completed
**Priority:** High - Backend API endpoints

### Phase 5: Frontend Components
**Progress:** 0/35 items completed
**Priority:** Medium - User interface implementation

### Phase 6: Middleware & Context
**Progress:** 0/15 items completed
**Priority:** Medium - Integration and routing

### Phase 6.5: Global Styles & Fonts
**Progress:** 0/8 items completed
**Priority:** Medium - Visual design and branding

### Phase 7: Testing & Documentation
**Progress:** 0/22 items completed
**Priority:** Medium - Quality assurance and user guidance

---

## Dependencies Between Phases

### Critical Path Dependencies:
- Phase 2 depends on Phase 1 (database schema)
- Phase 4 depends on Phase 2 (repositories)
- Phase 5 depends on Phase 4 (API routes)
- Phase 6 depends on Phase 5 (frontend components)
- Phase 7 depends on all previous phases

### Parallel Development Opportunities:
- Phase 3 (Usage) can be developed in parallel with Phase 2
- Phase 5 (Frontend) can start after Phase 4 is partially complete
- Phase 7 (Testing) can begin unit tests during Phase 2

---

## Risk Mitigation

### High-Risk Items:
- Complex permission logic in BrandsRepo (Phase 2.3)
- Subdomain routing in middleware (Phase 6.1)
- E2E test setup and maintenance (Phase 7.1)

### Mitigation Strategies:
- Extensive unit testing for permission logic
- Fallback routing mechanisms for subdomain extraction
- Automated test generation and maintenance scripts

---

## Success Criteria

### Phase Completion Criteria:
- All checklist items marked as complete
- Unit tests passing with >90% coverage
- Integration tests passing
- Code review completed
- Documentation updated

### Overall Project Success:
- All 127 checklist items completed
- E2E tests passing in CI/CD pipeline
- Performance benchmarks met
- Security audit passed
- User acceptance testing completed
