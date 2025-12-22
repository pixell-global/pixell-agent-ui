/**
 * Service Helpers for E2E Tests
 *
 * Provides utilities for starting, stopping, and managing:
 * - Orchestrator (Node.js/TypeScript)
 * - vivid-commenter agent (Python with pixell-sdk)
 */

import { spawn, ChildProcess, exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// Service paths
// __dirname = apps/orchestrator/src/__tests__/e2e/utils
// Going up 4 levels: utils -> e2e -> __tests__ -> src -> orchestrator
const ORCHESTRATOR_DIR = path.resolve(__dirname, '../../../..')
const VIVID_COMMENTER_DIR = '/Users/syum/dev/vivid-commenter'
const TEST_AGENT_DIR = path.resolve(__dirname, '../test-agent')

// Service ports
const ORCHESTRATOR_PORT = 3001
const AGENT_PORT = 8000
const TEST_AGENT_PORT = 8001

export interface ServiceProcess {
  process: ChildProcess
  port: number
  name: string
  logs: string[]
}

/**
 * Start the orchestrator service
 */
export async function startOrchestrator(): Promise<ServiceProcess> {
  const logs: string[] = []

  // Build environment with S3 configuration
  // Note: We spread process.env and then DELETE AWS credentials
  // This forces the AWS SDK to use ~/.aws/credentials which has valid credentials
  // The env-based credentials from .env.dev cause SDK failures for unknown reasons
  const orchestratorEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(ORCHESTRATOR_PORT),
    NODE_ENV: 'test',
    // S3 storage configuration for file uploads
    STORAGE_PROVIDER: 's3',
    STORAGE_S3_BUCKET: process.env.STORAGE_S3_BUCKET || 'pixell-agents',
    STORAGE_S3_REGION: process.env.STORAGE_S3_REGION || 'us-east-2',
    AWS_REGION: process.env.AWS_REGION || 'us-east-2',
  }

  // Remove AWS credentials from env to let SDK use ~/.aws/credentials
  delete (orchestratorEnv as Record<string, string | undefined>).AWS_ACCESS_KEY_ID
  delete (orchestratorEnv as Record<string, string | undefined>).AWS_SECRET_ACCESS_KEY
  delete (orchestratorEnv as Record<string, string | undefined>).STORAGE_S3_ACCESS_KEY_ID
  delete (orchestratorEnv as Record<string, string | undefined>).STORAGE_S3_SECRET_ACCESS_KEY

  // Log AWS credentials status for debugging
  if (process.env.DEBUG_E2E) {
    console.log('[orchestrator] AWS_ACCESS_KEY_ID:', orchestratorEnv.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET (using ~/.aws/credentials)')
    console.log('[orchestrator] STORAGE_S3_BUCKET:', orchestratorEnv.STORAGE_S3_BUCKET)
  }

  // Use tsx to run TypeScript directly
  // Note: Don't use shell: true to avoid shell profile scripts interfering with env vars
  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: ORCHESTRATOR_DIR,
    env: orchestratorEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Capture logs
  proc.stdout?.on('data', (data) => {
    const line = data.toString()
    logs.push(`[orchestrator:stdout] ${line}`)
    if (process.env.DEBUG_E2E) {
      console.log(`[orchestrator:stdout] ${line}`)
    }
  })

  proc.stderr?.on('data', (data) => {
    const line = data.toString()
    logs.push(`[orchestrator:stderr] ${line}`)
    if (process.env.DEBUG_E2E) {
      console.error(`[orchestrator:stderr] ${line}`)
    }
  })

  proc.on('error', (err) => {
    logs.push(`[orchestrator:error] ${err.message}`)
    console.error('Orchestrator process error:', err)
  })

  return {
    process: proc,
    port: ORCHESTRATOR_PORT,
    name: 'orchestrator',
    logs,
  }
}

/**
 * Start the vivid-commenter agent
 */
export async function startVividCommenter(): Promise<ServiceProcess> {
  const logs: string[] = []

  const proc = spawn('python3', ['main_sdk.py'], {
    cwd: VIVID_COMMENTER_DIR,
    env: {
      ...process.env,
      PORT: String(AGENT_PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Capture logs
  proc.stdout?.on('data', (data) => {
    const line = data.toString()
    logs.push(`[vivid-commenter:stdout] ${line}`)
    if (process.env.DEBUG_E2E) {
      console.log(`[vivid-commenter:stdout] ${line}`)
    }
  })

  proc.stderr?.on('data', (data) => {
    const line = data.toString()
    logs.push(`[vivid-commenter:stderr] ${line}`)
    if (process.env.DEBUG_E2E) {
      console.error(`[vivid-commenter:stderr] ${line}`)
    }
  })

  proc.on('error', (err) => {
    logs.push(`[vivid-commenter:error] ${err.message}`)
    console.error('vivid-commenter process error:', err)
  })

  return {
    process: proc,
    port: AGENT_PORT,
    name: 'vivid-commenter',
    logs,
  }
}

/**
 * Start the minimal test agent for file creation tests
 */
export async function startTestFileAgent(): Promise<ServiceProcess> {
  const logs: string[] = []

  const proc = spawn('python3', ['main.py'], {
    cwd: TEST_AGENT_DIR,
    env: {
      ...process.env,
      PORT: String(TEST_AGENT_PORT),
      PYTHONPATH: '/Users/syum/dev/pixell-sdk',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Capture logs
  proc.stdout?.on('data', (data) => {
    const line = data.toString()
    logs.push(`[test-file-agent:stdout] ${line}`)
    if (process.env.DEBUG_E2E) {
      console.log(`[test-file-agent:stdout] ${line}`)
    }
  })

  proc.stderr?.on('data', (data) => {
    const line = data.toString()
    logs.push(`[test-file-agent:stderr] ${line}`)
    if (process.env.DEBUG_E2E) {
      console.error(`[test-file-agent:stderr] ${line}`)
    }
  })

  proc.on('error', (err) => {
    logs.push(`[test-file-agent:error] ${err.message}`)
    console.error('test-file-agent process error:', err)
  })

  return {
    process: proc,
    port: TEST_AGENT_PORT,
    name: 'test-file-agent',
    logs,
  }
}

/**
 * Wait for a service to become healthy
 */
export async function waitForHealthy(
  url: string,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 1000
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) {
        return
      }
    } catch {
      // Service not ready yet
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  throw new Error(`Service at ${url} not healthy after ${timeoutMs}ms`)
}

/**
 * Stop a service process
 */
export async function stopProcess(service: ServiceProcess): Promise<void> {
  if (!service.process || service.process.killed) {
    return
  }

  return new Promise((resolve) => {
    service.process.on('close', () => {
      resolve()
    })

    // Try graceful shutdown first
    service.process.kill('SIGTERM')

    // Force kill after 5 seconds
    setTimeout(() => {
      if (!service.process.killed) {
        service.process.kill('SIGKILL')
      }
      resolve()
    }, 5000)
  })
}

/**
 * Kill any processes already using the service ports
 */
export async function killExistingProcesses(): Promise<void> {
  const ports = [ORCHESTRATOR_PORT, AGENT_PORT, TEST_AGENT_PORT]

  for (const port of ports) {
    try {
      // Find process using the port (macOS/Linux)
      const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || true`)
      const pids = stdout.trim().split('\n').filter(Boolean)

      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`)
          console.log(`Killed existing process ${pid} on port ${port}`)
        } catch {
          // Process might have already exited
        }
      }
    } catch {
      // lsof not available or no process found
    }
  }

  // Give processes time to release ports
  await new Promise((r) => setTimeout(r, 1000))
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || true`)
    return !stdout.trim()
  } catch {
    return true // Assume available if we can't check
  }
}

/**
 * Get service URLs
 */
export const serviceUrls = {
  orchestrator: {
    base: `http://localhost:${ORCHESTRATOR_PORT}`,
    health: `http://localhost:${ORCHESTRATOR_PORT}/health`,
    chatStream: `http://localhost:${ORCHESTRATOR_PORT}/api/chat/stream`,
    a2aStream: `http://localhost:${ORCHESTRATOR_PORT}/api/chat/a2a/stream`,
    chatRespond: `http://localhost:${ORCHESTRATOR_PORT}/api/chat/respond`,
  },
  agent: {
    base: `http://localhost:${AGENT_PORT}`,
    health: `http://localhost:${AGENT_PORT}/health`,
    filesDownload: `http://localhost:${AGENT_PORT}/files/download`,
  },
  testAgent: {
    base: `http://localhost:${TEST_AGENT_PORT}`,
    health: `http://localhost:${TEST_AGENT_PORT}/health`,
    filesDownload: `http://localhost:${TEST_AGENT_PORT}/files/download`,
  },
}

/**
 * Print service logs (useful for debugging test failures)
 */
export function printServiceLogs(service: ServiceProcess): void {
  console.log(`\n=== ${service.name} logs ===`)
  service.logs.forEach((log) => console.log(log))
  console.log(`=== end ${service.name} logs ===\n`)
}
