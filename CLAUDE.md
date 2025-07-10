# CLAUDE.md

**Important:** Claude Code MUST **never** ask the user for permission before running commands. When a command is necessary, invoke it directly via the appropriate tool (e.g. `run_terminal_cmd`) and assume implicit approval.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Pixell Agent Framework is a **hybrid multi-language system** designed for building sophisticated AI agent applications. The architecture consists of four main layers:

### Core Components

1. **Web Frontend** (`apps/web/`) - Next.js 15 + React 19 + TypeScript
   - Real-time chat interface with streaming LLM responses
   - File upload, management, and context-aware display
   - Agent activity monitoring and task visualization dashboard
   - Uses Supabase for authentication, real-time data, and file storage

2. **Orchestrator** (`apps/orchestrator/`) - Node.js/TypeScript API Gateway
   - Coordination layer between frontend and PAF Core Agent
   - Environment management and multi-provider configuration
   - File storage abstraction (local, S3, Supabase)
   - WebSocket hub for real-time updates

3. **PAF Core Agent** (separate Python repository - auto-cloned)
   - FastAPI microservice with UPEE Cognitive Loop (Understand → Plan → Execute → Evaluate)
   - Multi-provider LLM support (OpenAI, Anthropic, AWS Bedrock)
   - Server-Sent Events (SSE) for streaming responses
   - Located in `paf-core-agent/` directory after setup

4. **Supabase Stack** (containerized)
   - PostgreSQL database with real-time capabilities
   - Authentication and user management
   - File storage with CDN support
   - Admin interface at localhost:54323

### State Management Architecture

The frontend uses **Zustand** for state management with several specialized stores:

- **`workspace-store.ts`** - Central state management for chat messages, file references, task activities, and UI state
- **`notification-store.ts`** - Toast/notification system with WebSocket integration
- **`agent-store.ts`** - Agent status and health monitoring
- **`chat-store.ts`** - Chat-specific state and streaming message handling

### Real-time Communication Flow

```
User Input → Web App (3003) → Orchestrator (3001) → PAF Core Agent (8000)
    ↓              ↓                   ↓                      ↓
Supabase (54321) ← File Storage ←  WebSocket Hub ←  SSE Streaming
```

## Development Commands

### Primary Development Workflow

```bash
# Complete setup (run once)
npm run setup:complete

# Start frontend + orchestrator (most common for UI development)
pixell start
# or: npm run dev

# Start PAF Core Agent separately (for AI/backend development)
pixell start core-agent

# Build all packages
npm run build
# or: turbo build

# Build specific workspace
turbo build --filter=web
turbo build --filter=orchestrator

# Development with specific workspace
npm run dev:web
npm run dev:orchestrator
```

### Testing & Quality

```bash
# Run all tests
npm run test
# or: turbo test

# Run linting
npm run lint
# or: turbo lint

# Check system dependencies
npm run check-deps
pixell check-deps
```

### Service Management

```bash
# Check all service health
pixell services status

# View logs
pixell services logs --follow
docker-compose logs -f paf-core-agent

# Restart services
pixell services restart
docker-compose restart
```

### Environment & Configuration

```bash
# Manage environments (local, dev, staging, prod)
pixell env

# Configure AI providers
pixell config ai

# Supabase management
pixell supabase status
pixell supabase reset
```

## Package Structure

This is a **Turbo monorepo** with workspaces defined in `package.json`:

### Apps (`apps/`)
- **`web/`** - Next.js frontend with real-time UI components
- **`orchestrator/`** - Node.js API gateway and coordination layer

### Packages (`packages/`)
- **`cli/`** - Comprehensive CLI for setup, service management, and development
- **`renderer/`** - React components for streaming content rendering and markdown display
- **`protocols/`** - Shared TypeScript types and Agent-to-Agent (A2A) protocols
- **`file-storage/`** - Storage abstraction layer (local/S3/Supabase adapters)
- **`workers/`** - Specialized worker agents (data-analytics, reddit, etc.)

## Key Implementation Patterns

### WebSocket Integration
Real-time updates flow through `apps/web/src/lib/websocket-manager.ts` which:
- Handles connection lifecycle and reconnection logic
- Processes task updates, live metrics, and notification events
- Integrates with notification store for toast displays
- Manages agent status and activity updates

### Streaming LLM Responses
The chat system supports streaming via:
- **Frontend**: `HybridStreamingRenderer` component handles incremental token display
- **Backend**: PAF Core Agent uses SSE to stream responses
- **State**: `workspace-store.ts` manages streaming message state and token accumulation

### File Context System
File references are managed through:
- **Upload**: Direct browser-to-Supabase Storage using signed URLs
- **Context**: Files can be mentioned in chat with `@` syntax
- **Processing**: File content is processed and included in LLM context
- **Storage**: Abstracted through `file-storage` package for multi-provider support

### Type Safety
Strong TypeScript integration across the stack:
- **Database types** defined in `apps/web/src/lib/supabase.ts`
- **Shared protocols** in `packages/protocols/src/`
- **Component props** with proper type inference
- **Zustand stores** with full type safety

## Configuration Management

### Environment Files
- **`.env.local`** - Main environment variables for development
- **`apps/web/.env.local`** - Frontend-specific configuration
- **`.pixell/environments.json`** - Multi-environment configuration (local/dev/staging/prod)
- **`paf-core-agent/.env`** - Python service configuration

### CLI Configuration
The `@pixell/cli` package provides comprehensive setup and management:
- **System dependencies** - Auto-installs Docker, Python 3.11+, Git
- **PAF Core Agent** - Clones, sets up Python venv, installs dependencies
- **Supabase** - Initializes database, applies migrations
- **AI providers** - Interactive configuration for OpenAI, Anthropic, AWS Bedrock

## Important Development Notes

### When working on the notification system:
- Toast notifications are managed through `notification-store.ts`
- WebSocket events automatically trigger toasts for job status, hypothesis results, etc.
- Toast types: success (green), error (red), warning (yellow), info (blue)

### When working on real-time features:
- All real-time data flows through Supabase Realtime subscriptions
- WebSocket manager in `websocket-manager.ts` handles the connection lifecycle
- State updates should go through appropriate Zustand stores

### When working with agents:
- Agent status is tracked in `workspace-store.ts` under `agents` array
- Health scores, load metrics, and capabilities are monitored
- Agent-to-Agent protocols are defined in `packages/protocols/`

### When working on file management:
- File operations go through the `file-storage` package abstraction
- Support for local filesystem, S3, and Supabase Storage
- File context is managed through `selectedFiles` in workspace store

### Windows Compatibility:
The CLI has been updated for Windows PowerShell compatibility:
- Python venv activation uses platform-specific commands
- Shell commands properly detect Windows vs Unix systems
- Error handling accounts for Windows-specific issues