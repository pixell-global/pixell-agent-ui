import { buildStoragePrefix, parseStorageContext, getDefaultContext } from '../storage-context'

describe('buildStoragePrefix', () => {
  const testOrgId = 'org-12345'
  const testUserId = 'user-abc'
  const testTeamId = 'team-xyz'
  const testBrandId = 'brand-def'

  it('should build user context prefix for org', () => {
    const prefix = buildStoragePrefix(testOrgId, { type: 'user', userId: testUserId })
    expect(prefix).toBe(`orgs/${testOrgId}/users/${testUserId}/workspace-files`)
  })

  it('should build team context prefix for org', () => {
    const prefix = buildStoragePrefix(testOrgId, { type: 'team', teamId: testTeamId })
    expect(prefix).toBe(`orgs/${testOrgId}/teams/${testTeamId}/shared`)
  })

  it('should build brand context prefix for org', () => {
    const prefix = buildStoragePrefix(testOrgId, { type: 'brand', brandId: testBrandId })
    expect(prefix).toBe(`orgs/${testOrgId}/brands/${testBrandId}/assets`)
  })

  it('should build shared context prefix for org', () => {
    const prefix = buildStoragePrefix(testOrgId, { type: 'shared' })
    expect(prefix).toBe(`orgs/${testOrgId}/shared`)
  })

  it('should build public user context prefix when orgId is null', () => {
    const prefix = buildStoragePrefix(null, { type: 'user', userId: testUserId })
    expect(prefix).toBe(`orgs/public/users/${testUserId}/workspace-files`)
  })

  it('should use "public" as orgId when no org is provided', () => {
    const prefix = buildStoragePrefix(null, { type: 'shared' })
    expect(prefix).toBe('orgs/public/shared')
  })
})

describe('parseStorageContext', () => {
  it('should parse user context path', () => {
    const path = 'orgs/org-123/users/user-456/workspace-files/file.txt'
    const result = parseStorageContext(path)

    expect(result).toEqual({
      orgId: 'org-123',
      context: { type: 'user', userId: 'user-456' }
    })
  })

  it('should parse team context path', () => {
    const path = 'orgs/org-123/teams/team-789/shared/doc.pdf'
    const result = parseStorageContext(path)

    expect(result).toEqual({
      orgId: 'org-123',
      context: { type: 'team', teamId: 'team-789' }
    })
  })

  it('should parse brand context path', () => {
    const path = 'orgs/org-123/brands/brand-abc/assets/logo.png'
    const result = parseStorageContext(path)

    expect(result).toEqual({
      orgId: 'org-123',
      context: { type: 'brand', brandId: 'brand-abc' }
    })
  })

  it('should parse shared context path', () => {
    const path = 'orgs/org-123/shared/company-policy.pdf'
    const result = parseStorageContext(path)

    expect(result).toEqual({
      orgId: 'org-123',
      context: { type: 'shared' }
    })
  })

  it('should parse public user context path', () => {
    const path = 'public/users/user-456/workspace-files/file.txt'
    const result = parseStorageContext(path)

    expect(result).toEqual({
      orgId: '',
      context: { type: 'user', userId: 'user-456' }
    })
  })

  it('should handle paths with leading slash', () => {
    const path = '/orgs/org-123/users/user-456/workspace-files/file.txt'
    const result = parseStorageContext(path)

    expect(result).toEqual({
      orgId: 'org-123',
      context: { type: 'user', userId: 'user-456' }
    })
  })

  it('should return null for invalid paths', () => {
    expect(parseStorageContext('invalid/path')).toBeNull()
    expect(parseStorageContext('orgs')).toBeNull()
    expect(parseStorageContext('orgs/org-123')).toBeNull()
    expect(parseStorageContext('orgs/org-123/unknown/id')).toBeNull()
  })

  it('should return null for incomplete user path', () => {
    const path = 'orgs/org-123/users'
    expect(parseStorageContext(path)).toBeNull()
  })

  it('should return null for incomplete team path', () => {
    const path = 'orgs/org-123/teams'
    expect(parseStorageContext(path)).toBeNull()
  })
})

describe('getDefaultContext', () => {
  it('should return user context as default', () => {
    const userId = 'user-123'
    const context = getDefaultContext(userId)

    expect(context).toEqual({ type: 'user', userId })
  })
})
