/**
 * Memory Extraction Service
 *
 * Background service that extracts memories from conversations using LLM.
 * Runs as a background job to process pending extraction requests.
 */

import { MemoriesRepo, ConversationsRepo } from '@pixell/db-mysql'
import { getPafCoreAgentUrl } from '../utils/environments'

// Initialize repositories
const memoriesRepo = new MemoriesRepo()
const conversationsRepo = new ConversationsRepo()

// Extraction prompt for LLM
const EXTRACTION_PROMPT = `You are a memory extraction assistant. Analyze the following conversation and extract important facts that should be remembered for future conversations.

Extract the following categories:
1. **User Preferences** (user_preference): Writing style, tone preferences, format preferences, communication style
2. **Project Context** (project_context): Current projects, goals, deadlines, team members
3. **Domain Knowledge** (domain_knowledge): Industry-specific terms, product knowledge, technical details
4. **Conversation Goals** (conversation_goal): Recurring tasks, workflows, patterns

For each memory, provide:
- category: one of [user_preference, project_context, domain_knowledge, conversation_goal, entity]
- key: a short unique identifier in snake_case (e.g., "preferred_tone", "current_project")
- value: the actual fact to remember (concise but complete, under 500 chars)
- confidence: 0.0-1.0 based on how explicit/clear the information was

Rules:
- Only extract facts explicitly stated or clearly implied
- Keep values concise (under 500 chars)
- Assign lower confidence (0.5-0.7) to inferred facts
- Assign higher confidence (0.8-1.0) to explicitly stated facts
- Focus on information that would be useful in future conversations
- Do not extract temporary or session-specific information
- Do not extract sensitive information (passwords, API keys, etc.)

If no useful memories can be extracted, return an empty array.

Conversation:
{conversation}

Respond with ONLY a valid JSON array (no markdown, no explanation):
[{ "category": "...", "key": "...", "value": "...", "confidence": 0.95 }]`

export interface ExtractedMemory {
  category: 'user_preference' | 'project_context' | 'domain_knowledge' | 'conversation_goal' | 'entity'
  key: string
  value: string
  confidence: number
}

export interface ExtractionResult {
  success: boolean
  memoriesExtracted: number
  memoriesUpdated: number
  error?: string
}

/**
 * Queue a conversation for memory extraction
 */
export async function queueExtraction(userId: string, conversationId: string): Promise<string> {
  const job = await memoriesRepo.createExtractionJob(userId, conversationId)
  console.log(`📋 Queued extraction job ${job.id} for conversation ${conversationId}`)
  return job.id
}

/**
 * Process a single extraction job
 */
export async function processExtractionJob(jobId: string): Promise<ExtractionResult> {
  try {
    // Get the job
    const job = await memoriesRepo.getExtractionJob(jobId)

    if (!job) {
      return { success: false, memoriesExtracted: 0, memoriesUpdated: 0, error: 'Job not found' }
    }

    // Mark as processing
    await memoriesRepo.updateExtractionJob(jobId, { status: 'processing' })

    // Load conversation messages
    const messages = await conversationsRepo.getMessages(job.conversationId)

    // Skip if too short (less than 5 messages)
    if (messages.length < 5) {
      await memoriesRepo.updateExtractionJob(jobId, {
        status: 'completed',
        memoriesExtracted: 0,
        memoriesUpdated: 0
      })
      return { success: true, memoriesExtracted: 0, memoriesUpdated: 0 }
    }

    // Format conversation for LLM
    const conversationText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')

    // Extract memories using LLM
    const extractedMemories = await extractMemoriesWithLLM(conversationText)

    if (extractedMemories.length === 0) {
      await memoriesRepo.updateExtractionJob(jobId, {
        status: 'completed',
        memoriesExtracted: 0,
        memoriesUpdated: 0
      })
      return { success: true, memoriesExtracted: 0, memoriesUpdated: 0 }
    }

    // Upsert memories
    let created = 0
    let updated = 0

    for (const memory of extractedMemories) {
      try {
        const result = await memoriesRepo.upsert(job.userId, {
          category: memory.category,
          key: memory.key,
          value: memory.value,
          confidence: memory.confidence,
          source: 'auto_extracted',
          sourceConversationId: job.conversationId,
          metadata: {
            originalText: conversationText.substring(0, 500)
          }
        })

        if (result.isNew) {
          created++
        } else {
          updated++
        }
      } catch (upsertError) {
        console.warn(`⚠️ Failed to upsert memory ${memory.key}:`, upsertError)
      }
    }

    // Mark job as completed
    await memoriesRepo.updateExtractionJob(jobId, {
      status: 'completed',
      memoriesExtracted: created,
      memoriesUpdated: updated
    })

    console.log(`✅ Extraction job ${jobId} completed: ${created} new, ${updated} updated`)

    return {
      success: true,
      memoriesExtracted: created,
      memoriesUpdated: updated
    }

  } catch (error) {
    console.error(`❌ Extraction job ${jobId} failed:`, error)

    // Mark job as failed
    await memoriesRepo.updateExtractionJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      success: false,
      memoriesExtracted: 0,
      memoriesUpdated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Extract memories from conversation text using LLM
 */
async function extractMemoriesWithLLM(conversationText: string): Promise<ExtractedMemory[]> {
  try {
    const coreAgentUrl = await getPafCoreAgentUrl()

    // Prepare the prompt
    const prompt = EXTRACTION_PROMPT.replace('{conversation}', conversationText)

    // Call PAF Core Agent for extraction
    const response = await fetch(`${coreAgentUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        model: 'gpt-4o-mini', // Use faster model for extraction
        temperature: 0.3, // Lower temperature for consistent output
        show_thinking: false
      })
    })

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`)
    }

    // Process SSE stream to get response
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]') continue

            try {
              const event = JSON.parse(dataStr)
              if (event.type === 'content' && event.delta?.content) {
                fullContent += event.delta.content
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }

    // Parse the JSON response
    const jsonMatch = fullContent.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('⚠️ No JSON array found in LLM response')
      return []
    }

    const memories: ExtractedMemory[] = JSON.parse(jsonMatch[0])

    // Validate and filter memories
    const validMemories = memories.filter(m => {
      const validCategories = ['user_preference', 'project_context', 'domain_knowledge', 'conversation_goal', 'entity']
      return (
        validCategories.includes(m.category) &&
        typeof m.key === 'string' && m.key.length > 0 &&
        typeof m.value === 'string' && m.value.length > 0 &&
        typeof m.confidence === 'number' && m.confidence >= 0 && m.confidence <= 1
      )
    })

    console.log(`🧠 LLM extracted ${validMemories.length} valid memories`)

    return validMemories

  } catch (error) {
    console.error('❌ LLM extraction failed:', error)
    return []
  }
}

/**
 * Process all pending extraction jobs
 * Called by background job scheduler
 */
export async function processPendingJobs(limit: number = 10): Promise<number> {
  const jobs = await memoriesRepo.getPendingExtractionJobs(limit)

  if (jobs.length === 0) {
    return 0
  }

  console.log(`📋 Processing ${jobs.length} pending extraction jobs`)

  let processed = 0
  for (const job of jobs) {
    try {
      await processExtractionJob(job.id)
      processed++
    } catch (error) {
      console.error(`❌ Failed to process job ${job.id}:`, error)
    }
  }

  return processed
}

/**
 * Start the background extraction processor
 * Runs every 5 minutes
 */
let processorInterval: NodeJS.Timeout | null = null

export function startExtractionProcessor(intervalMs: number = 300000): void {
  if (processorInterval) {
    console.log('⚠️ Extraction processor already running')
    return
  }

  console.log('🚀 Starting memory extraction processor')

  // Initial run
  processPendingJobs().catch(console.error)

  // Schedule recurring runs
  processorInterval = setInterval(() => {
    processPendingJobs().catch(console.error)
  }, intervalMs)
}

export function stopExtractionProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval)
    processorInterval = null
    console.log('🛑 Stopped memory extraction processor')
  }
}
