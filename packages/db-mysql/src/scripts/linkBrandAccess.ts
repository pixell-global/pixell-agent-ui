import { and, eq } from 'drizzle-orm'
import { getDb, users, teams, brands, organizationMembers, teamMembers, teamBrandAccess, userBrandAccess } from '..'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

// Load DB credentials from .env.local (preferred) or .env from common locations
function loadEnvFromLocalFiles() {
  const cwd = process.cwd()
  const candidates = [
    // Monorepo root
    path.resolve(cwd, '..', '..', '.env.local'),
    path.resolve(cwd, '..', '..', '.env'),
    // Current package dir
    path.resolve(cwd, '.env.local'),
    path.resolve(cwd, '.env'),
    // Web app dir (often where .env.local is)
    path.resolve(cwd, '..', '..', 'apps', 'web', '.env.local'),
    path.resolve(cwd, '..', '..', 'apps', 'web', '.env'),
  ]
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file })
      break
    }
  }
}

async function main() {
  loadEnvFromLocalFiles()
  const args = new Map<string, string>()
  for (let i = 2; i < process.argv.length; i++) {
    const [k, v] = process.argv[i].split('=')
    if (k && v) args.set(k.replace(/^--/, ''), v)
  }

  const orgId = args.get('org')
  const brandId = args.get('brand')
  const teamId = args.get('team')
  const userEmail = args.get('user')
  const teamRole = (args.get('teamRole') as 'lead' | 'member' | 'viewer') || 'lead'
  const brandRole = (args.get('brandRole') as 'manager' | 'editor' | 'analyst' | 'viewer') || 'manager'

  if (!orgId || !brandId || !teamId || !userEmail) {
    console.error('Usage: node dist/scripts/linkBrandAccess.js --org=<orgId> --brand=<brandId> --team=<teamId> --user=<userEmail> [--teamRole=lead|member|viewer] [--brandRole=manager|editor|analyst|viewer]')
    process.exit(1)
  }

  const db = await getDb()

  // Resolve entities
  const userRows = await db.select().from(users).where(eq(users.email, userEmail)).limit(1)
  if (userRows.length === 0) throw new Error(`User not found: ${userEmail}`)
  const userId = userRows[0].id

  const teamRows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (teamRows.length === 0) throw new Error(`Team not found: ${teamId}`)
  if (teamRows[0].orgId !== orgId) throw new Error(`Team ${teamId} does not belong to org ${orgId}`)

  const brandRows = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1)
  if (brandRows.length === 0) throw new Error(`Brand not found: ${brandId}`)
  if (brandRows[0].orgId !== orgId) throw new Error(`Brand ${brandId} does not belong to org ${orgId}`)

  // Ensure user is an org member (idempotent upsert-like)
  const orgMember = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1)
  if (orgMember.length === 0) {
    await db.insert(organizationMembers).values({ orgId, userId, role: 'member' })
    console.log(`Added organization member: org=${orgId} user=${userId}`)
  } else if (orgMember[0].isDeleted) {
    await db.update(organizationMembers).set({ isDeleted: 0 }).where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)))
    console.log(`Reactivated organization member: org=${orgId} user=${userId}`)
  }

  // Ensure team membership
  const tm = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  if (tm.length === 0) {
    await db.insert(teamMembers).values({ teamId, userId, role: teamRole })
    console.log(`Added team member: team=${teamId} user=${userId} role=${teamRole}`)
  } else if (tm[0].isDeleted) {
    await db.update(teamMembers).set({ isDeleted: 0, role: teamRole }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    console.log(`Reactivated team member: team=${teamId} user=${userId} role=${teamRole}`)
  }

  // Ensure team-brand access
  const tba = await db
    .select()
    .from(teamBrandAccess)
    .where(and(eq(teamBrandAccess.teamId, teamId), eq(teamBrandAccess.brandId, brandId)))
    .limit(1)
  if (tba.length === 0) {
    await db.insert(teamBrandAccess).values({ teamId, brandId, role: brandRole })
    console.log(`Granted team-brand access: team=${teamId} brand=${brandId} role=${brandRole}`)
  } else if (tba[0].isDeleted) {
    await db.update(teamBrandAccess).set({ isDeleted: 0, role: brandRole }).where(and(eq(teamBrandAccess.teamId, teamId), eq(teamBrandAccess.brandId, brandId)))
    console.log(`Reactivated team-brand access: team=${teamId} brand=${brandId} role=${brandRole}`)
  }

  // Ensure direct user-brand access
  const uba = await db
    .select()
    .from(userBrandAccess)
    .where(and(eq(userBrandAccess.brandId, brandId), eq(userBrandAccess.userId, userId)))
    .limit(1)
  if (uba.length === 0) {
    await db.insert(userBrandAccess).values({ brandId, userId, role: brandRole })
    console.log(`Granted user-brand access: user=${userId} brand=${brandId} role=${brandRole}`)
  } else if (uba[0].isDeleted) {
    await db.update(userBrandAccess).set({ isDeleted: 0, role: brandRole }).where(and(eq(userBrandAccess.brandId, brandId), eq(userBrandAccess.userId, userId)))
    console.log(`Reactivated user-brand access: user=${userId} brand=${brandId} role=${brandRole}`)
  }

  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


