import { and, eq } from 'drizzle-orm'
import { getDb } from '../connection'
import { organizationMembers } from '../schema'

export abstract class BaseRepository {
  protected async ensureUserInOrg(userId: string, orgId: string): Promise<boolean> {
    const db = await getDb()
    const member = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.orgId, orgId), eq(organizationMembers.isDeleted, 0)))
      .limit(1)

    return member.length > 0
  }

  protected async getUserOrgRole(userId: string, orgId: string): Promise<'owner' | 'admin' | 'member' | 'viewer' | null> {
    const db = await getDb()
    const member = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.orgId, orgId), eq(organizationMembers.isDeleted, 0)))
      .limit(1)

    return (member[0]?.role as any) ?? null
  }

  protected hasOrgOverride(role: string | null): boolean {
    if (!role) return false
    return role === 'owner' || role === 'admin'
  }

  protected async getCurrentUserOrg(userId: string): Promise<string | null> {
    const db = await getDb()
    const memberships = await db
      .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDeleted, 0)))
      .orderBy(organizationMembers.role) // owner/admin first, then member/viewer
    
    return memberships[0]?.orgId || null
  }

  protected async getOrgContext(userId: string): Promise<string> {
    const orgId = await this.getCurrentUserOrg(userId)
    if (!orgId) throw new Error('User not in any organization')
    return orgId
  }
}


