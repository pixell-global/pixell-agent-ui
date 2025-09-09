import fs from 'fs'
import path from 'path'
import https from 'https'

// Increase timeout for network call
jest.setTimeout(20000)

function applyEnvFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue
    const key = line.substring(0, eqIndex).trim()
    let value = line.substring(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function loadEnvDev(): string[] {
  const cwd = process.cwd()
  const webDir = path.join(cwd, 'apps', 'web')
  const candidates = [
    path.join(cwd, '.env.dev'),
    path.join(webDir, '.env.dev'),
  ]
  const loaded: string[] = []
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      applyEnvFile(filePath)
      loaded.push(filePath)
    }
  }
  // Fallbacks to help local runs if .env.dev is not present
  if (loaded.length === 0) {
    const fallbacks = [
      path.join(cwd, '.env.local'),
      path.join(webDir, '.env.local'),
      path.join(cwd, '.env'),
      path.join(webDir, '.env'),
    ]
    for (const filePath of fallbacks) {
      if (fs.existsSync(filePath)) {
        applyEnvFile(filePath)
        loaded.push(filePath)
      }
    }
  }
  return loaded
}

describe('Firebase env connectivity (.env.dev)', () => {
  it('loads API key from .env.dev and validates with Identity Toolkit API', async () => {
    const loaded = loadEnvDev()
    expect(loaded.length).toBeGreaterThan(0)

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    expect(apiKey && apiKey.trim().length > 0).toBe(true)

    // Use createAuthUri endpoint which only requires API key
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`)
    const payload = JSON.stringify({
      identifier: 'test@example.com',
      continueUri: 'http://localhost:3003'
    })

    const text: string = await new Promise((resolve, reject) => {
      const req = https.request({
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          // Simulate browser origin to satisfy API key HTTP referrer restrictions
          'Referer': 'http://localhost:3003'
        }
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body)
          } else {
            reject(new Error(`Firebase API key validation failed: ${res.statusCode} ${res.statusMessage} - ${body}`))
          }
        })
      })
      req.on('error', reject)
      req.write(payload)
      req.end()
    })

    const parsed = JSON.parse(text)
    expect(typeof parsed).toBe('object')
  })
})


