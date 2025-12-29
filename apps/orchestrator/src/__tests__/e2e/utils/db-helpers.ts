/**
 * Database Helpers for E2E Tests
 *
 * Provides utilities for querying RDS to get test users and organizations.
 * Uses the @pixell/db-mysql package for database access.
 */

import { getDb } from '@pixell/db-mysql'
import { users, organizations, organizationMembers } from '@pixell/db-mysql/schema'
import { eq, sql } from 'drizzle-orm'

export interface TestUser {
  userId: string
  orgId: string
  email: string
  orgName: string
}

/**
 * Get a test user from the database
 *
 * Queries for the first user that has an organization membership.
 * This ensures we get a user that can actually perform operations.
 */
export async function getTestUserFromDb(): Promise<TestUser> {
  const db = await getDb()

  // Get first user with an organization
  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      orgId: organizationMembers.orgId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
    .limit(1)

  if (result.length === 0) {
    throw new Error('No test user found in database. Please ensure at least one user with an organization exists.')
  }

  // Get org name
  const orgResult = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, result[0].orgId))
    .limit(1)

  return {
    userId: result[0].userId,
    orgId: result[0].orgId,
    email: result[0].email,
    orgName: orgResult[0]?.name || 'Unknown',
  }
}

/**
 * Get a specific user by ID
 */
export async function getUserById(userId: string): Promise<TestUser | null> {
  const db = await getDb()

  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      orgId: organizationMembers.orgId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
    .where(eq(users.id, userId))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  // Get org name
  const orgResult = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, result[0].orgId))
    .limit(1)

  return {
    userId: result[0].userId,
    orgId: result[0].orgId,
    email: result[0].email,
    orgName: orgResult[0]?.name || 'Unknown',
  }
}

/**
 * Get multiple test users for multi-user isolation tests
 */
export async function getMultipleTestUsers(count: number = 2): Promise<TestUser[]> {
  const db = await getDb()

  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      orgId: organizationMembers.orgId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
    .limit(count)

  if (result.length < count) {
    console.warn(`Warning: Only found ${result.length} users, requested ${count}`)
  }

  const testUsers: TestUser[] = []

  for (const row of result) {
    const orgResult = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, row.orgId))
      .limit(1)

    testUsers.push({
      userId: row.userId,
      orgId: row.orgId,
      email: row.email,
      orgName: orgResult[0]?.name || 'Unknown',
    })
  }

  return testUsers
}

/**
 * Verify database connection is working
 */
export async function verifyDbConnection(): Promise<boolean> {
  try {
    const db = await getDb()
    await db.execute(sql`SELECT 1`)
    return true
  } catch (error: any) {
    console.error('Database connection verification failed:', error.message)
    return false
  }
}

/**
 * Get user storage path from database (if set)
 */
export async function getUserStoragePath(userId: string): Promise<string | null> {
  const db = await getDb()

  const result = await db
    .select({ s3StoragePath: users.s3StoragePath })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return result[0]?.s3StoragePath || null
}

/**
 * Get a user by email address
 *
 * Looks up a user by their email and returns their user ID, org ID, and other details.
 * Useful for E2E tests that need to authenticate as a specific real user.
 */
export async function getUserByEmail(email: string): Promise<TestUser | null> {
  const db = await getDb()

  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      orgId: organizationMembers.orgId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
    .where(eq(users.email, email))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  // Get org name
  const orgResult = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, result[0].orgId))
    .limit(1)

  return {
    userId: result[0].userId,
    orgId: result[0].orgId,
    email: result[0].email,
    orgName: orgResult[0]?.name || 'Unknown',
  }
}
