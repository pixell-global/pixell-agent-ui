/**
 * LLM Auditor Service
 *
 * Uses an LLM to verify billing claims:
 * 1. Type verification - is the claimed type correct?
 * 2. Quality verification - does the output meet quality thresholds?
 */

import Anthropic from '@anthropic-ai/sdk'

/**
 * Audit result returned by the LLM auditor
 */
export interface AuditResult {
  approved: boolean
  actualType: 'research' | 'ideation' | 'auto_posting' | 'monitors' | null
  qualityScore: number // 0-100
  reason: string
}

/**
 * Input for the audit function
 */
export interface AuditInput {
  claimedType: string
  userPrompt: string
  agentResponseSummary: string
  outputArtifacts: Record<string, unknown>[]
  detectionSource: string
}

/**
 * Configuration for the LLM auditor
 */
export interface LLMAuditorConfig {
  // Model to use for auditing
  model: string
  // Maximum tokens for response
  maxTokens: number
  // Temperature for generation
  temperature: number
  // Minimum quality score to approve
  minQualityScore: number
}

const DEFAULT_CONFIG: LLMAuditorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  temperature: 0.3,
  minQualityScore: 50,
}

/**
 * Create the audit prompt
 */
function createAuditPrompt(input: AuditInput): string {
  const artifactsSummary = input.outputArtifacts
    .map((a, i) => {
      const size = a.size ? ` (${a.size} bytes)` : ''
      return `  ${i + 1}. Type: ${a.type || 'unknown'}, Name: ${a.name || 'unnamed'}${size}`
    })
    .join('\n') || '  (none)'

  return `You are a billing auditor for an AI agent platform. Evaluate whether a billing claim is valid.

## Context

User's request:
${input.userPrompt || '(not provided)'}

Agent's response summary:
${input.agentResponseSummary || '(not provided)'}

Output artifacts:
${artifactsSummary}

Detection source: ${input.detectionSource}
Claimed action type: ${input.claimedType}

## Evaluation Criteria

1. **TYPE MATCH**: Is the claimed type (${input.claimedType}) accurate?
   - research: Produced analysis, report, data insights, or answered analytical questions
   - ideation: Generated content ideas, suggestions, creative drafts, or brainstorming
   - auto_posting: Scheduled or published content to a platform
   - monitors: Created an ongoing monitoring job

2. **QUALITY**: Does the output meet quality thresholds?
   - For research: Is analysis substantive? Data-backed? Actionable?
   - For ideation: Are suggestions relevant? Creative? Actionable?
   - For auto_posting: Was content actually scheduled with valid details?
   - For monitors: Is monitor configuration valid and useful?

## Response Format

Respond with a JSON object only (no markdown, no explanation):
{
  "approved": boolean,
  "actualType": "research" | "ideation" | "auto_posting" | "monitors" | null,
  "qualityScore": 0-100,
  "reason": "brief explanation (max 100 chars)"
}`
}

/**
 * Parse the LLM response into an AuditResult
 */
function parseAuditResponse(response: string): AuditResult {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      approved: Boolean(parsed.approved),
      actualType: parsed.actualType || null,
      qualityScore: typeof parsed.qualityScore === 'number' ? parsed.qualityScore : 0,
      reason: String(parsed.reason || 'No reason provided').substring(0, 200),
    }
  } catch (error) {
    console.error('🔍 [LLM AUDITOR] Failed to parse response:', error, response)
    return {
      approved: false,
      actualType: null,
      qualityScore: 0,
      reason: 'Failed to parse audit response',
    }
  }
}

/**
 * Audit a billing claim using LLM
 */
export async function auditBillingClaim(
  input: AuditInput,
  config: Partial<LLMAuditorConfig> = {}
): Promise<AuditResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Check if API key is available
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('🔍 [LLM AUDITOR] No ANTHROPIC_API_KEY - auto-approving')
    return {
      approved: true,
      actualType: input.claimedType as AuditResult['actualType'],
      qualityScore: 75,
      reason: 'Auto-approved: LLM auditor not configured',
    }
  }

  console.log('🔍 [LLM AUDITOR] Auditing claim:', {
    claimedType: input.claimedType,
    detectionSource: input.detectionSource,
    artifactCount: input.outputArtifacts.length,
  })

  const client = new Anthropic({ apiKey })
  const prompt = createAuditPrompt(input)

  try {
    const response = await client.messages.create({
      model: finalConfig.model,
      max_tokens: finalConfig.maxTokens,
      temperature: finalConfig.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text from response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    const result = parseAuditResponse(textContent.text)

    console.log('🔍 [LLM AUDITOR] Audit result:', result)

    // Apply quality threshold
    if (result.approved && result.qualityScore < finalConfig.minQualityScore) {
      result.approved = false
      result.reason = `Quality score (${result.qualityScore}) below threshold (${finalConfig.minQualityScore})`
    }

    return result
  } catch (error) {
    console.error('🔍 [LLM AUDITOR] Error calling LLM:', error)

    // On error, don't block billing but flag for manual review
    return {
      approved: true,
      actualType: input.claimedType as AuditResult['actualType'],
      qualityScore: 50,
      reason: 'LLM audit failed - approved pending manual review',
    }
  }
}

/**
 * Quick heuristic check without LLM (for pre-filtering)
 */
export function quickAuditCheck(input: AuditInput): {
  needsLLMAudit: boolean
  potentialIssues: string[]
} {
  const issues: string[] = []

  // Check for no evidence
  if (
    input.outputArtifacts.length === 0 &&
    !input.agentResponseSummary &&
    input.detectionSource === 'sdk'
  ) {
    issues.push('SDK billing claim with no output artifacts or response summary')
  }

  // Check for type mismatches based on artifact names
  if (input.outputArtifacts.length > 0) {
    const names = input.outputArtifacts.map(a => (String(a.name || '')).toLowerCase()).join(' ')
    const types = input.outputArtifacts.map(a => (String(a.type || '')).toLowerCase()).join(' ')
    const combined = names + ' ' + types

    const researchKeywords = ['report', 'analysis', 'research', 'data', 'insight']
    const ideationKeywords = ['content', 'idea', 'calendar', 'suggestion', 'draft']

    const hasResearchIndicators = researchKeywords.some(k => combined.includes(k))
    const hasIdeationIndicators = ideationKeywords.some(k => combined.includes(k))

    if (input.claimedType === 'research' && hasIdeationIndicators && !hasResearchIndicators) {
      issues.push('Research claimed but artifacts suggest ideation')
    }
    if (input.claimedType === 'ideation' && hasResearchIndicators && !hasIdeationIndicators) {
      issues.push('Ideation claimed but artifacts suggest research')
    }
  }

  return {
    needsLLMAudit: issues.length > 0 || input.detectionSource === 'sdk',
    potentialIssues: issues,
  }
}
