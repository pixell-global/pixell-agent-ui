import { EmptyStateContext, AIDecision, EmptyStateType } from './types'
import { useEmptyStateStore } from './store'

export class EmptyStateAIController {
  private apiKey: string
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo', temperature: number = 0.7, maxTokens: number = 500) {
    this.apiKey = apiKey
    this.model = model
    this.temperature = temperature
    this.maxTokens = maxTokens
  }

  async analyzeAndDecide(context: EmptyStateContext): Promise<AIDecision> {
    const store = useEmptyStateStore.getState()
    
    // Check cache first
    const contextHash = store.generateContextHash(context)
    const cachedDecision = store.getCachedDecision(contextHash)
    if (cachedDecision) {
      return cachedDecision
    }

    try {
      const decision = await this.callOpenAI(context)
      
      // Cache the decision
      store.setCachedDecision(contextHash, decision)
      
      return decision
    } catch (error) {
      console.error('AI decision failed:', error)
      
      // Return fallback decision
      return this.getFallbackDecision(context)
    }
  }

  private async callOpenAI(context: EmptyStateContext): Promise<AIDecision> {
    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt(context)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    return this.parseAIResponse(content)
  }

  private buildSystemPrompt(): string {
    return `You are an AI assistant that helps decide what empty state to show in a developer tool called "Pixell Agent Framework". 

Available empty state types:
1. "welcome" - Simple welcome message with getting started prompts
2. "feature-preview" - Preview cards showing what activities will look like when active
3. "contextual-hints" - Dynamic hints based on current workspace context

Your job is to analyze the user's context and choose the most appropriate empty state type, plus generate relevant dynamic content.

Respond with a JSON object in this exact format:
{
  "stateType": "welcome|feature-preview|contextual-hints",
  "dynamicContent": {
    "title": "Optional title",
    "description": "Optional description",
    "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
    "actions": [
      {
        "label": "Action label",
        "variant": "primary|secondary|ghost"
      }
    ]
  },
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this state was chosen"
}`
  }

  private buildUserPrompt(context: EmptyStateContext): string {
    const { userProfile, workspaceState, interactionHistory } = context

    return `Analyze this user context and choose the best empty state:

User Profile:
- New user: ${userProfile.isNewUser}
- Last active: ${userProfile.lastActiveTime.toISOString()}
- Preferred workflow: ${userProfile.preferredWorkflow}

Workspace State:
- Has active files: ${workspaceState.hasActiveFiles}
- Project type: ${workspaceState.currentProject.type}
- Recent activity count: ${workspaceState.recentActivity.length}

Interaction History:
- Recent prompts: ${interactionHistory.recentPrompts.slice(-3).join(', ')}
- Clicked features: ${interactionHistory.clickedFeatures.slice(-5).join(', ')}
- Dismissed states: ${interactionHistory.dismissedStates.join(', ')}

Choose the most appropriate empty state and generate relevant content.`
  }

  private parseAIResponse(content: string): AIDecision {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      // Validate the response structure
      if (!parsed.stateType || !['welcome', 'feature-preview', 'contextual-hints'].includes(parsed.stateType)) {
        throw new Error('Invalid state type')
      }

      return {
        stateType: parsed.stateType as EmptyStateType,
        dynamicContent: parsed.dynamicContent,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'AI decision'
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      throw new Error('Invalid AI response format')
    }
  }

  private getFallbackDecision(context: EmptyStateContext): AIDecision {
    // Simple fallback logic based on context
    if (context.userProfile.isNewUser) {
      return {
        stateType: 'welcome',
        dynamicContent: {
          title: 'Welcome to Activities',
          description: 'Your agent activities will appear here when you start working.',
          suggestions: [
            'Start a conversation with an AI agent',
            'Upload files to analyze',
            'Try asking: "Help me analyze this project"'
          ]
        },
        confidence: 0.6,
        reasoning: 'Fallback: New user detected'
      }
    }

    if (context.workspaceState.hasActiveFiles) {
      return {
        stateType: 'contextual-hints',
        dynamicContent: {
          title: 'Ready to Assist',
          description: 'I can help you with your current project.',
          suggestions: [
            'Analyze your project structure',
            'Review your code for improvements',
            'Generate documentation'
          ]
        },
        confidence: 0.6,
        reasoning: 'Fallback: Active files detected'
      }
    }

    return {
      stateType: 'feature-preview',
      dynamicContent: {
        title: 'Activities Preview',
        description: 'Here\'s what you can expect to see when activities are active.',
        suggestions: [
          'Live task progress',
          'Agent status updates',
          'Real-time metrics'
        ]
      },
      confidence: 0.6,
      reasoning: 'Fallback: Default feature preview'
    }
  }
}
