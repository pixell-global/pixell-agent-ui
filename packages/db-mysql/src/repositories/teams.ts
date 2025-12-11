import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import { teamMembers, teams } from '../schema'
import { BaseRepository } from './base'

export class TeamsRepo extends BaseRepository {
  async create(name: string, description?: string, userIdForCheck?: string) {
    if (!name) throw new Error('Name is required')
    if (!userIdForCheck) throw new Error('User ID is required')

    const orgId = await this.getOrgContext(userIdForCheck)
    const db = await getDb()
    const id = randomUUID()
    await db.insert(teams).values({ id, orgId, name, description })
    return { id, orgId, name, description }
  }

  async addMember(teamId: string, userId: string, role: 'lead' | 'member' | 'viewer' = 'member') {
    const db = await getDb()
    await db.insert(teamMembers).values({ teamId, userId, role })
    return { teamId, userId, role }
  }

  async removeMember(teamId: string, userId: string) {
    const db = await getDb()
    await db
      .update(teamMembers)
      .set({ isDeleted: 1 })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
  }

  async listMembers(teamId: string) {
    const db = await getDb()
    return db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.isDeleted, 0)))
  }

  async listByUser(userId: string) {
    const orgId = await this.getOrgContext(userId)
    const db = await getDb()
    return db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDeleted, 0)))
  }
}


