import { eq, and } from 'drizzle-orm'
import { getDb } from '../connection'
import { users, organizationMembers } from '../schema'

/**
 * Get a user's S3 storage path from the database
 */
export async function getUserStoragePath(userId: string): Promise<string | null> {
  const db = await getDb()
  const result = await db
    .select({ s3StoragePath: users.s3StoragePath })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return result[0]?.s3StoragePath ?? null
}

/**
 * Set a user's S3 storage path in the database
 */
export async function setUserStoragePath(userId: string, path: string): Promise<void> {
  const db = await getDb()
  await db
    .update(users)
    .set({ s3StoragePath: path })
    .where(eq(users.id, userId))
}

/**
 * Generate the S3 storage path for a user within an organization
 */
export function generateUserStoragePath(orgId: string, userId: string): string {
  return `orgs/${orgId}/users/${userId}`
}

/**
 * Ensure a user has an S3 storage path allocated.
 * If not, generate and save one based on their organization.
 */
export async function ensureUserStoragePath(userId: string, orgId: string): Promise<string> {
  let path = await getUserStoragePath(userId)

  if (!path) {
    path = generateUserStoragePath(orgId, userId)
    await setUserStoragePath(userId, path)
  }

  return path
}

/**
 * Get a user's organization ID from the database.
 * Returns the first org the user belongs to (prioritizes by membership).
 */
export async function getUserOrgId(userId: string): Promise<string | null> {
  const db = await getDb()
  const memberships = await db
    .select({ orgId: organizationMembers.orgId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
    .limit(1)

  return memberships[0]?.orgId || null
}
