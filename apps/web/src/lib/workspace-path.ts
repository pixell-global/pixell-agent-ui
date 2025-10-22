import path from 'path'
import { verifySessionCookie } from '@pixell/auth-firebase/server'
import { getDb, organizationMembers, organizations } from '@pixell/db-mysql'
import { and, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { StorageManager, type StorageConfig } from '@pixell/file-storage/src/storage-manager'
import { buildStoragePrefix, type StorageContext } from './storage-context'

/**
 * Resolve current user and organization from the session cookie.
 */
export async function resolveUserAndOrg(req: NextRequest): Promise<{ userId: string; orgId: string | null }> {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'session'
  const sessionCookie = req.cookies.get(cookieName)?.value
  if (!sessionCookie) return { userId: '', orgId: null }

  try {
    const decoded = await verifySessionCookie(sessionCookie)
    const userId = decoded.sub

    try {
      const db = await getDb()
      const rows = await db
        .select({ orgId: organizationMembers.orgId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
        .limit(1)
      const orgId = rows[0]?.orgId || null
      return { userId, orgId }
    } catch {
      return { userId, orgId: null }
    }
  } catch (error) {
    // Session cookie is invalid/expired
    console.error('Session verification error in resolveUserAndOrg:', error);
    return { userId: '', orgId: null }
  }
}

async function fetchOrganizationName(orgId: string): Promise<string | null> {
  try {
    const db = await getDb()
    const rows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    const name = rows[0]?.name as unknown as string | undefined
    return name || null
  } catch {
    return null
  }
}

function generateOrgBucketName(orgId: string, orgName: string | null): string {
  const baseSource = (orgName || orgId).toLowerCase()
  const slug = baseSource.replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const suffix = orgId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
  const candidate = `paf-org-${slug}-${suffix}`
  return candidate.slice(0, 63)
}

/**
 * Build a storage config for the current request with org-scoped workspace prefix.
 * If provider is local, we scope under `<root>/orgs/<orgId>/workspace-files` for parity.
 * If org cannot be determined, we fallback to `public`.
 */
export function buildStorageConfigForOrg(orgId: string | null): StorageConfig {
  const base = StorageManager.getConfigFromEnv()
  const safeOrg = orgId || 'public'

  // S3-only: Derive per-organization bucket name
  base.config.bucketResolver = async () => {
    const name = await fetchOrganizationName(safeOrg)
    return generateOrgBucketName(safeOrg, name)
  }
  // Keep simple, consistent prefix within each bucket
  base.config.prefix = base.config.prefix || 'workspace-files'

  // Alias support for S3 endpoint via S3_FILE_STORAGE_URL
  if (!base.config.endpoint && process.env.S3_FILE_STORAGE_URL) {
    base.config.endpoint = process.env.S3_FILE_STORAGE_URL
  }

  // Default region precedence: STORAGE_S3_REGION -> AWS_DEFAULT_REGION -> us-east-2
  base.config.region = base.config.region || process.env.STORAGE_S3_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2'

  return base
}

/**
 * Build a storage config with multi-context support (users/teams/brands/shared).
 * This is the enhanced version that supports different storage contexts within an organization.
 *
 * @param orgId - Organization ID (null for public/unauthenticated users)
 * @param context - Storage context (user, team, brand, or shared)
 * @returns StorageConfig with appropriate bucket and prefix
 */
export function buildStorageConfigForContext(
  orgId: string | null,
  context: StorageContext
): StorageConfig {
  const base = StorageManager.getConfigFromEnv()
  const safeOrg = orgId || 'public'

  // S3-only: Derive per-organization bucket name
  base.config.bucketResolver = async () => {
    const name = await fetchOrganizationName(safeOrg)
    return generateOrgBucketName(safeOrg, name)
  }

  // Use context-specific prefix (e.g., orgs/{orgId}/users/{userId}/workspace-files)
  base.config.prefix = buildStoragePrefix(orgId, context)

  // Alias support for S3 endpoint via S3_FILE_STORAGE_URL
  if (!base.config.endpoint && process.env.S3_FILE_STORAGE_URL) {
    base.config.endpoint = process.env.S3_FILE_STORAGE_URL
  }

  // Default region precedence: STORAGE_S3_REGION -> AWS_DEFAULT_REGION -> us-east-2
  base.config.region = base.config.region || process.env.STORAGE_S3_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2'

  return base
}


