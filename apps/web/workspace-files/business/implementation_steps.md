# Pixell Agent Framework - Implementation Steps

> **🚨 CRITICAL STATE MANAGEMENT GUIDELINES FOR AI DEVELOPERS:**
> 
> **DO NOT USE `useState` FOR SHARED STATE** - This leads to prop drilling, re-render issues, and unmaintainable code
> 
> **✅ DO USE:**
> - **Zustand stores** for all shared application state (tasks, agents, messages, UI state)
> - **Custom hooks** to encapsulate complex logic and side effects
> - **TanStack Query + Supabase** for server state management and caching
> - **`useState` ONLY** for truly local component state (input focus, toggle visibility, form inputs)
> 
> **📋 STATE HIERARCHY:**
> 1. **Server State**: TanStack Query + Supabase real-time subscriptions
> 2. **Global Client State**: Zustand stores (agents, tasks, UI preferences)
> 3. **Component State**: Custom hooks for encapsulated logicJob
> 4. **Local State**: `useState` for simple, isolated component state only

## Overview

Implementation plan based on **corrected PRD evaluation** that respects:
- AWS Strand as core agent runtime (swappable via adapters)  
- A2A protocol for agent-to-agent communication
- MCP protocol for tool integration
- WebSocket streaming for real-time UX
- Three-panel UI from design guide

## Project Structure (Reference)

```
pixell-agent-framework/
├── apps/
│   ├── web/                        # Frontend (Next.js + shadcn/ui)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── globals.css     # Design tokens from guide
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   └── api/
│   │   │   │       ├── a2a/        # A2A protocol endpoints
│   │   │   │       ├── mcp/        # MCP protocol endpoints
│   │   │   │       └── streaming/  # WebSocket handlers
│   │   │   ├── components/
│   │   │   │   ├── ui/             # shadcn/ui components
│   │   │   │   ├── layout/
│   │   │   │   │   └── AgentWorkspaceLayout.tsx
│   │   │   │   ├── agents/         # Left pane (Agents)
│   │   │   │   │   ├── AgentsPane.tsx
│   │   │   │   │   ├── AgentCard.tsx
│   │   │   │   │   └── AgentList.tsx
│   │   │   │   ├── chat/           # Center pane (Chat)
│   │   │   │   │   ├── ChatWorkspace.tsx
│   │   │   │   │   ├── MessageList.tsx
│   │   │   │   │   ├── ChatMessage.tsx
│   │   │   │   │   ├── PlanCard.tsx
│   │   │   │   │   └── ChatInput.tsx
│   │   │   │   └── activity/       # Right pane (Activity)
│   │   │   │       ├── ActivityPane.tsx
│   │   │   │       ├── TaskCard.tsx
│   │   │   │       ├── ActivityFeed.tsx
│   │   │   │       └── LiveMetrics.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-a2a-client.ts
│   │   │   │   ├── use-mcp-provider.ts
│   │   │   │   ├── use-supabase.ts
│   │   │   │   └── use-agent-store.ts
│   │   │   ├── lib/
│   │   │   │   ├── design-tokens.ts # From design guide
│   │   │   │   ├── supabase.ts      # Supabase client config
│   │   │   │   ├── a2a-client.ts
│   │   │   │   └── mcp-client.ts
│   │   │   ├── stores/
│   │   │   │   ├── agent-store.ts   # Agent state management
│   │   │   │   ├── task-store.ts    # Task state management
│   │   │   │   └── ui-store.ts      # UI state management
│   │   │   └── types/
│   │   │       ├── a2a.ts
│   │   │       ├── mcp.ts
│   │   │       └── agent.ts
│   │   └── package.json
│   │
│   └── orchestrator/              # Core Agent Server
│       ├── src/
│       │   ├── core/              # 🧠 AWS Strand integration
│       │   │   ├── StrandAdapter.ts
│       │   │   ├── CoreAgent.ts
│       │   │   ├── IntentParser.ts
│       │   │   ├── TaskPlanner.ts
│       │   │   └── TaskExecutor.ts
│       │   ├── protocols/
│       │   │   ├── a2a/           # A2A server implementation
│       │   │   │   ├── A2AServer.ts
│       │   │   │   ├── AgentRegistry.ts
│       │   │   │   └── TaskCoordinator.ts
│       │   │   └── mcp/           # MCP server implementation
│       │   │       ├── MCPServer.ts
│       │   │       └── ToolProvider.ts
│       │   └── streaming/
│       │       ├── WebSocketManager.ts
│       │       └── SSEManager.ts
│       └── package.json
│
├── packages/
│   ├── workers/                   # 🤖 Worker Agent Implementations
│   │   ├── reddit-agent/
│   │   │   ├── src/
│   │   │   │   ├── RedditAgent.ts # A2A compliant
│   │   │   │   ├── agent-card.json
│   │   │   │   └── tools/
│   │   │   └── package.json
│   │   ├── search-agent/
│   │   │   ├── src/
│   │   │   │   ├── SearchAgent.ts
│   │   │   │   └── agent-card.json
│   │   │   └── package.json
│   │   └── content-agent/
│   │       ├── src/
│   │       │   ├── ContentAgent.ts
│   │       │   └── agent-card.json
│   │       └── package.json
│   │
│   ├── protocols/                 # 📡 Protocol implementations
│   │   ├── a2a/
│   │   │   ├── src/
│   │   │   │   ├── types.ts
│   │   │   │   ├── client.ts
│   │   │   │   └── server.ts
│   │   │   └── package.json
│   │   ├── mcp/
│   │   │   ├── src/
│   │   │   │   ├── types.ts
│   │   │   │   ├── client.ts
│   │   │   │   └── provider.ts
│   │   │   └── package.json
│   │   └── shared/
│   │       ├── src/
│   │       │   ├── Agent.ts
│   │       │   ├── Task.ts
│   │       │   └── Message.ts
│   │       └── package.json
│   │
│   └── ui/                        # 🎨 Shared UI components
│       ├── src/
│       │   ├── components/
│   │   ├── themes/
│   │   └── tokens/
│   │
│   └── package.json
│
├── examples/
│   ├── basic-multi-agent/
│   └── custom-worker/
│
└── scripts/
    ├── setup.sh
    ├── docker-compose.yml
    └── .env.example
```

---

## Phase 0: Package Installation & Build Verification (3-5 days)

> **🚨 CRITICAL**: This phase focuses **EXCLUSIVELY** on getting the correct package versions installed and building successfully. NO implementation should happen here - only setup and verification.

### Prerequisites & System Requirements

**Required Software Versions (Based on Latest Compatibility Research):**
- **Node.js**: 18.18.0 or later (**NOT 18.16.1** - causes Next.js 15 build failures)
  - ✅ **Recommended**: Node.js 20.x LTS for optimal Next.js 15 compatibility
  - ✅ **Minimum**: 18.18.0 (breaking change from 18.16.x for Next.js 15)
  - Check version: `node --version`
- **Package Manager**: npm 10.5.0+ (or pnpm 8.x, yarn 4.x)
- **Operating Systems**: macOS, Windows (including WSL), or Linux

### Day 1: Node.js Environment Setup

```bash
# Check current Node.js version - CRITICAL STEP
node --version

# ⚠️ If below 18.18.0, you MUST update Node.js before proceeding
# Option 1: Using nvm (recommended for macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc  # or ~/.zshrc
nvm install 20
nvm use 20
nvm alias default 20

# Option 2: Using n (macOS/Linux alternative)
sudo npm install -g n
sudo n 20

# Option 3: Manual download for Windows
# Visit: https://nodejs.org/en/download/
# Download Node.js 20.x LTS installer

# ✅ VERIFY: Node.js version is 18.18.0 or higher
node --version
npm --version

# Should show Node 18.18.0+ or 20.x, npm 10.5.0+
```

### Day 2: Project Initialization with Exact Compatible Versions

```bash
# Initialize monorepo workspace
npx create-turbo@latest pixell-agent-framework --package-manager npm
cd pixell-agent-framework

# Frontend setup with Next.js 15 (latest stable with React 19 support)
npx create-next-app@15.1.6 apps/web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd apps/web

# ✅ CRITICAL: Install exact compatible versions based on web research
# Next.js 15 with React 19 (stable combination as of December 2024)
npm install next@15.1.6 react@19.0.0 react-dom@19.0.0

# ⚠️ IMPORTANT: Zustand 5.x supports React 19 and Next.js 15
# Requires "use client" directive and proper hook naming (useStore not store)
npm install zustand@5.0.3

# Database and real-time features (compatible with Next.js 15 App Router)
npm install @supabase/supabase-js@2.47.0 @supabase/ssr@0.9.0

# Data fetching with React 19 compatibility
npm install @tanstack/react-query@5.61.5

# UI framework setup
npx shadcn@latest init --yes
npx shadcn@latest add avatar badge button dialog progress tabs card input textarea separator

# TypeScript and development dependencies
npm install -D @types/node@22.10.5 typescript@5.7.3 @types/react@^19.0.0 @types/react-dom@^19.0.0
```

### Day 3: Backend Dependencies & Supabase Setup

```bash
# Navigate back to project root
cd ../..

# Create orchestrator service
mkdir -p apps/orchestrator
cd apps/orchestrator

# Initialize with compatible dependencies
npm init -y

# Core backend dependencies (Express.js with WebSocket support)
npm install express@4.21.2 ws@8.18.0 cors@2.8.5

# AWS integration dependencies (placeholder for Strand integration)
npm install @aws-sdk/client-bedrock@3.716.0 @aws-sdk/client-lambda@3.716.0

# Protocol implementations
npm install axios@1.7.9 zod@3.24.1 uuid@10.0.0

# Development dependencies with proper TypeScript support
npm install -D @types/express@5.0.0 @types/ws@8.5.13 @types/cors@2.8.17 @types/uuid@10.0.0
npm install -D tsx@4.19.2 nodemon@3.1.7 typescript@5.7.3

# Add package.json scripts for development
npm pkg set scripts.dev="tsx src/index.ts"
npm pkg set scripts.build="tsc"
npm pkg set scripts.start="node dist/index.js"

# Navigate back to project root for Supabase setup
cd ../..

# Install Supabase CLI globally (latest stable)
npm install -g supabase@1.212.5

# Initialize Supabase project (this creates local development environment)
npx supabase init

# Start local Supabase instance (PostgreSQL + API)
npx supabase start

# ✅ CRITICAL: Verify Supabase is running properly
npx supabase status
```

### Day 4: Environment Configuration & Build Testing

```bash
# Create environment files with proper Next.js 15 configuration
cat > apps/web/.env.local << 'EOF'
# Supabase configuration (local development)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_supabase_status
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase_status

# Development flags
NODE_ENV=development
EOF

# Create minimal TypeScript config for orchestrator
cat > apps/orchestrator/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": false,
    "esModuleInterop": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create minimal orchestrator entry point for testing
mkdir -p apps/orchestrator/src
cat > apps/orchestrator/src/index.ts << 'EOF'
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pixell Agent Framework Orchestrator' });
});

app.listen(port, () => {
  console.log(`🚀 Orchestrator running on http://localhost:${port}`);
});
EOF
```

### Day 5: Build Verification & Compatibility Testing

```bash
# Test Next.js application build (CRITICAL: Must succeed without errors)
cd apps/web
npm run build

# ✅ Expected: Successful build with Next.js 15 + React 19
# ❌ If build fails: Check Node.js version (must be 18.18.0+)

# Test development server
npm run dev &
DEV_PID=$!

# Verify app starts on http://localhost:3000
sleep 5
curl -f http://localhost:3000 > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Next.js app running successfully"
else
  echo "❌ Next.js app failed to start"
fi

# Stop development server
kill $DEV_PID

# Navigate to orchestrator and test build
cd ../orchestrator

# Test TypeScript compilation
npm run build

# Test orchestrator development server
npm run dev &
ORCH_PID=$!

# Verify orchestrator health endpoint
sleep 3
curl -f http://localhost:3001/health
if [ $? -eq 0 ]; then
  echo "✅ Orchestrator running successfully"
else
  echo "❌ Orchestrator failed to start"
fi

# Stop orchestrator
kill $ORCH_PID

# Final verification: Check Supabase local instance
cd ../..
npx supabase status

echo ""
echo "🎉 PHASE 0 COMPLETE - Package Installation & Build Verification"
echo ""
echo "✅ Verified Versions:"
echo "   Node.js: $(node --version) (Required: 18.18.0+)"
echo "   Next.js: 15.1.6 (Latest stable with React 19)"
echo "   React: 19.0.0 (Stable)"
echo "   Zustand: 5.0.3 (React 19 compatible)"
echo "   Supabase: Running locally"
echo ""
```

### Package Version Compatibility Matrix (December 2024)

| Package | Version | Compatibility | Notes |
|---------|---------|---------------|-------|
| **Node.js** | 18.18.0+ | ✅ Required | Next.js 15 breaking change from 18.16.x |
| **Next.js** | 15.1.6 | ✅ Latest Stable | Supports React 19, App Router stable |
| **React** | 19.0.0 | ✅ Stable | Released October 2024, stable with Next.js 15 |
| **Zustand** | 5.0.3 | ✅ Compatible | Full React 19 support, 3.5M+ weekly downloads |
| **Supabase** | 2.47.0 | ✅ Compatible | Next.js 15 App Router support |
| **TanStack Query** | 5.61.5 | ✅ Compatible | React 19 support added |

### Critical Phase 0 Deliverables:

- ✅ **Node.js 18.18.0+ installed** and verified (required for Next.js 15)
- ✅ **Next.js 15.1.6 application building successfully** with React 19
- ✅ **Zustand 5.0.3 installed** with proper React 19 compatibility
- ✅ **Supabase local instance running** without errors
- ✅ **All packages installing** without peer dependency warnings
- ✅ **TypeScript compilation working** for both frontend and backend
- ✅ **Development servers starting** without runtime errors
- ✅ **Environment variables configured** for local development

> **🚨 STOP**: Do not proceed to Phase 1 until ALL Phase 0 deliverables are verified and working. Any build failures or version incompatibilities must be resolved first.

---

## Phase 1: Core Infrastructure & UI Foundation (2 weeks)

> **⚠️ STATE MANAGEMENT WARNING**: Use Zustand stores for shared state, custom hooks for encapsulated logic, and Supabase real-time subscriptions for server state. Only use `useState` for truly local component state. Follow Zustand 5.x naming conventions with "use" prefix (e.g., `useAgentStore` not `agentStore`).

### Week 1: Database Schema & Design System

**Day 1-2: Supabase Database Schema**

```sql
-- Run migration: supabase/migrations/001_initial_schema.sql
-- Users (managed by Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'developer' CHECK (role IN ('admin', 'developer', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('creator', 'keyword', 'analytics', 'custom')),
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'error')),
  capabilities JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'paused')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES tasks(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own agents" ON agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own agents" ON agents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Seed data
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('00000000-0000-0000-0000-000000000000', 'demo@pixell.com', 'Demo User', 'admin');
```

**Day 3-4: Design System Implementation**

```typescript
// apps/web/src/lib/design-tokens.ts - From design guide
export const designTokens = {
  colors: {
    agents: {
      creator: {
        primary: 'hsl(271 91% 65%)',
        bg: 'hsl(270 100% 98%)',
        border: 'hsl(270 95% 90%)',
        text: 'hsl(271 91% 45%)'
      },
      keyword: {
        primary: 'hsl(142 76% 36%)',
        bg: 'hsl(142 76% 98%)',
        border: 'hsl(142 76% 85%)',
        text: 'hsl(142 76% 25%)'
      },
      analytics: {
        primary: 'hsl(217 91% 60%)',
        bg: 'hsl(217 91% 98%)',
        border: 'hsl(217 91% 85%)',
        text: 'hsl(217 91% 40%)'
      }
    },
    status: {
      running: 'hsl(142 76% 36%)',
      waiting: 'hsl(45 93% 47%)',
      done: 'hsl(217 91% 60%)',
      paused: 'hsl(215 16% 47%)',
      error: 'hsl(0 84% 60%)'
    }
  },
  layout: {
    workspace: {
      desktop: 'grid-cols-[280px,1fr,340px]',
      tablet: 'grid-cols-[250px,1fr,300px]',
      mobile: 'grid-cols-1'
    }
  }
};
```

**Day 5-6: Supabase Client Configuration**

```typescript
// apps/web/src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// Custom hook
// apps/web/src/hooks/use-supabase.ts
'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function useSupabase() {
  const [client] = useState(() => createClient())
  const [user, setUser] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await client.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [client])

  return { client, user }
}
```

**Day 7: Zustand Stores Setup**

```typescript
// apps/web/src/stores/agent-store.ts
'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface Agent {
  id: string
  name: string
  description?: string
  type: 'creator' | 'keyword' | 'analytics' | 'custom'
  status: 'idle' | 'running' | 'paused' | 'error'
  capabilities: Record<string, any>
  config: Record<string, any>
  userId: string
  createdAt: string
  updatedAt: string
}

interface AgentStore {
  agents: Agent[]
  selectedAgentId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  removeAgent: (id: string) => void
  selectAgent: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Getters
  getAgentsByType: (type: Agent['type']) => Agent[]
  getSelectedAgent: () => Agent | null
}

export const useAgentStore = create<AgentStore>()(
  subscribeWithSelector((set, get) => ({
    agents: [],
    selectedAgentId: null,
    isLoading: false,
    error: null,
    
    setAgents: (agents) => set({ agents }),
    
    addAgent: (agent) => set((state) => ({ 
      agents: [...state.agents, agent] 
    })),
    
    updateAgent: (id, updates) => set((state) => ({
      agents: state.agents.map(agent => 
        agent.id === id ? { ...agent, ...updates } : agent
      )
    })),
    
    removeAgent: (id) => set((state) => ({
      agents: state.agents.filter(agent => agent.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId
    })),
    
    selectAgent: (id) => set({ selectedAgentId: id }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    getAgentsByType: (type) => get().agents.filter(agent => agent.type === type),
    getSelectedAgent: () => {
      const { agents, selectedAgentId } = get()
      return agents.find(agent => agent.id === selectedAgentId) || null
    },
  }))
)

// apps/web/src/stores/task-store.ts
'use client'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface Task {
  id: string
  name: string
  description?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'paused'
  progress: number
  agentId: string
  userId: string
  parentTaskId?: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface TaskStore {
  tasks: Task[]
  selectedTaskId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  selectTask: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Getters
  getTasksByStatus: (status: Task['status']) => Task[]
  getTasksByAgent: (agentId: string) => Task[]
  getSelectedTask: () => Task | null
  getRecentTasks: (limit?: number) => Task[]
}

export const useTaskStore = create<TaskStore>()(
  subscribeWithSelector((set, get) => ({
    tasks: [],
    selectedTaskId: null,
    isLoading: false,
    error: null,
    
    setTasks: (tasks) => set({ tasks }),
    
    addTask: (task) => set((state) => ({ 
      tasks: [...state.tasks, task] 
    })),
    
    updateTask: (id, updates) => set((state) => ({
      tasks: state.tasks.map(task => 
        task.id === id ? { ...task, ...updates } : task
      )
    })),
    
    removeTask: (id) => set((state) => ({
      tasks: state.tasks.filter(task => task.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId
    })),
    
    selectTask: (id) => set({ selectedTaskId: id }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    getTasksByStatus: (status) => get().tasks.filter(task => task.status === status),
    getTasksByAgent: (agentId) => get().tasks.filter(task => task.agentId === agentId),
    getSelectedTask: () => {
      const { tasks, selectedTaskId } = get()
      return tasks.find(task => task.id === selectedTaskId) || null
    },
    
    getRecentTasks: (limit = 10) => {
      const tasks = get().tasks
      return tasks
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit)
    },
  }))
)
```

### Week 2: Three-Panel Layout & Real-time Integration

**Day 8-10: Three-Panel Layout Implementation**

```typescript
// apps/web/src/components/layout/AgentWorkspaceLayout.tsx
'use client'
import { useAgentStore } from '@/stores/agent-store'
import { useTaskStore } from '@/stores/task-store'
import { AgentsPane } from '@/components/agents/AgentsPane'
import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { ActivityPane } from '@/components/activity/ActivityPane'

export function AgentWorkspaceLayout() {
  return (
    <div className="h-screen bg-background">
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pixell Agent Framework</h1>
      </header>
      
      <div className="h-[calc(100vh-3.5rem)] grid grid-cols-workspace gap-0">
        <AgentsPane />     {/* Left: Agent list & status */}
        <ChatWorkspace />  {/* Center: Conversation */}
        <ActivityPane />   {/* Right: Activity feed & metrics */}
      </div>
    </div>
  );
}

// apps/web/src/components/agents/AgentsPane.tsx
'use client'
import { useAgentStore } from '@/stores/agent-store'
import { AgentCard } from './AgentCard'

export function AgentsPane() {
  const { agents, selectedAgentId, selectAgent } = useAgentStore()

  return (
    <div className="border-r bg-muted/10 p-4">
      <h2 className="text-lg font-semibold mb-4">Agents</h2>
      <div className="space-y-2">
        {agents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={selectedAgentId === agent.id}
            onSelect={() => selectAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  )
}

// apps/web/src/components/activity/ActivityPane.tsx
'use client'
import { useTaskStore } from '@/stores/task-store'
import { ActivityFeed } from './ActivityFeed'
import { LiveMetrics } from './LiveMetrics'

export function ActivityPane() {
  return (
    <div className="border-l bg-muted/10 p-4">
      <h2 className="text-lg font-semibold mb-4">Activity</h2>
      
      <div className="space-y-6">
        <LiveMetrics />
        <ActivityFeed />
      </div>
    </div>
  )
}
```

**Day 11-14: Real-time Supabase Integration**

```typescript
// apps/web/src/hooks/use-realtime-agents.ts
'use client'
import { useSupabase } from './use-supabase'
import { useAgentStore } from '@/stores/agent-store'
import { useEffect } from 'react'
import type { Agent } from '@/stores/agent-store'

export function useRealtimeAgents(userId: string) {
  const { client } = useSupabase()
  const { setAgents, addAgent, updateAgent, removeAgent, setLoading, setError } = useAgentStore()

  useEffect(() => {
    if (!userId) return

    // Initial fetch
    const fetchAgents = async () => {
      setLoading(true)
      try {
        const { data, error } = await client
          .from('agents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setAgents(data || [])
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()

    // Subscribe to real-time changes
    const subscription = client
      .channel('agents')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'agents',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addAgent(payload.new as Agent)
          } else if (payload.eventType === 'UPDATE') {
            updateAgent(payload.new.id, payload.new as Partial<Agent>)
          } else if (payload.eventType === 'DELETE') {
            removeAgent(payload.old.id)
          }
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(subscription)
    }
  }, [client, userId, setAgents, addAgent, updateAgent, removeAgent, setLoading, setError])

  return { fetchAgents: () => useAgentStore.getState().agents }
}

// apps/web/src/hooks/use-realtime-tasks.ts
'use client'
import { useSupabase } from './use-supabase'
import { useTaskStore } from '@/stores/task-store'
import { useEffect } from 'react'
import type { Task } from '@/stores/task-store'

export function useRealtimeTasks(userId: string) {
  const { client } = useSupabase()
  const { setTasks, addTask, updateTask, removeTask, setLoading, setError } = useTaskStore()

  useEffect(() => {
    if (!userId) return

    // Initial fetch
    const fetchTasks = async () => {
      setLoading(true)
      try {
        const { data, error } = await client
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setTasks(data || [])
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch tasks')
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()

    // Subscribe to real-time changes
    const subscription = client
      .channel('tasks')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addTask(payload.new as Task)
          } else if (payload.eventType === 'UPDATE') {
            updateTask(payload.new.id, payload.new as Partial<Task>)
          } else if (payload.eventType === 'DELETE') {
            removeTask(payload.old.id)
          }
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(subscription)
    }
  }, [client, userId, setTasks, addTask, updateTask, removeTask, setLoading, setError])

  return { fetchTasks: () => useTaskStore.getState().tasks }
}

// apps/web/src/app/page.tsx
'use client'
import { useSupabase } from '@/hooks/use-supabase'
import { useRealtimeAgents } from '@/hooks/use-realtime-agents'
import { useRealtimeTasks } from '@/hooks/use-realtime-tasks'
import { AgentWorkspaceLayout } from '@/components/layout/AgentWorkspaceLayout'

export default function HomePage() {
  const { user } = useSupabase()
  
  // Initialize real-time subscriptions
  useRealtimeAgents(user?.id || '')
  useRealtimeTasks(user?.id || '')

  if (!user) {
    return <div>Please log in to continue</div>
  }

  return <AgentWorkspaceLayout />
}
```

**Phase 1 Deliverables:**
- ✅ Complete Supabase database schema with RLS
- ✅ Zustand stores for agents, tasks, and UI state
- ✅ Three-panel UI matching design guide exactly
- ✅ Real-time Supabase subscriptions working
- ✅ Agent branding colors (creator=purple, keyword=green, analytics=blue)
- ✅ All responsive breakpoints functional

---

## Phase 2: AWS Strand Integration (2 weeks)

> **⚠️ STATE MANAGEMENT WARNING**: Continue avoiding `useState` for shared state. Create dedicated Zustand stores for agent runtime state, task execution state, and worker agent registries. Use React Query/TanStack Query with Supabase for server state caching and synchronization.

### Week 3: Core Agent Runtime

**Day 15-17: AWS Strand Adapter**
```typescript
// apps/orchestrator/src/core/StrandAdapter.ts
export class StrandAdapter implements AgentRuntimeAdapter {
  private strand: AWSStrand;

  async createRuntime(config: RuntimeConfig): Promise<CoreAgentRuntime> {
    this.strand = new AWSStrand({
      region: config.aws.region,
      credentials: config.aws.credentials
    });

    return {
      understanding: new StrandIntentParser(this.strand),
      planning: new StrandTaskPlanner(this.strand),
      execution: new StrandTaskExecutor(this.strand),
      evaluation: new StrandResultEvaluator(this.strand),
      guardrails: new StrandPolicyEngine(this.strand)
    };
  }
}
```

**Day 18-19: Worker Agent Templates**
```typescript
// packages/workers/reddit-agent/src/RedditAgent.ts
export class RedditAgent implements A2AAgent {
  card: AgentCard = {
    id: 'reddit-commenter',
    name: 'Reddit Comment Automation',
    domain: 'social-media',
    protocol: 'a2a',
    exposed_ui: 'activity',
    capabilities: { streaming: true, pushNotifications: true }
  };

  async delegateTask(task: Task): Promise<TaskResult> {
    // Reddit-specific logic
    switch (task.type) {
      case 'comment':
        return this.postComment(task.params);
      case 'analyze':
        return this.analyzeSentiment(task.params);
    }
  }
}
```

**Day 20-21: Activity Feed & Status Tracking**
```typescript
// apps/web/src/components/activity/ActivityFeed.tsx
'use client'
import { useTaskStore } from '@/stores/task-store'
import { useMemo } from 'react'

export function ActivityFeed() {
  const { tasks, getTasksByStatus } = useTaskStore()
  
  const statusCounts = useMemo(() => ({
    running: getTasksByStatus('running').length,
    succeeded: getTasksByStatus('succeeded').length,
    queued: getTasksByStatus('queued').length,
    failed: getTasksByStatus('failed').length
  }), [getTasksByStatus])
  
  const recentTasks = useMemo(() => 
    tasks
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
  , [tasks])
  
  return (
    <div className="space-y-4">
      {/* Status Counts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{statusCounts.running}</div>
          <div className="text-sm text-green-700">Running</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{statusCounts.succeeded}</div>
          <div className="text-sm text-blue-700">Done</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{statusCounts.queued}</div>
          <div className="text-sm text-yellow-700">Waiting</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{statusCounts.failed}</div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
      </div>
      
      {/* Recent Activity Feed */}
      <div>
        <h3 className="font-semibold mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {recentTasks.map(task => (
            <TaskCard 
              key={task.id}
              task={task}
              showProgress={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Week 4: Multi-Agent Orchestration

**Day 22-24: Agent Registry & Discovery**
```typescript
// apps/orchestrator/src/protocols/a2a/AgentRegistry.ts
export class AgentRegistry {
  private agents = new Map<string, A2AAgent>();

  async registerAgent(agent: A2AAgent): Promise<void> {
    const card = await agent.discoverCapabilities();
    this.agents.set(card.id, agent);
    
    // Notify UI of new agent
    this.notifyAgentAdded(card);
  }

  async findAgentsForTask(task: Task): Promise<A2AAgent[]> {
    // Score agents based on capabilities, load, cost
    return Array.from(this.agents.values())
      .filter(agent => this.canHandleTask(agent, task))
      .sort((a, b) => this.scoreAgent(a, task) - this.scoreAgent(b, task));
  }
}
```

**Day 25-28: Complete Integration**
```typescript
// apps/orchestrator/src/core/CoreAgent.ts
export class CoreAgent {
  constructor(
    private strand: StrandAdapter,
    private registry: AgentRegistry,
    private mcpProvider: MCPProvider
  ) {}

  async processUserMessage(message: string): Promise<void> {
    // 1. Parse intent using Strand
    const intent = await this.strand.understanding.parseIntent(message);
    
    // 2. Create execution plan
    const plan = await this.strand.planning.createPlan(intent);
    
    // 3. Find worker agents via A2A
    const agents = await this.registry.findAgentsForTask(plan.tasks[0]);
    
    // 4. Execute via WebSocket streaming
    this.executeWithStreaming(plan, agents);
  }
}
```

**Phase 2 Deliverables:**
- ✅ AWS Strand integration with adapter pattern
- ✅ 3 working A2A worker agents (Reddit, Search, Content)
- ✅ Real-time activity feed with status counts and progress tracking
- ✅ Agent registry with automatic discovery
- ✅ End-to-end multi-agent orchestration

---

## Phase 3: Developer Experience (4 weeks)

> **⚠️ STATE MANAGEMENT WARNING**: Maintain strict state management discipline in CLI tooling and plugin system. Use configuration stores for CLI state, plugin registries via Zustand, and custom hooks for complex state logic. Avoid `useState` in favor of proper state architecture patterns.

### Week 5-6: CLI Tooling
```bash
# CLI commands for developer productivity
npx create-pixell-agent my-app --template=multi-agent
npx pixell generate worker --domain=custom --tools=api,database
npx pixell deploy --platform=docker
npx pixell runtime swap --from=aws-strand --to=langgraph
```

### Week 7-8: Plugin Marketplace
- A2A worker agent templates
- MCP provider plugins  
- Activity Pane UI components
- Runtime adapters (LangGraph, OpenAI Assistants)

**Phase 3 Deliverables:**
- ✅ CLI tooling for rapid development
- ✅ Plugin marketplace with verified workers
- ✅ Runtime swapping capability
- ✅ Developer documentation complete
- ✅ 5 community worker agents available

---

## Phase 4: Production Features (4 weeks)

> **⚠️ STATE MANAGEMENT WARNING**: For production features, implement robust state management with proper error boundaries, optimistic updates via Zustand, and enterprise-grade state persistence. Use specialized stores for security policies, performance metrics, and audit logs. No `useState` for business-critical state.

### Week 9-10: Enterprise Security
- RBAC for agent access control
- Audit logging for task execution
- Encrypted A2A communication

### Week 11-12: Performance & Scaling
- Multi-tenant orchestration
- Agent load balancing
- Performance monitoring dashboard

**Phase 4 Deliverables:**
- ✅ Production-ready security model
- ✅ Horizontal scaling support
- ✅ Enterprise deployment options
- ✅ Performance optimization

## Development Commands

```bash
# Setup
npm install
npm run build

# Supabase
npx supabase start       # Start local Supabase
npx supabase stop        # Stop local Supabase
npx supabase db reset    # Reset database to migrations
npx supabase db push     # Push schema changes to remote
npx supabase gen types typescript --local > types/supabase.ts

# Development
npm run dev              # All services + UI + Supabase
npm run dev:web          # Frontend only  
npm run dev:orchestrator # Core agent only
npm run dev:workers      # Worker agents only

# Testing
npm run test:a2a         # A2A protocol compliance
npm run test:mcp         # MCP integration
npm run test:supabase    # Database & auth tests
npm run test:e2e         # End-to-end workflows

# Deployment
docker-compose up        # Local multi-agent system
npm run deploy:supabase  # Deploy to Supabase (production)
npm run deploy:vercel    # Deploy frontend to Vercel
npm run deploy:aws       # AWS deployment
npm run deploy:gcp       # Google Cloud deployment
```

## Success Criteria

Each phase must meet these requirements:

### Phase 0 ✅
- [ ] Node.js 18.18.0+ installed and verified working
- [ ] Next.js 15.1.6 builds successfully without errors
- [ ] Zustand 5.0.3 installed with React 19 compatibility
- [ ] Supabase local instance running
- [ ] All packages installing without peer dependency errors
- [ ] Development servers starting without errors
- [ ] TypeScript compilation working

### Phase 1 ✅  
- [ ] UI matches design guide exactly (three-panel layout, agent colors)
- [ ] Zustand stores replace all shared useState usage
- [ ] Supabase real-time subscriptions working
- [ ] All responsive breakpoints function
- [ ] Database schema with RLS implemented

### Phase 2 ✅
- [ ] AWS Strand integration fully functional
- [ ] 3 A2A worker agents operational
- [ ] Activity feed displays in Activity Pane with status counts
- [ ] Multi-agent orchestration completes tasks
- [ ] Real-time updates across all panels

### Phase 3 ✅
- [ ] CLI generates working A2A agents
- [ ] Plugin system supports custom components
- [ ] Runtime adapters enable LangGraph swapping
- [ ] Developer documentation complete
- [ ] 5 community worker agents available

### Phase 4 ✅
- [ ] Enterprise security model deployed
- [ ] System handles 1000+ concurrent tasks
- [ ] Multi-tenant isolation verified
- [ ] Production monitoring operational
- [ ] 99.9% uptime achieved

This implementation plan ensures each phase delivers working, deployable software that builds toward the full vision of sophisticated multi-agent orchestration with excellent developer experience. 

# Implementation Steps

This document outlines the implementation steps for the business process automation.

## Phase 1: Planning
1. Requirements gathering
2. Stakeholder interviews
3. Technical architecture design
4. Resource allocation

## Phase 2: Development
1. Core system development
2. Integration with existing systems
3. API development
4. User interface design

## Phase 3: Testing
1. Unit testing
2. Integration testing
3. User acceptance testing
4. Performance testing

## Phase 4: Deployment
1. Production environment setup
2. Data migration
3. User training
4. Go-live monitoring 