import { NextRequest } from 'next/server'
import { GET as listGet } from '../../apps/web/src/app/api/files/list/route'
import { GET as contentGet } from '../../apps/web/src/app/api/files/content/route'
import { POST as createPost } from '../../apps/web/src/app/api/files/create/route'
import { DELETE as deleteRoute } from '../../apps/web/src/app/api/files/delete/route'

jest.mock('@pixell/auth-firebase/server', () => ({ verifySessionCookie: jest.fn(async () => ({ sub: 'user-1' })) }))
jest.mock('@pixell/db-mysql', () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => [{ orgId: 'org-1' }] }) }) })
  }),
  organizationMembers: {},
  organizations: {},
}))

jest.mock('@pixell/file-storage/src/storage-manager', () => {
  const actual = jest.requireActual('@pixell/file-storage/src/storage-manager')
  class FakeAdapter {
    private files: Record<string, string> = {}
    async initialize() {}
    async listFiles() { return [] as any }
    async readFile(path: string) { return { content: this.files[path] || '', metadata: { size: (this.files[path]||'').length, mimeType: 'text/plain', lastModified: new Date().toISOString(), createdAt: new Date().toISOString() } } }
    async writeFile(path: string, content: string) { this.files[path] = content; return { id: '1', name: path.split('/').pop()!, path, type: 'file', lastModified: new Date().toISOString(), size: content.length } as any }
    async deleteFile(path: string) { delete this.files[path] }
    async createFolder() { return { id: 'f', name: 'f', path: '/f', type: 'folder', lastModified: new Date().toISOString() } as any }
    async uploadFile(path: string, file: any) { const buf = file instanceof File ? await file.text() : file; this.files[path] = buf; return { id: 'u', name: 'u', path, type: 'file', lastModified: new Date().toISOString(), size: buf.length } as any }
    async searchFiles() { return [] as any }
    async getStorageStats() { return { totalSize: 0, fileCount: 0, folderCount: 0, lastUpdated: new Date().toISOString() } }
    async isHealthy() { return true }
    async getStatus() { return { provider: 'test', configured: true, healthy: true, lastCheck: new Date().toISOString(), capabilities: [] } as any }
  }
  class TestStorageManager extends actual.StorageManager {
    async initialize(config: any) { (this as any).adapter = new FakeAdapter(); (this as any).initialized = true }
  }
  return { ...actual, StorageManager: TestStorageManager }
})

const makeReq = (url: string, init?: RequestInit) => new NextRequest(new Request(url, init))

describe('Files API with storage manager', () => {
  test('create, read, delete flow', async () => {
    const createReq = makeReq('http://test/api/files/create', { method: 'POST', body: JSON.stringify({ path: '/test.txt', type: 'file', content: 'hello' }) as any } as any)
    ;(createReq as any).headers.set('content-type', 'application/json')
    const createRes = await createPost(createReq)
    expect(createRes.status).toBe(200)

    const contentRes = await contentGet(makeReq('http://test/api/files/content?path=/test.txt'))
    const contentJson: any = await contentRes.json()
    expect(contentJson.content).toBe('hello')

    const delRes = await deleteRoute(makeReq('http://test/api/files/delete?path=/test.txt'))
    expect(delRes.status).toBe(200)
  })
})


