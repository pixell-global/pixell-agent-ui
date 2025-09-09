import fs from 'fs'
import path from 'path'
import { parseCsv, sniffDelimiter } from '../../apps/web/src/lib/csv'

describe('CSV parser', () => {
  const samplePath = path.resolve(__dirname, '../../apps/web/workspace-files/TikTok/video_export_hashtag_collagen.csv')
  const content = fs.readFileSync(samplePath, 'utf8')

  test('sniffs comma as delimiter for TikTok sample', () => {
    const d = sniffDelimiter(content)
    expect(d).toBe(',')
  })

  test('parses header and consistent columns', () => {
    const d = sniffDelimiter(content)
    const rows = parseCsv(content, d)
    expect(rows.length).toBeGreaterThan(2)
    const header = rows[0]
    expect(header[0]).toBe('username')
    expect(header[1]).toBe('title')
    // All rows should have same column count as header
    for (let i = 1; i < Math.min(rows.length, 50); i++) {
      expect(rows[i].length).toBe(header.length)
    }
  })
})


