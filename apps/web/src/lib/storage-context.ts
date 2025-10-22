/**
 * Storage Context Types
 *
 * Defines the different context types for file storage isolation:
 * - user: Private files for a specific user
 * - team: Shared files for a team
 * - brand: Brand-specific assets
 * - shared: Organization-wide shared files
 */

export type StorageContext =
  | { type: 'user'; userId: string }
  | { type: 'team'; teamId: string }
  | { type: 'brand'; brandId: string }
  | { type: 'shared' }

/**
 * Build S3 prefix based on organization and storage context
 *
 * Examples:
 * - user context: orgs/{orgId}/users/{userId}/workspace-files
 * - team context: orgs/{orgId}/teams/{teamId}/shared
 * - brand context: orgs/{orgId}/brands/{brandId}/assets
 * - shared context: orgs/{orgId}/shared
 * - public (no org): public/users/{userId}/workspace-files
 */
export function buildStoragePrefix(orgId: string | null, context: StorageContext): string {
  const safeOrg = orgId || 'public'

  switch (context.type) {
    case 'user':
      return `orgs/${safeOrg}/users/${context.userId}/workspace-files`

    case 'team':
      return `orgs/${safeOrg}/teams/${context.teamId}/shared`

    case 'brand':
      return `orgs/${safeOrg}/brands/${context.brandId}/assets`

    case 'shared':
      return `orgs/${safeOrg}/shared`
  }
}

/**
 * Parse a storage path to determine its context
 *
 * @param path - S3 path like "orgs/org123/users/user456/workspace-files/file.txt"
 * @returns StorageContext or null if path doesn't match expected format
 */
export function parseStorageContext(path: string): { orgId: string; context: StorageContext } | null {
  // Remove leading slash if present
  const normalized = path.startsWith('/') ? path.slice(1) : path
  const parts = normalized.split('/')

  // Handle public paths: public/users/{userId}/...
  if (parts[0] === 'public' && parts[1] === 'users' && parts[2]) {
    return {
      orgId: '',
      context: { type: 'user', userId: parts[2] }
    }
  }

  // Handle org paths: orgs/{orgId}/{contextType}/{id}/...
  if (parts[0] !== 'orgs' || !parts[1]) {
    return null
  }

  const orgId = parts[1]
  const contextType = parts[2]
  const contextId = parts[3]

  switch (contextType) {
    case 'users':
      if (!contextId) return null
      return { orgId, context: { type: 'user', userId: contextId } }

    case 'teams':
      if (!contextId) return null
      return { orgId, context: { type: 'team', teamId: contextId } }

    case 'brands':
      if (!contextId) return null
      return { orgId, context: { type: 'brand', brandId: contextId } }

    case 'shared':
      return { orgId, context: { type: 'shared' } }

    default:
      return null
  }
}

/**
 * Check if a user has access to a specific storage context
 *
 * This is a placeholder for future authorization logic
 * In production, this should check:
 * - Team membership for team contexts
 * - Brand access for brand contexts
 * - Org membership for shared contexts
 * - User ID match for user contexts
 */
export async function canAccessContext(
  userId: string,
  orgId: string | null,
  context: StorageContext
): Promise<boolean> {
  // TODO: Implement proper authorization checks
  // For now, allow all access within the same org

  switch (context.type) {
    case 'user':
      // Only the user can access their own files
      return context.userId === userId

    case 'team':
      // TODO: Check team membership
      return true

    case 'brand':
      // TODO: Check brand access permissions
      return true

    case 'shared':
      // All org members can access shared files
      return !!orgId
  }
}

/**
 * Default context for a user
 */
export function getDefaultContext(userId: string): StorageContext {
  return { type: 'user', userId }
}
