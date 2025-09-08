import { eq } from 'drizzle-orm'
import { getDb } from '../connection'
import { orgSettings } from '../schema'

export class OrgSettingsRepo {
  async get(orgId: string) {
    const db = await getDb()
    const rows = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId)).limit(1)
    return rows[0] || null
  }

  async update(orgId: string, updates: { brandAccessMode?: 'shared' | 'isolated'; requireBrandContext?: boolean }) {
    const db = await getDb()
    const existing = await this.get(orgId)
    const set: any = {}
    if (updates.brandAccessMode) set.brandAccessMode = updates.brandAccessMode
    if (typeof updates.requireBrandContext === 'boolean') set.requireBrandContext = updates.requireBrandContext ? 1 : 0
    if (existing) {
      await db.update(orgSettings).set(set).where(eq(orgSettings.orgId, orgId))
    } else {
      await db.insert(orgSettings).values({ orgId, brandAccessMode: updates.brandAccessMode || 'shared', requireBrandContext: updates.requireBrandContext ? 1 : 0 })
    }
  }
}


