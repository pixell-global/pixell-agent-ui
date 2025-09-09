# Auth Implementation Steps — Brands & Teams

**Based on:** `auth_refactor_prd.md`  
**Target:** Implement multi-tenant auth with Brands & Teams using Drizzle ORM + MySQL  
**Timeline:** 4-6 weeks  

---
THERE SHOULD BE NO HARD DELETSE IN DATABSAE. create is_deleted flags whenever delete is needed, and mark it true if anything is deleted. add created_dt and updated_dt that shows datetime when a row is created or updated. this should be added whenever it is needed.

## Phase 1: Database & Schema Setup (Week 1)

### 1.1 Create `db-mysql` Package
```bash
mkdir packages/db-mysql
cd packages/db-mysql
npm init -y
npm install drizzle-orm mysql2 drizzle-kit
npm install -D @types/node typescript
```

### 1.2 Setup Drizzle Schema
Create `packages/db-mysql/src/schema.ts`:
```typescript
import { mysqlTable, varchar, char, text, json, timestamp, mysqlEnum, index, primaryKey, bigint, int } from "drizzle-orm/mysql-core"

// Existing tables (if not already present)
export const users = mysqlTable("users", {
  id: varchar("id", { length: 128 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  displayName: varchar("display_name", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(), // 0=false, 1=true
})

export const organizations = mysqlTable("organizations", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  createdBy: varchar("created_by", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
})

export const organizationMembers = mysqlTable("organization_members", {
  orgId: char("org_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  role: mysqlEnum("role", ["owner","admin","member","viewer"]).default("owner").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.orgId, t.userId] }) }))

// New tables for Brands & Teams
export const orgSettings = mysqlTable("org_settings", {
  orgId: char("org_id", { length: 36 }).primaryKey(),
  brandAccessMode: mysqlEnum("brand_access_mode", ["shared","isolated"]).default("shared").notNull(),
  requireBrandContext: int("require_brand_context").default(1).notNull(), // 1=true, 0=false
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
})

export const teams = mysqlTable("teams", {
  id: char("id", { length: 36 }).primaryKey(),
  orgId: char("org_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
})

export const teamMembers = mysqlTable("team_members", {
  teamId: char("team_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  role: mysqlEnum("role", ["lead","member","viewer"]).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.teamId, t.userId] }) }))

export const brands = mysqlTable("brands", {
  id: char("id", { length: 36 }).primaryKey(),
  orgId: char("org_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 64 }).unique(),
  primaryTeamId: char("primary_team_id", { length: 36 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
})

export const teamBrandAccess = mysqlTable("team_brand_access", {
  teamId: char("team_id", { length: 36 }).notNull(),
  brandId: char("brand_id", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["manager","editor","analyst","viewer"]).default("viewer").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.teamId, t.brandId] }) }))

export const userBrandAccess = mysqlTable("user_brand_access", {
  brandId: char("brand_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  role: mysqlEnum("role", ["manager","editor","analyst","viewer"]).default("viewer").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.brandId, t.userId] }) }))

// Invitations table
export const orgInvitations = mysqlTable("org_invitations", {
  id: char("id", { length: 36 }).primaryKey(),
  orgId: char("org_id", { length: 36 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin","member","viewer"]).default("member").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  metadata: json("metadata"), // For team/brand assignments
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  isDeleted: int("is_deleted").default(0).notNull(),
})

// Extended action_events table
export const actionEvents = mysqlTable("action_events", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  orgId: char("org_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  appId: varchar("app_id", { length: 80 }),
  actionKey: varchar("action_key", { length: 120 }).notNull(),
  units: int("units").default(1).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 120 }),
  metadata: json("metadata"),
  brandId: char("brand_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxOrgCreated: index("idx_usage_org_created").on(t.orgId, t.createdAt),
  idxBrandCreated: index("idx_usage_brand_created").on(t.brandId, t.createdAt),
}))
```

### 1.3 Setup Drizzle Config
Create `packages/db-mysql/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pixell_auth',
  },
})
```

### 1.4 Generate Migrations
```bash
cd packages/db-mysql
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 1.5 Create Database Connection
Create `packages/db-mysql/src/connection.ts`:
```typescript
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

export const db = drizzle(connection)
```

---

## Phase 2: Repository Layer (Week 2)

### 2.1 Create Base Repository
Create `packages/db-mysql/src/repositories/base.ts`:
```typescript
import { db } from '../connection'
import { eq, and } from 'drizzle-orm'
import { organizationMembers } from '../schema'

export abstract class BaseRepository {
  protected async ensureUserInOrg(userId: string, orgId: string): Promise<boolean> {
    const member = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgId, orgId)
      ))
      .limit(1)
    
    return member.length > 0
  }

  protected async getUserOrgRole(userId: string, orgId: string): Promise<string | null> {
    const member = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgId, orgId)
      ))
      .limit(1)
    
    return member[0]?.role || null
  }

  protected hasOrgOverride(role: string): boolean {
    return ['owner', 'admin'].includes(role)
  }
}
```

### 2.2 Teams Repository
Create `packages/db-mysql/src/repositories/teams.ts`:
```typescript
import { db } from '../connection'
import { teams, teamMembers, eq, and } from '../schema'
import { BaseRepository } from './base'
import { randomUUID } from 'crypto'

export class TeamsRepo extends BaseRepository {
  async create(orgId: string, name: string, description?: string, userId?: string) {
    if (userId && !(await this.ensureUserInOrg(userId, orgId))) {
      throw new Error('User not in organization')
    }

    const teamId = randomUUID()
    await db.insert(teams).values({
      id: teamId,
      orgId,
      name,
      description,
    })

    return { id: teamId, orgId, name, description }
  }

  async addMember(teamId: string, userId: string, role: 'lead' | 'member' | 'viewer' = 'member') {
    await db.insert(teamMembers).values({
      teamId,
      userId,
      role,
    })
  }

  async removeMember(teamId: string, userId: string) {
    await db
      .delete(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ))
  }

  async listMembers(teamId: string) {
    return db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
  }

  async listByOrg(orgId: string) {
    return db
      .select()
      .from(teams)
      .where(eq(teams.orgId, orgId))
  }
}
```

### 2.3 Brands Repository
Create `packages/db-mysql/src/repositories/brands.ts`:
```typescript
import { db } from '../connection'
import { brands, teamBrandAccess, userBrandAccess, orgSettings, eq, and, or } from '../schema'
import { BaseRepository } from './base'
import { randomUUID } from 'crypto'

export class BrandsRepo extends BaseRepository {
  async create(
    orgId: string, 
    name: string, 
    code?: string, 
    primaryTeamId?: string, 
    metadata?: any,
    userId?: string
  ) {
    if (userId && !(await this.ensureUserInOrg(userId, orgId))) {
      throw new Error('User not in organization')
    }

    const brandId = randomUUID()
    await db.insert(brands).values({
      id: brandId,
      orgId,
      name,
      code,
      primaryTeamId,
      metadata,
    })

    return { id: brandId, orgId, name, code, primaryTeamId, metadata }
  }

  async assignTeam(brandId: string, teamId: string, role: 'manager' | 'editor' | 'analyst' | 'viewer' = 'viewer') {
    // Check if org is in isolated mode
    const brand = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1)
    if (brand.length === 0) throw new Error('Brand not found')

    const settings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, brand[0].orgId)).limit(1)
    
    if (settings.length > 0 && settings[0].brandAccessMode === 'isolated') {
      if (brand[0].primaryTeamId !== teamId) {
        throw new Error('In isolated mode, only primary team can access brand')
      }
    }

    await db.insert(teamBrandAccess).values({
      teamId,
      brandId,
      role,
    })
  }

  async revokeTeam(brandId: string, teamId: string) {
    await db
      .delete(teamBrandAccess)
      .where(and(
        eq(teamBrandAccess.brandId, brandId),
        eq(teamBrandAccess.teamId, teamId)
      ))
  }

  async grantUser(brandId: string, userId: string, role: 'manager' | 'editor' | 'analyst' | 'viewer' = 'viewer') {
    await db.insert(userBrandAccess).values({
      brandId,
      userId,
      role,
    })
  }

  async revokeUser(brandId: string, userId: string) {
    await db
      .delete(userBrandAccess)
      .where(and(
        eq(userBrandAccess.brandId, brandId),
        eq(userBrandAccess.userId, userId)
      ))
  }

  async listByUser(orgId: string, userId: string) {
    // Get user's org role
    const orgRole = await this.getUserOrgRole(userId, orgId)
    if (!orgRole) throw new Error('User not in organization')

    // Org owners/admins can see all brands
    if (this.hasOrgOverride(orgRole)) {
      return db.select().from(brands).where(eq(brands.orgId, orgId))
    }

    // For regular users, check team membership and direct access
    const userBrands = await db
      .selectDistinct({ brand: brands })
      .from(brands)
      .innerJoin(teamBrandAccess, eq(brands.id, teamBrandAccess.brandId))
      .innerJoin(teamMembers, eq(teamBrandAccess.teamId, teamMembers.teamId))
      .where(and(
        eq(brands.orgId, orgId),
        eq(teamMembers.userId, userId)
      ))

    const directAccess = await db
      .select({ brand: brands })
      .from(brands)
      .innerJoin(userBrandAccess, eq(brands.id, userBrandAccess.brandId))
      .where(and(
        eq(brands.orgId, orgId),
        eq(userBrandAccess.userId, userId)
      ))

    return [...userBrands, ...directAccess].map(item => item.brand)
  }
}
```

### 2.4 Org Settings Repository
Create `packages/db-mysql/src/repositories/org-settings.ts`:
```typescript
import { db } from '../connection'
import { orgSettings, eq } from '../schema'
import { BaseRepository } from './base'

export class OrgSettingsRepo extends BaseRepository {
  async get(orgId: string) {
    const settings = await db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1)
    
    return settings[0] || null
  }

  async update(orgId: string, updates: { brandAccessMode?: 'shared' | 'isolated', requireBrandContext?: boolean }) {
    const existing = await this.get(orgId)
    
    if (existing) {
      await db
        .update(orgSettings)
        .set(updates)
        .where(eq(orgSettings.orgId, orgId))
    } else {
      await db.insert(orgSettings).values({
        orgId,
        brandAccessMode: updates.brandAccessMode || 'shared',
        requireBrandContext: updates.requireBrandContext ? 1 : 0,
      })
    }
  }
}
```

---

## Phase 3: Usage Tracking Package (Week 3)

### 3.1 Create Usage Package
```bash
mkdir packages/usage
cd packages/usage
npm init -y
npm install drizzle-orm mysql2
npm install -D @types/node typescript
```

### 3.2 Usage Client
Create `packages/usage/src/client.ts`:
```typescript
export interface UsageEvent {
  actionKey: string
  units?: number
  metadata?: Record<string, any>
  idempotencyKey?: string
  brandId?: string
}

export class UsageClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  async track(event: UsageEvent): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/usage/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      throw new Error(`Usage tracking failed: ${response.statusText}`)
    }
  }
}
```

### 3.3 Usage Server Helper
Create `packages/usage/src/server.ts`:
```typescript
import { db } from '@pixell/db-mysql'
import { actionEvents } from '@pixell/db-mysql/schema'
import { randomUUID } from 'crypto'

export interface TrackUsageParams {
  orgId: string
  userId: string
  actionKey: string
  units?: number
  metadata?: Record<string, any>
  idempotencyKey?: string
  brandId?: string
  appId?: string
}

export async function trackUsage(params: TrackUsageParams): Promise<void> {
  const eventId = randomUUID()
  
  await db.insert(actionEvents).values({
    orgId: params.orgId,
    userId: params.userId,
    actionKey: params.actionKey,
    units: params.units || 1,
    metadata: params.metadata,
    idempotencyKey: params.idempotencyKey,
    brandId: params.brandId,
    appId: params.appId,
  })
}
```

---

## Phase 4: API Routes (Week 4)

### 4.1 Brands API Routes
Create `apps/web/src/app/api/brands/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { BrandsRepo } from '@pixell/db-mysql/repositories/brands'
import { getSession } from '@pixell/auth-firebase/server'

const brandsRepo = new BrandsRepo()

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, code, primaryTeamId, metadata } = await request.json()
    const orgId = request.headers.get('x-org-id')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    const brand = await brandsRepo.create(orgId, name, code, primaryTeamId, metadata, session.uid)
    
    return NextResponse.json(brand)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Create `apps/web/src/app/api/brands/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { BrandsRepo } from '@pixell/db-mysql/repositories/brands'
import { getSession } from '@pixell/auth-firebase/server'

const brandsRepo = new BrandsRepo()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    // Implementation for updating brand fields
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### 4.2 Teams API Routes
Create `apps/web/src/app/api/teams/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { TeamsRepo } from '@pixell/db-mysql/repositories/teams'
import { getSession } from '@pixell/auth-firebase/server'

const teamsRepo = new TeamsRepo()

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description } = await request.json()
    const orgId = request.headers.get('x-org-id')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    const team = await teamsRepo.create(orgId, name, description, session.uid)
    
    return NextResponse.json(team)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### 4.3 Authentication API Routes

#### 4.3.1 Session Management
Create `apps/web/src/app/api/auth/session/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { signInWithEmailLink, getAuth } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { createSessionCookie } from '@pixell/auth-firebase/server'

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()
    
    if (!idToken) {
      return NextResponse.json({ error: 'ID token required' }, { status: 400 })
    }

    // Verify the ID token and create session cookie
    const sessionCookie = await createSessionCookie(idToken)
    
    const response = NextResponse.json({ success: true })
    response.cookies.set('SESSION', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 5, // 5 days
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 4.3.2 Bootstrap Organization
Create `apps/web/src/app/api/bootstrap/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@pixell/auth-firebase/server'
import { db } from '@pixell/db-mysql'
import { users, organizations, organizationMembers } from '@pixell/db-mysql/schema'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgName } = await request.json()
    
    if (!orgName) {
      return NextResponse.json({ error: 'Organization name required' }, { status: 400 })
    }

    const orgId = randomUUID()

    // Upsert user
    await db.insert(users).values({
      id: session.uid,
      email: session.email!,
      displayName: session.displayName || null,
    }).onDuplicateKeyUpdate({
      set: {
        email: session.email!,
        displayName: session.displayName || null,
        updatedAt: new Date(),
      }
    })

    // Create organization
    await db.insert(organizations).values({
      id: orgId,
      name: orgName,
      createdBy: session.uid,
    })

    // Add user as owner
    await db.insert(organizationMembers).values({
      orgId,
      userId: session.uid,
      role: 'owner',
    })

    const response = NextResponse.json({ orgId })
    response.cookies.set('ORG', orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 4.3.3 Invite Preview
Create `apps/web/src/app/api/invites/preview/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@pixell/db-mysql'
import { orgInvitations, organizations } from '@pixell/db-mysql/schema'
import { eq, and, gt } from 'drizzle-orm'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Hash the token for comparison
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // Find invitation
    const invitation = await db
      .select({
        id: orgInvitations.id,
        orgId: orgInvitations.orgId,
        email: orgInvitations.email,
        role: orgInvitations.role,
        expiresAt: orgInvitations.expiresAt,
        metadata: orgInvitations.metadata,
      })
      .from(orgInvitations)
      .where(and(
        eq(orgInvitations.tokenHash, tokenHash),
        eq(orgInvitations.isDeleted, 0),
        gt(orgInvitations.expiresAt, new Date())
      ))
      .limit(1)

    if (invitation.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    }

    // Get organization name
    const org = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, invitation[0].orgId))
      .limit(1)

    return NextResponse.json({
      orgName: org[0].name,
      role: invitation[0].role,
      metadata: invitation[0].metadata,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 4.3.4 Accept Invite
Create `apps/web/src/app/api/invites/accept/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@pixell/auth-firebase/server'
import { db } from '@pixell/db-mysql'
import { orgInvitations, organizationMembers, users, teamMembers, userBrandAccess } from '@pixell/db-mysql/schema'
import { eq, and, gt } from 'drizzle-orm'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = await request.json()
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Hash the token for comparison
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // Find and validate invitation
    const invitation = await db
      .select()
      .from(orgInvitations)
      .where(and(
        eq(orgInvitations.tokenHash, tokenHash),
        eq(orgInvitations.isDeleted, 0),
        gt(orgInvitations.expiresAt, new Date())
      ))
      .limit(1)

    if (invitation.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    }

    // Check email match
    if (invitation[0].email !== session.email) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 })
    }

    // Upsert user
    await db.insert(users).values({
      id: session.uid,
      email: session.email!,
      displayName: session.displayName || null,
    }).onDuplicateKeyUpdate({
      set: {
        email: session.email!,
        displayName: session.displayName || null,
        updatedAt: new Date(),
      }
    })

    // Add user to organization
    await db.insert(organizationMembers).values({
      orgId: invitation[0].orgId,
      userId: session.uid,
      role: invitation[0].role,
    }).onDuplicateKeyUpdate({
      set: {
        role: invitation[0].role,
        updatedAt: new Date(),
      }
    })

    // Apply team assignments if any
    if (invitation[0].metadata?.teams) {
      for (const team of invitation[0].metadata.teams) {
        await db.insert(teamMembers).values({
          teamId: team.teamId,
          userId: session.uid,
          role: team.role,
        }).onDuplicateKeyUpdate({
          set: {
            role: team.role,
            updatedAt: new Date(),
          }
        })
      }
    }

    // Apply brand assignments if any
    if (invitation[0].metadata?.brands) {
      for (const brand of invitation[0].metadata.brands) {
        await db.insert(userBrandAccess).values({
          brandId: brand.brandId,
          userId: session.uid,
          role: brand.role,
        }).onDuplicateKeyUpdate({
          set: {
            role: brand.role,
            updatedAt: new Date(),
          }
        })
      }
    }

    // Mark invitation as used
    await db
      .update(orgInvitations)
      .set({ isDeleted: 1, updatedAt: new Date() })
      .where(eq(orgInvitations.id, invitation[0].id))

    const response = NextResponse.json({ orgId: invitation[0].orgId })
    response.cookies.set('ORG', invitation[0].orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### 4.4 Usage Tracking API
Create `apps/web/src/app/api/usage/track/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { trackUsage } from '@pixell/usage/server'
import { getSession } from '@pixell/auth-firebase/server'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { actionKey, units, metadata, idempotencyKey, brandId } = await request.json()
    const orgId = request.headers.get('x-org-id')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    await trackUsage({
      orgId,
      userId: session.uid,
      actionKey,
      units,
      metadata,
      idempotencyKey,
      brandId,
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## Phase 5: Frontend Components (Week 5)

### 5.1 Authentication Pages

#### 5.1.1 Sign Up Page
Create `apps/web/src/app/(auth)/signup/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/signup/verify`,
        handleCodeInApp: true,
      }

      await sendSignInLinkToEmail(auth, email, actionCodeSettings)
      
      // Store email for verification
      localStorage.setItem('lastEmail', email)
      
      setMessage('Check your email for a sign-in link!')
    } catch (error) {
      setMessage('Error sending sign-in link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="mb-6">
              <pre className="text-xs text-gray-600 font-mono">
{`  ___  _  _  ___  ___  ___  _  _ 
 |_ _|| \\| || __|| __|| __|| || |
  | | | .\` || _| | _| | _| | __ |
 |___||_|\\_||___||___||___||_||_|`}
              </pre>
            </div>
            <CardTitle className="text-2xl font-poppins font-bold text-gray-900">
              Get Started
            </CardTitle>
            <p className="text-gray-600 font-inter">
              Enter your email to get a sign-in link.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-6">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-lg font-inter"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-lime-400 hover:bg-lime-500 text-gray-900 font-semibold font-inter text-lg transition-all duration-200"
              >
                {loading ? 'Sending...' : 'Send Sign-in Link'}
              </Button>
              {message && (
                <p className="text-center text-sm font-inter">
                  {message}
                </p>
              )}
            </form>
            <div className="mt-8 text-center">
              <p className="text-gray-600 font-inter">
                Already have an account?{' '}
                <a href="/signin" className="text-lime-600 hover:text-lime-700 font-semibold">
                  Sign in
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

#### 5.1.2 Sign In Page
Create `apps/web/src/app/(auth)/signin/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/signin/verify`,
        handleCodeInApp: true,
      }

      await sendSignInLinkToEmail(auth, email, actionCodeSettings)
      
      localStorage.setItem('lastEmail', email)
      setMessage('Check your email for a sign-in link!')
    } catch (error) {
      setMessage('Error sending sign-in link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="mb-6">
              <pre className="text-xs text-gray-600 font-mono">
{`  ___  _  _  ___  ___  ___  _  _ 
 |_ _|| \\| || __|| __|| __|| || |
  | | | .\` || _| | _| | _| | __ |
 |___||_|\\_||___||___||___||_||_|`}
              </pre>
            </div>
            <CardTitle className="text-2xl font-poppins font-bold text-gray-900">
              Welcome Back
            </CardTitle>
            <p className="text-gray-600 font-inter">
              Enter your email to sign in.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-6">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-lg font-inter"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-lime-400 hover:bg-lime-500 text-gray-900 font-semibold font-inter text-lg transition-all duration-200"
              >
                {loading ? 'Sending...' : 'Send Sign-in Link'}
              </Button>
              {message && (
                <p className="text-center text-sm font-inter">
                  {message}
                </p>
              )}
            </form>
            <div className="mt-8 text-center">
              <p className="text-gray-600 font-inter">
                Don't have an account?{' '}
                <a href="/signup" className="text-lime-600 hover:text-lime-700 font-semibold">
                  Sign up
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

#### 5.1.3 Onboarding Wizard - Organization
Create `apps/web/src/app/onboarding/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName })
      })

      if (response.ok) {
        const { orgId } = await response.json()
        router.push(`/onboarding/brand?orgId=${orgId}`)
      }
    } catch (error) {
      console.error('Error creating organization:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="mb-6">
              <pre className="text-xs text-gray-600 font-mono">
{`  ___  _  _  ___  ___  ___  _  _ 
 |_ _|| \\| || __|| __|| __|| || |
  | | | .\` || _| | _| | _| | __ |
 |___||_|\\_||___||___||___||_||_|`}
              </pre>
            </div>
            <CardTitle className="text-2xl font-poppins font-bold text-gray-900">
              Create Your Organization
            </CardTitle>
            <p className="text-gray-600 font-inter">
              Let's get started by setting up your organization.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-6">
              <div>
                <Input
                  type="text"
                  placeholder="Organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="h-12 text-lg font-inter"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-lime-400 hover:bg-lime-500 text-gray-900 font-semibold font-inter text-lg transition-all duration-200"
              >
                {loading ? 'Creating...' : 'Create Organization'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

#### 5.1.4 Onboarding Wizard - Brand
Create `apps/web/src/app/onboarding/brand/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function OnboardingBrandPage() {
  const [brandName, setBrandName] = useState('')
  const [brandCode, setBrandCode] = useState('')
  const [accessMode, setAccessMode] = useState('shared')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/brands', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-org-id': orgId!
        },
        body: JSON.stringify({ 
          name: brandName, 
          code: brandCode,
          metadata: { accessMode }
        })
      })

      if (response.ok) {
        const { brandId } = await response.json()
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error creating brand:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="mb-6">
              <pre className="text-xs text-gray-600 font-mono">
{`  ___  _  _  ___  ___  ___  _  _ 
 |_ _|| \\| || __|| __|| __|| || |
  | | | .\` || _| | _| | _| | __ |
 |___||_|\\_||___||___||___||_||_|`}
              </pre>
            </div>
            <CardTitle className="text-2xl font-poppins font-bold text-gray-900">
              Create Your First Brand
            </CardTitle>
            <p className="text-gray-600 font-inter">
              You can add more brands later.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBrand} className="space-y-6">
              <div>
                <Input
                  type="text"
                  placeholder="Brand name"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="h-12 text-lg font-inter"
                  required
                />
              </div>
              <div>
                <Input
                  type="text"
                  placeholder="Brand code (optional)"
                  value={brandCode}
                  onChange={(e) => setBrandCode(e.target.value)}
                  className="h-12 text-lg font-inter"
                />
              </div>
              <div>
                <Select value={accessMode} onValueChange={setAccessMode}>
                  <SelectTrigger className="h-12 text-lg font-inter">
                    <SelectValue placeholder="Select access mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Shared (multiple teams per brand)</SelectItem>
                    <SelectItem value="isolated">Isolated (one team per brand)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-lime-400 hover:bg-lime-500 text-gray-900 font-semibold font-inter text-lg transition-all duration-200"
              >
                {loading ? 'Creating...' : 'Create Brand'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

#### 5.1.5 Invite Acceptance Page
Create `apps/web/src/app/accept-invite/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InvitePreview {
  orgName: string
  role: string
  metadata?: {
    teams?: Array<{ teamId: string; role: string }>
    brands?: Array<{ brandId: string; role: string }>
  }
}

export default function AcceptInvitePage() {
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (token) {
      fetchInvitePreview()
    }
  }, [token])

  const fetchInvitePreview = async () => {
    try {
      const response = await fetch('/api/invites/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      if (response.ok) {
        const data = await response.json()
        setInvite(data)
      }
    } catch (error) {
      console.error('Error fetching invite:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvite = async () => {
    setAccepting(true)

    try {
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      if (response.ok) {
        const { orgId } = await response.json()
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error accepting invite:', error)
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center">
        <div className="text-white font-inter">Loading invite...</div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center p-4">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl">
          <CardContent className="text-center py-8">
            <p className="text-gray-600 font-inter">Invalid or expired invite.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-yellow-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-sm bg-white/90 border-0 shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="mb-6">
              <pre className="text-xs text-gray-600 font-mono">
{`  ___  _  _  ___  ___  ___  _  _ 
 |_ _|| \\| || __|| __|| __|| || |
  | | | .\` || _| | _| | _| | __ |
 |___||_|\\_||___||___||___||_||_|`}
              </pre>
            </div>
            <CardTitle className="text-2xl font-poppins font-bold text-gray-900">
              You've Been Invited!
            </CardTitle>
            <p className="text-gray-600 font-inter">
              You've been invited to <strong>{invite.orgName}</strong> as <strong>{invite.role}</strong>.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleAcceptInvite}
              disabled={accepting}
              className="w-full h-12 bg-lime-400 hover:bg-lime-500 text-gray-900 font-semibold font-inter text-lg transition-all duration-200"
            >
              {accepting ? 'Accepting...' : 'Accept Invite'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### 5.2 Brand Management Components
Create `apps/web/src/components/brands/BrandList.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Brand {
  id: string
  name: string
  code?: string
  metadata?: any
}

export function BrandList({ orgId }: { orgId: string }) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrands()
  }, [orgId])

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands', {
        headers: { 'x-org-id': orgId }
      })
      const data = await response.json()
      setBrands(data)
    } catch (error) {
      console.error('Failed to fetch brands:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading brands...</div>

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {brands.map((brand) => (
        <Card key={brand.id} className="backdrop-blur-sm bg-white/90 border-0 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between font-poppins">
              {brand.name}
              {brand.code && <Badge variant="secondary" className="bg-lime-100 text-lime-800">{brand.code}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="font-inter">
              Manage Access
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### 5.2 Team Management Components
Create `apps/web/src/components/teams/TeamList.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Team {
  id: string
  name: string
  description?: string
}

export function TeamList({ orgId }: { orgId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeams()
  }, [orgId])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams', {
        headers: { 'x-org-id': orgId }
      })
      const data = await response.json()
      setTeams(data)
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading teams...</div>

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <Card key={team.id}>
          <CardHeader>
            <CardTitle>{team.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {team.description && <p className="text-sm text-gray-600 mb-4">{team.description}</p>}
            <Button variant="outline" size="sm">
              Manage Members
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### 5.3 Brand Context Provider
Create `apps/web/src/components/brands/BrandContext.tsx`:
```typescript
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface Brand {
  id: string
  name: string
  code?: string
}

interface BrandContextType {
  selectedBrand: Brand | null
  setSelectedBrand: (brand: Brand | null) => void
  requireBrandContext: boolean
}

const BrandContext = createContext<BrandContextType | undefined>(undefined)

export function BrandProvider({ 
  children, 
  requireBrandContext = true 
}: { 
  children: ReactNode
  requireBrandContext?: boolean 
}) {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)

  return (
    <BrandContext.Provider value={{ 
      selectedBrand, 
      setSelectedBrand, 
      requireBrandContext 
    }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrandContext() {
  const context = useContext(BrandContext)
  if (context === undefined) {
    throw new Error('useBrandContext must be used within a BrandProvider')
  }
  return context
}
```

---

## Phase 6: Middleware & Context (Week 6)

### 6.1 Enhanced Middleware
Update `apps/web/middleware.ts`:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from '@pixell/auth-firebase/server'

export async function middleware(request: NextRequest) {
  // Verify session
  const session = await verifySession(request)
  if (!session) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // Extract org ID from subdomain or header
  const hostname = request.headers.get('host') || ''
  const orgId = extractOrgIdFromHostname(hostname) || request.headers.get('x-org-id')
  
  if (!orgId) {
    return NextResponse.redirect(new URL('/organizations', request.url))
  }

  // Check if user belongs to org
  const isMember = await checkUserInOrg(session.uid, orgId)
  if (!isMember) {
    return NextResponse.redirect(new URL('/organizations', request.url))
  }

  // For brand-scoped routes, check brand context
  if (isBrandScopedRoute(request.nextUrl.pathname)) {
    const requireBrandContext = await getRequireBrandContext(orgId)
    if (requireBrandContext) {
      const brandId = request.headers.get('x-brand-id')
      if (!brandId) {
        return NextResponse.redirect(new URL('/brands', request.url))
      }
    }
  }

  // Add context headers
  const response = NextResponse.next()
  response.headers.set('x-org-id', orgId)
  response.headers.set('x-user-id', session.uid)

  return response
}

function extractOrgIdFromHostname(hostname: string): string | null {
  // Implementation: extract org ID from subdomain
  const subdomain = hostname.split('.')[0]
  // Validate and return org ID
  return null
}

async function checkUserInOrg(userId: string, orgId: string): Promise<boolean> {
  // Implementation: check if user is member of org
  return true
}

function isBrandScopedRoute(pathname: string): boolean {
  return pathname.startsWith('/api/usage') || pathname.startsWith('/api/agents')
}

async function getRequireBrandContext(orgId: string): Promise<boolean> {
  // Implementation: get org settings
  return true
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|signin|signup).*)',
  ],
}
```

### 6.2 Usage Tracking Hook
Create `apps/web/src/hooks/use-usage-tracking.ts`:
```typescript
import { useCallback } from 'react'
import { useBrandContext } from '@/components/brands/BrandContext'

export function useUsageTracking() {
  const { selectedBrand } = useBrandContext()

  const track = useCallback(async (
    actionKey: string,
    units?: number,
    metadata?: Record<string, any>,
    idempotencyKey?: string
  ) => {
    try {
      await fetch('/api/usage/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-brand-id': selectedBrand?.id || '',
        },
        body: JSON.stringify({
          actionKey,
          units,
          metadata,
          idempotencyKey,
          brandId: selectedBrand?.id,
        }),
      })
    } catch (error) {
      console.error('Usage tracking failed:', error)
    }
  }, [selectedBrand])

  return { track }
}
```

---

## Phase 6.5: Global Styles & Fonts

### 6.5.1 Font Configuration
Update `apps/web/src/app/globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary-text: #1E1E1E;
  --accent-lime: #EEFC7C;
  --gradient-red: #FF6B6B;
  --gradient-pink: #FF8E8E;
  --gradient-yellow: #FFD93D;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

/* Custom gradient backgrounds */
.gradient-hero {
  background: linear-gradient(135deg, var(--gradient-red) 0%, var(--gradient-pink) 50%, var(--gradient-yellow) 100%);
}

.gradient-section {
  background: linear-gradient(90deg, var(--gradient-red) 0%, var(--gradient-pink) 100%);
}

/* Glass morphism effects */
.glass-card {
  backdrop-filter: blur(16px);
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-card-dark {
  backdrop-filter: blur(16px);
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Custom button styles */
.btn-lime {
  background: var(--accent-lime);
  color: var(--primary-text);
  transition: all 0.2s ease-in-out;
}

.btn-lime:hover {
  background: #E6F270;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(238, 252, 124, 0.3);
}

/* ASCII art styling */
.ascii-art {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.2;
  color: #6B7280;
  white-space: pre;
}

/* Animation classes */
.fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive design utilities */
.container-responsive {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
}

.section-spacing {
  @apply py-16 sm:py-24;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: var(--accent-lime);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #E6F270;
}
```

### 6.5.2 Tailwind Configuration
Update `apps/web/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          text: '#1E1E1E',
        },
        accent: {
          lime: '#EEFC7C',
        },
        gradient: {
          red: '#FF6B6B',
          pink: '#FF8E8E',
          yellow: '#FFD93D',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-hero': 'linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 50%, #FFD93D 100%)',
        'gradient-section': 'linear-gradient(90deg, #FF6B6B 0%, #FF8E8E 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-slow': 'bounce 2s infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## Phase 7: Testing & Documentation

### 7.1 E2E Test Flows
Create `apps/web/__tests__/e2e/auth-flows.test.ts`:
```typescript
import { test, expect } from '@playwright/test'

test.describe('Auth Flows with Brands & Teams', () => {
  test('complete flow: org → team → brand → access → usage', async ({ page }) => {
    // 1. Create organization
    await page.goto('/organizations/create')
    await page.fill('[name="name"]', 'Test Org')
    await page.click('button[type="submit"]')
    
    // 2. Create team
    await page.goto('/teams/create')
    await page.fill('[name="name"]', 'Marketing Team')
    await page.click('button[type="submit"]')
    
    // 3. Create brand
    await page.goto('/brands/create')
    await page.fill('[name="name"]', 'Test Brand')
    await page.fill('[name="code"]', 'TEST')
    await page.click('button[type="submit"]')
    
    // 4. Assign team to brand
    await page.goto('/brands/[id]/access')
    await page.selectOption('[name="teamId"]', 'Marketing Team')
    await page.selectOption('[name="role"]', 'editor')
    await page.click('button[type="submit"]')
    
    // 5. Verify usage tracking
    await page.goto('/dashboard')
    await page.click('[data-testid="agent-action"]')
    
    // Check that usage was tracked with brand ID
    const usageRequest = await page.waitForRequest('/api/usage/track')
    expect(usageRequest.postDataJSON()).toHaveProperty('brandId')
  })
})
```

### 7.2 Documentation
Create `docs/brands-teams-setup.md`:
```markdown
# Brands & Teams Setup Guide

## Overview
This guide explains how to set up multi-tenant authentication with Brands and Teams.

## Shared vs Isolated Mode

### Shared Mode
- Multiple teams can work on the same brand
- Flexible access control through team assignments
- Suitable for collaborative environments

### Isolated Mode
- Each brand has a single primary team
- Strict separation between brands
- Suitable for client-based organizations

## Setup Steps

1. **Database Migration**
   ```bash
   cd packages/db-mysql
   npx drizzle-kit migrate
   ```

2. **Environment Variables**
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=password
   DB_NAME=pixell_auth
   ```

3. **Usage Tracking**
   ```typescript
   import { useUsageTracking } from '@/hooks/use-usage-tracking'
   
   const { track } = useUsageTracking()
   
   // Track usage with brand context
   await track('agent_action', 1, { feature: 'chat' })
   ```

## API Reference

### Brands
- `POST /api/brands` - Create brand
- `PATCH /api/brands/:id` - Update brand
- `POST /api/brands/:id/teams` - Grant team access
- `DELETE /api/brands/:id/teams/:teamId` - Revoke team access

### Teams
- `POST /api/teams` - Create team
- `POST /api/teams/:id/members` - Add member
- `DELETE /api/teams/:id/members/:userId` - Remove member

### Usage
- `POST /api/usage/track` - Track usage event
```

---

## Implementation Checklist

### Phase 1: Database & Schema ✅
- [ ] Create `db-mysql` package
- [ ] Setup Drizzle schema
- [ ] Generate migrations
- [ ] Create database connection

### Phase 2: Repository Layer ✅
- [ ] Create base repository
- [ ] Implement TeamsRepo
- [ ] Implement BrandsRepo
- [ ] Implement OrgSettingsRepo

### Phase 3: Usage Tracking ✅
- [ ] Create usage package
- [ ] Implement usage client
- [ ] Implement server helpers

### Phase 4: API Routes ✅
- [ ] Brands API routes
- [ ] Teams API routes
- [ ] Usage tracking API

### Phase 5: Frontend Components ✅
- [ ] Brand management components
- [ ] Team management components
- [ ] Brand context provider

### Phase 6: Middleware & Context ✅
- [ ] Enhanced middleware
- [ ] Usage tracking hook
- [ ] Context providers

### Phase 7: Testing & Documentation ✅
- [ ] E2E test flows
- [ ] API documentation
- [ ] Setup guide

---

## Next Steps

1. **Deploy to staging environment**
2. **Run full test suite**
3. **Performance testing with large datasets**
4. **Security audit of permission checks**
5. **User acceptance testing**
6. **Production deployment**

## Notes

- All packages maintain existing licenses (MIT for UI, AGPL-3.0 for server)
- Backward compatibility with existing auth flows
- Gradual migration path for existing organizations
- Comprehensive error handling and logging
- Performance monitoring for database queries
