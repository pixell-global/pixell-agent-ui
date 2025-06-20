# Pixell-Agent-Framework Implementation Steps

> **Goal**: Build an open-source UI framework for AI agents that's easy to build, deploy, and extend

## Phase 1: Foundation & MVP (Weeks 1-4)
*Target: Basic chat interface + OpenAI integration + Docker deployment*

### 1.1 Project Setup & Tooling
```bash
# Initialize monorepo structure
npx create-turbo@latest pixell-agent-framework
```

**Directory Structure:**
```
pixell-agent-framework/
├── apps/
│   ├── web/              # Main React app
│   ├── api/              # Backend API
│   └── cli/              # CLI tool
├── packages/
│   ├── ui/               # shadcn/ui components
│   ├── types/            # Shared TypeScript types
│   ├── core/             # Core agent logic
│   └── adapters/         # LLM & protocol adapters
├── examples/
│   └── simple-chat/      # Example implementation
└── docs/                 # Documentation
```

**Tech Stack Setup:**
- **Monorepo**: Turborepo for build orchestration
- **Frontend**: Vite + React 18 + TypeScript
- **Backend**: Fastify + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand + TanStack Query
- **Real-time**: tRPC + WebSocket
- **Testing**: Vitest + Playwright
- **Linting**: ESLint + Prettier + TypeScript strict mode

### 1.2 Core Type Definitions (`packages/types`)
```typescript
// Agent types
export interface Agent {
  id: string;
  name: string;
  description?: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  avatarUrl?: string;
  metadata?: Record<string, any>;
}

// Message types  
export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  messageType: 'text' | 'plan' | 'progress' | 'alert';
  timestamp: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

// Task & Graph types
export interface Task {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused';
  progress: number; // 0-100
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// Plugin interfaces
export interface LLMAdapter {
  name: string;
  initialize(config: any): Promise<void>;
  chat(messages: Message[]): AsyncIterable<string>;
  complete(prompt: string): Promise<string>;
}

export interface ProtocolAdapter {
  name: string;
  connect(): Promise<void>;
  send(message: any): Promise<void>;
  subscribe(callback: (data: any) => void): void;
}
```

### 1.3 Basic UI Components (`packages/ui`)
**Install shadcn/ui and create core components:**
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input textarea card badge
```

**Core Components:**
- `ChatInterface` - Main chat component with streaming support
- `MessageBubble` - Individual message renderer 
- `TaskStatus` - Task status indicator
- `ThreeColumnLayout` - Main app layout
- `FileExplorer` - Basic file tree (Phase 1: mock data)

### 1.4 Backend API Foundation (`apps/api`)
```typescript
// Basic Fastify server with tRPC
import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createTRPCRouter } from './trpc';

const server = Fastify();

// tRPC router
const appRouter = createTRPCRouter({
  chat: chatRouter,
  tasks: taskRouter,
  agents: agentRouter,
});

// WebSocket for real-time updates
server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: { router: appRouter }
});

export type AppRouter = typeof appRouter;
```

**Key API Routes:**
- `POST /api/chat` - Send message to agent
- `GET /api/chat/stream` - WebSocket for real-time responses
- `GET /api/tasks` - Get all tasks
- `PUT /api/tasks/:id` - Update task status

### 1.5 OpenAI Adapter (`packages/adapters`)
```typescript
export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  
  async initialize(config: { apiKey: string, model?: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
  }
  
  async *chat(messages: Message[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    });
    
    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}
```

### 1.6 Simple Docker Setup
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  pixell-agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

## Phase 2: Plugin Architecture & CLI (Weeks 5-8)

### 2.1 Plugin SDK (`packages/core`)
```typescript
// Plugin manager
export class PluginManager {
  private adapters = new Map<string, LLMAdapter>();
  private protocols = new Map<string, ProtocolAdapter>();
  
  registerLLMAdapter(name: string, adapter: LLMAdapter) {
    this.adapters.set(name, adapter);
  }
  
  async loadPlugin(path: string) {
    const plugin = await import(path);
    if (plugin.llmAdapter) {
      this.registerLLMAdapter(plugin.name, plugin.llmAdapter);
    }
  }
}

// Agent registry
export interface AgentCapability {
  id: string;
  name: string;
  critical: boolean;
  exposed_ui: 'chat' | 'activity' | 'none';
  timeout_sec: number;
  protocol: string;
  cost_estimate: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
}
```

### 2.2 CLI Tool (`apps/cli`)
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { createProject } from './commands/create';
import { dev } from './commands/dev';
import { build } from './commands/build';

const program = new Command();

program
  .name('pixell-agent')
  .description('CLI for Pixell Agent Framework')
  .version('0.1.0');

program
  .command('create <name>')
  .description('Create a new agent app')
  .action(createProject);

program
  .command('dev')
  .description('Start development server')
  .action(dev);

program.parse();
```

**CLI Commands:**
- `npx create-pixell-agent my-app` - Scaffold new project
- `pixell-agent dev` - Start dev server with hot reload
- `pixell-agent build` - Build for production
- `pixell-agent add-adapter <name>` - Install LLM adapter

### 2.3 Multiple LLM Adapters
**Anthropic Adapter:**
```typescript
export class AnthropicAdapter implements LLMAdapter {
  async *chat(messages: Message[]): AsyncIterable<string> {
    // Anthropic implementation
  }
}
```

**Ollama Adapter:**
```typescript
export class OllamaAdapter implements LLMAdapter {
  async *chat(messages: Message[]): AsyncIterable<string> {
    // Ollama local implementation
  }
}
```

### 2.4 Configuration System
```typescript
// pixell.config.ts
export default {
  agents: {
    default: 'openai',
    providers: {
      openai: {
        adapter: '@pixell/adapter-openai',
        config: { model: 'gpt-4' }
      },
      anthropic: {
        adapter: '@pixell/adapter-anthropic', 
        config: { model: 'claude-3' }
      }
    }
  },
  ui: {
    theme: 'default',
    layout: 'three-column'
  }
};
```

## Phase 3: Advanced Features (Weeks 9-12)

### 3.1 Task Graph Visualization
```typescript
// Graph visualizer using React Flow
import ReactFlow, { Node, Edge } from 'reactflow';

export function TaskGraphViewer({ tasks }: { tasks: Task[] }) {
  const nodes: Node[] = tasks.map(task => ({
    id: task.id,
    data: { label: task.name, status: task.status },
    position: calculatePosition(task), // Auto-layout
  }));
  
  return (
    <ReactFlow 
      nodes={nodes} 
      edges={edges}
      nodeTypes={{ task: TaskNode }}
    />
  );
}
```

### 3.2 Protocol Implementation (MCP & A2A)
```typescript
// MCP Protocol Adapter
export class MCPAdapter implements ProtocolAdapter {
  private ws: WebSocket;
  
  async connect() {
    this.ws = new WebSocket('ws://localhost:8080/mcp');
  }
  
  async send(message: any) {
    this.ws.send(JSON.stringify({
      version: '0.3',
      type: 'message',
      payload: message
    }));
  }
}

// A2A Protocol for agent discovery
export class A2AAdapter implements ProtocolAdapter {
  async discoverAgents(): Promise<Agent[]> {
    // Implement A2A discovery protocol
  }
}
```

### 3.3 File System Integration
```typescript
// File explorer with real file system
export function FileExplorer() {
  const { data: files } = useQuery({
    queryKey: ['files'],
    queryFn: () => api.files.list()
  });
  
  return (
    <TreeView
      data={files}
      onSelect={handleFileSelect}
      onDragStart={handleDragStart}
    />
  );
}
```

### 3.4 Advanced State Management
```typescript
// Zustand stores with persistence
export const useUIStore = create(
  persist(
    (set) => ({
      leftPanelOpen: true,
      rightPanelOpen: true,
      theme: 'light',
      toggleLeftPanel: () => set(state => ({ 
        leftPanelOpen: !state.leftPanelOpen 
      })),
    }),
    { name: 'ui-store' }
  )
);

// Server state with TanStack Query
export const useChatMessages = () => {
  return useInfiniteQuery({
    queryKey: ['messages'],
    queryFn: ({ pageParam = 0 }) => 
      api.chat.getMessages({ offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
};
```

## Phase 4: Production Ready (Weeks 13-16)

### 4.1 Authentication System
```typescript
// Auth.js integration
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export const { handlers, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        role: token.role as 'admin' | 'developer' | 'viewer',
      },
    }),
  },
});
```

### 4.2 Security Hardening
- **CSP Headers**: Content Security Policy
- **Input Sanitization**: XSS prevention
- **Rate Limiting**: API protection
- **CORS Configuration**: Cross-origin security
- **Environment Variables**: Secure config management

### 4.3 Performance Optimization
```typescript
// Virtual scrolling for large message lists
import { FixedSizeList as List } from 'react-window';

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <List
      height={600}
      itemCount={messages.length}
      itemSize={80}
      itemData={messages}
    >
      {MessageItem}
    </List>
  );
}

// React.memo for expensive components
export const TaskGraphViewer = memo(({ tasks }) => {
  // Expensive graph calculation
}, (prevProps, nextProps) => {
  return prevProps.tasks.length === nextProps.tasks.length;
});
```

### 4.4 Testing Strategy
```typescript
// Unit tests with Vitest
describe('OpenAIAdapter', () => {
  it('should stream messages correctly', async () => {
    const adapter = new OpenAIAdapter();
    await adapter.initialize({ apiKey: 'test' });
    
    const messages = [{ role: 'user', content: 'Hello' }];
    const stream = adapter.chat(messages);
    
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    expect(chunks.length).toBeGreaterThan(0);
  });
});

// E2E tests with Playwright
test('complete chat flow', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid=chat-input]', 'Hello AI');
  await page.click('[data-testid=send-button]');
  
  await expect(page.locator('[data-testid=message]')).toBeVisible();
});
```

### 4.5 Documentation & Developer Experience
```markdown
# Quick Start Guide

## Installation
```bash
npx create-pixell-agent my-agent-app
cd my-agent-app
npm run dev
```

## Adding an LLM Provider
```typescript
// pixell.config.ts
export default {
  agents: {
    providers: {
      myLLM: {
        adapter: './adapters/my-llm',
        config: { apiKey: process.env.MY_LLM_KEY }
      }
    }
  }
};
```
```

## Phase 5: Deployment & Distribution (Weeks 17-20)

### 5.1 Deployment Options
```yaml
# Kubernetes Helm Chart
apiVersion: v2
name: pixell-agent
version: 1.0.0
dependencies:
  - name: redis
    version: "^16.0.0"
    repository: https://charts.bitnami.com/bitnami
```

```dockerfile
# Multi-stage production Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### 5.2 NPM Package Distribution
```json
{
  "name": "pixell-agent-framework",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "bin": {
    "create-pixell-agent": "./bin/create.js",
    "pixell-agent": "./bin/cli.js"
  },
  "exports": {
    ".": "./dist/index.js",
    "./ui": "./dist/ui/index.js",
    "./adapters": "./dist/adapters/index.js"
  }
}
```

### 5.3 CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI/CD
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t pixell-agent .
      - run: docker push pixell-agent:latest
```

## Developer Experience Priorities

### Easy Build Process
1. **One-command setup**: `npx create-pixell-agent`
2. **Zero configuration**: Works out of the box
3. **Hot reload**: Instant development feedback
4. **TypeScript first**: Full type safety
5. **Modern tooling**: Vite, ESBuild, etc.

### Easy Deployment
1. **Docker ready**: Single container deployment
2. **Environment based**: Configuration via env vars
3. **Cloud agnostic**: Works on any platform
4. **Scaling ready**: Stateless architecture

### Easy Extension
1. **Plugin API**: Simple adapter interfaces
2. **Configuration driven**: No code changes needed
3. **Type safe**: Full TypeScript support
4. **Hot swappable**: Runtime provider switching

## Success Metrics & Validation

### Developer Experience Metrics
- [ ] **Setup time**: < 2 minutes from `npx` to running app
- [ ] **First agent**: < 30 minutes to custom implementation
- [ ] **Provider swap**: < 5 minutes to switch LLM providers
- [ ] **Build time**: < 30 seconds for development builds
- [ ] **Bundle size**: < 500KB gzipped for core UI

### Quality Gates
- [ ] **Test coverage**: > 80% for core packages
- [ ] **Performance**: < 200ms UI interactions
- [ ] **Accessibility**: WCAG 2.1 AA compliance
- [ ] **Security**: Automated vulnerability scanning
- [ ] **Documentation**: Every public API documented

This implementation plan prioritizes developer experience while building a robust, extensible framework that makes AI agent development as simple as possible. 