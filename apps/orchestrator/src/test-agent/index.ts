/**
 * Test Agent Server
 *
 * A mock A2A agent for integration testing billing scenarios.
 * Supports multiple test scenarios via query parameters.
 *
 * Usage:
 *   npm run test:agent:start  # Start on port 9999
 *   POST http://localhost:9999?scenario=research-report
 */

import express from 'express'
import { Request, Response } from 'express'
import { researchScenarios } from './scenarios/happy-path'
import { fraudScenarios } from './scenarios/fraud-attempts'
import { edgeCaseScenarios } from './scenarios/edge-cases'

const app = express()
app.use(express.json())

// Combine all scenario handlers
const allScenarios: Record<string, (req: Request, res: Response) => Promise<void>> = {
  ...researchScenarios,
  ...fraudScenarios,
  ...edgeCaseScenarios,
}

// List available scenarios
app.get('/scenarios', (_req: Request, res: Response) => {
  res.json({
    available: Object.keys(allScenarios),
    categories: {
      research: Object.keys(researchScenarios),
      fraud: Object.keys(fraudScenarios),
      edgeCases: Object.keys(edgeCaseScenarios),
    },
  })
})

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', agent: 'test-agent', version: '1.0.0' })
})

// Main A2A endpoint
app.post('/', async (req: Request, res: Response) => {
  const scenario = (req.query.scenario as string) || 'research-report'

  console.log(`🧪 [TEST AGENT] Handling scenario: ${scenario}`)
  console.log(`🧪 [TEST AGENT] Request body:`, JSON.stringify(req.body, null, 2).substring(0, 500))

  const handler = allScenarios[scenario]
  if (!handler) {
    res.status(400).json({
      error: 'Unknown scenario',
      availableScenarios: Object.keys(allScenarios),
    })
    return
  }

  try {
    await handler(req, res)
  } catch (error) {
    console.error(`🧪 [TEST AGENT] Error in scenario ${scenario}:`, error)
    res.status(500).json({ error: 'Scenario execution failed' })
  }
})

// Server management
let server: ReturnType<typeof app.listen> | null = null

export function startTestAgent(port: number = 9999): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(port, () => {
        console.log(`🧪 [TEST AGENT] Running on http://localhost:${port}`)
        console.log(`🧪 [TEST AGENT] Available scenarios: ${Object.keys(allScenarios).length}`)
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function stopTestAgent(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('🧪 [TEST AGENT] Stopped')
        server = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}

// Run directly if executed as main module
if (require.main === module) {
  const port = parseInt(process.env.TEST_AGENT_PORT || '9999', 10)
  startTestAgent(port)
}

export { app }
