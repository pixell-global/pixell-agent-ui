import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { LocalAdapter } from '../../packages/file-storage/src/adapters/local-adapter'

describe('LocalAdapter CRUD', () => {
  let tmpDir: string
  let adapter: LocalAdapter

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paf-local-'))
    adapter = new LocalAdapter()
    await adapter.initialize({ rootPath: tmpDir })
  })

  afterAll(async () => {
    await fs.remove(tmpDir)
  })

  test('create folder and file, list, read, delete', async () => {
    await adapter.createFolder('/docs')
    const file = await adapter.writeFile('/docs/readme.txt', 'hello')
    expect(file.path).toBe('/docs/readme.txt')

    const listRoot = await adapter.listFiles('/')
    expect(listRoot.find((n) => n.name === 'docs' && n.type === 'folder')).toBeTruthy()

    const listDocs = await adapter.listFiles('/docs')
    expect(listDocs.find((n) => n.name === 'readme.txt' && n.type === 'file')).toBeTruthy()

    const { content } = await adapter.readFile('/docs/readme.txt')
    expect(content).toBe('hello')

    await adapter.deleteFile('/docs/readme.txt')
    const listAfterDelete = await adapter.listFiles('/docs')
    expect(listAfterDelete.find((n) => n.name === 'readme.txt')).toBeFalsy()
  })
})
