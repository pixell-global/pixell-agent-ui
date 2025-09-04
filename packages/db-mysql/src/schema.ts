import { mysqlTable, varchar, char, text, json, timestamp, mysqlEnum, index, primaryKey, bigint, int, unique } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const organizations = mysqlTable('organizations', {
  id: char('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  createdBy: varchar('created_by', { length: 128 }).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 120 }),
  subscriptionStatus: mysqlEnum('subscription_status', ['active', 'trialing', 'past_due', 'incomplete', 'canceled']).default('incomplete').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const organizationMembers = mysqlTable('organization_members', {
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['owner', 'admin', 'member', 'viewer']).default('owner').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.orgId, t.userId] }) }))

export const orgSettings = mysqlTable('org_settings', {
  orgId: char('org_id', { length: 36 }).primaryKey(),
  brandAccessMode: mysqlEnum('brand_access_mode', ['shared', 'isolated']).default('shared').notNull(),
  requireBrandContext: int('require_brand_context').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const teams = mysqlTable('teams', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const teamMembers = mysqlTable('team_members', {
  teamId: char('team_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['lead', 'member', 'viewer']).default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.teamId, t.userId] }) }))

export const brands = mysqlTable('brands', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  primaryTeamId: char('primary_team_id', { length: 36 }),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({
  uniqueOrgName: unique('brands_org_name_unique').on(t.orgId, t.name),
}))

export const teamBrandAccess = mysqlTable('team_brand_access', {
  teamId: char('team_id', { length: 36 }).notNull(),
  brandId: char('brand_id', { length: 36 }).notNull(),
  role: mysqlEnum('role', ['manager', 'editor', 'analyst', 'viewer']).default('viewer').notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.teamId, t.brandId] }) }))

export const userBrandAccess = mysqlTable('user_brand_access', {
  brandId: char('brand_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['manager', 'editor', 'analyst', 'viewer']).default('viewer').notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.brandId, t.userId] }) }))

export const orgInvitations = mysqlTable('org_invitations', {
  id: char('id', { length: 36 }).primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  role: mysqlEnum('role', ['admin', 'member', 'viewer']).default('member').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  isDeleted: int('is_deleted').default(0).notNull(),
})

export const actionEvents = mysqlTable('action_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  orgId: char('org_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  appId: varchar('app_id', { length: 80 }),
  actionKey: varchar('action_key', { length: 120 }).notNull(),
  units: int('units').default(1).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  metadata: json('metadata'),
  brandId: char('brand_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxOrgCreated: index('idx_usage_org_created').on(t.orgId, t.createdAt),
  idxBrandCreated: index('idx_usage_brand_created').on(t.brandId, t.createdAt),
}))


