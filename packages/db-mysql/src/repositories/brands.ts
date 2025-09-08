import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import { brands, orgSettings, teamBrandAccess, teamMembers, userBrandAccess } from '../schema'
import { BaseRepository } from './base'

export class BrandsRepo extends BaseRepository {
  async create(name: string, _code?: string, primaryTeamId?: string, metadata?: any, userIdForCheck?: string) {
    if (!name) throw new Error('Name is required')
    if (!userIdForCheck) throw new Error('User ID is required')
    
    const orgId = await this.getOrgContext(userIdForCheck)
    const db = await getDb()
    const id = randomUUID()
    await db.insert(brands).values({ id, orgId, name, primaryTeamId, metadata })
    return { id, orgId, name, primaryTeamId, metadata }
  }

  async assignTeam(brandId: string, teamId: string, role: 'manager' | 'editor' | 'analyst' | 'viewer' = 'viewer') {
    const db = await getDb()
    const brand = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1)
    if (brand.length === 0) throw new Error('Brand not found')

    const settings = await db.select().from(orgSettings).where(eq(orgSettings.orgId, brand[0].orgId)).limit(1)
    if (settings.length > 0 && settings[0].brandAccessMode === 'isolated') {
      if (brand[0].primaryTeamId !== teamId) throw new Error('In isolated mode, only primary team can access brand')
    }

    await db.insert(teamBrandAccess).values({ teamId, brandId, role })
  }

  async revokeTeam(brandId: string, teamId: string) {
    const db = await getDb()
    await db
      .update(teamBrandAccess)
      .set({ isDeleted: 1 })
      .where(and(eq(teamBrandAccess.brandId, brandId), eq(teamBrandAccess.teamId, teamId)))
  }

  async grantUser(brandId: string, userId: string, role: 'manager' | 'editor' | 'analyst' | 'viewer' = 'viewer') {
    const db = await getDb()
    await db.insert(userBrandAccess).values({ brandId, userId, role })
  }

  async revokeUser(brandId: string, userId: string) {
    const db = await getDb()
    await db
      .update(userBrandAccess)
      .set({ isDeleted: 1 })
      .where(and(eq(userBrandAccess.brandId, brandId), eq(userBrandAccess.userId, userId)))
  }

  async listByUser(userId: string) {
    const db = await getDb()
    const orgId = await this.getOrgContext(userId)
    const orgRole = await this.getUserOrgRole(userId, orgId)
    if (!orgRole) throw new Error('User not in organization')
    
    if (this.hasOrgOverride(orgRole)) {
      return db.select().from(brands).where(and(eq(brands.orgId, orgId), eq(brands.isDeleted, 0)))
    }

    const viaTeam = await db
      .select({ id: brands.id, name: brands.name, orgId: brands.orgId, primaryTeamId: brands.primaryTeamId, metadata: brands.metadata })
      .from(brands)
      .innerJoin(teamBrandAccess, eq(brands.id, teamBrandAccess.brandId))
      .innerJoin(teamMembers, eq(teamBrandAccess.teamId, teamMembers.teamId))
      .where(and(eq(brands.orgId, orgId), eq(teamMembers.userId, userId), eq(brands.isDeleted, 0), eq(teamBrandAccess.isDeleted, 0), eq(teamMembers.isDeleted, 0)))

    const direct = await db
      .select({ id: brands.id, name: brands.name, orgId: brands.orgId, primaryTeamId: brands.primaryTeamId, metadata: brands.metadata })
      .from(brands)
      .innerJoin(userBrandAccess, eq(brands.id, userBrandAccess.brandId))
      .where(and(eq(brands.orgId, orgId), eq(userBrandAccess.userId, userId), eq(brands.isDeleted, 0), eq(userBrandAccess.isDeleted, 0)))

    const map = new Map<string, any>()
    ;[...viaTeam, ...direct].forEach((row: any) => map.set(row.id, row))
    return Array.from(map.values())
  }
}


