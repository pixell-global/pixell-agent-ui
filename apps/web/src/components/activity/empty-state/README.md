# Empty State System

This directory contains an AI-driven empty state system for the Activity Pane that dynamically chooses between different empty state components based on user context.

## Architecture

The system consists of several key components:

### Core Components

- **`EmptyActivityPane`** - Main container component that orchestrates the entire system
- **`EmptyStateAIController`** - Handles OpenAI API calls for intelligent state selection
- **`EmptyStateRenderer`** - Renders the AI-selected empty state component
- **`useEmptyStateStore`** - Zustand store for state management and caching

### Empty State Types

1. **`welcome`** - Simple welcome message with getting started prompts
2. **`feature-preview`** - Preview cards showing what activities will look like when active
3. **`contextual-hints`** - Dynamic hints based on current workspace context
4. **`loading`** - Shows while AI is analyzing context
5. **`error`** - Fallback state when AI decision fails

### Individual State Components

- **`WelcomeMessage`** - New user onboarding with suggestions
- **`FeaturePreview`** - Preview of upcoming activity features
- **`ContextualHints`** - Context-aware suggestions and quick actions
- **`LoadingState`** - Loading indicator with message
- **`ErrorState`** - Error display with retry option

## Usage

### Basic Usage

```tsx
import { EmptyActivityPane } from '@/components/activity/empty-state'

// Simple usage
<EmptyActivityPane />

// With custom configuration
<EmptyActivityPane
  apiKey="your-openai-api-key"
  onStateChange={(newState) => console.log('State changed:', newState)}
  onUserInteraction={(interaction) => console.log('User interaction:', interaction)}
/>
```

### Direct Component Usage

```tsx
import { WelcomeMessage, FeaturePreview, ContextualHints } from '@/components/activity/empty-state'

// Use individual components directly
<WelcomeMessage
  title="Custom Welcome"
  description="Custom description"
  suggestions={['Custom suggestion 1', 'Custom suggestion 2']}
/>
```

## Configuration

### Environment Variables

Set your OpenAI API key in your environment:

```bash
NEXT_PUBLIC_OPENAI_API_KEY=your-api-key-here
```

### AI Configuration

The AI controller can be configured with different models and parameters:

```tsx
const aiController = new EmptyStateAIController(
  apiKey,
  'gpt-3.5-turbo', // model
  0.7,             // temperature
  500              // max tokens
)
```

## Context Analysis

The system analyzes several factors to make intelligent decisions:

### User Profile
- New user status
- Last active time
- Preferred workflow

### Workspace State
- Active files presence
- Recent activity
- Current project information

### Interaction History
- Recent prompts
- Clicked features
- Dismissed states

## Caching

The system includes intelligent caching to avoid repeated API calls:

- Context-based cache keys
- 5-minute cache expiration
- Automatic cache invalidation
- Fallback to local decision logic

## Extensibility

### Adding New State Types

1. Add the new type to `EmptyStateType` in `types.ts`
2. Create a new component in `components/`
3. Add the case to `EmptyStateRenderer`
4. Update the AI system prompt to include the new type

### Custom States

```tsx
<EmptyActivityPane
  customStates={{
    'my-custom-state': MyCustomComponent
  }}
/>
```

## Performance Considerations

- AI decisions are cached to minimize API calls
- Components are lazy-loaded when possible
- Context analysis is debounced to avoid excessive re-analysis
- Fallback mechanisms ensure the system always works

## Error Handling

The system includes comprehensive error handling:

- API failures fall back to local decision logic
- Invalid AI responses are handled gracefully
- Network issues don't break the user experience
- Error states provide clear feedback and retry options

## Future Enhancements

- Multi-model AI decision making
- A/B testing framework
- Advanced analytics and learning
- Custom AI providers
- Real-time context updates
