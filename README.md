# Pixell Agent Framework

A modern, production-ready multi-agent framework that enables developers to easily build and deploy intelligent agent systems. Built with Next.js 15, React 19, TypeScript, and powered by comprehensive CLI tools.

## 🚀 Quick Start (3 Steps)

Get your development environment running in under 5 minutes:

### Step 1: Clone & Install
```bash
git clone https://github.com/pixell-global/pixell-agent-framework 
cd pixell-agent-framework
npm install
```

### Step 2: Complete Setup (One Command!)
```bash
# Complete setup - installs dependencies, links CLI globally, and configures everything
npm run setup
```

This comprehensive setup will:
- 📦 Install all dependencies  
- 🔗 Link `pixell` command globally via `npm link`
- 🌍 Guide you through environment creation
- 🗄️ Setup local Supabase database
- 🤖 Configure AI (OpenAI, AWS Strand, etc.)
- ✅ Create your `.env.local` automatically

**✨ After setup, you can use `pixell` directly!**

### Alternative: Manual Step-by-Step Setup
If you prefer more control:
```bash
# Step 2a: Install and link CLI
npm run setup:install && npm run setup:link

# Step 2b: Configure environment, database, and AI
pixell env              # Create environment
pixell supabase init    # Setup database  
pixell config ai        # Configure AI
```

### Step 3: Start Development
```bash
# Smart project startup with environment validation
pixell start --env local
```

**🎉 You're ready!** Visit:
- **Frontend**: http://localhost:3003
- **Backend**: http://localhost:3001
- **Database Studio**: http://127.0.0.1:54323

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 18.18.0+ or 20.x LTS | ⚠️ **18.16.x will NOT work** |
| **npm** | 10.5.0+ | Comes with Node.js |
| **Docker** | Latest | ✨ **Auto-installed by CLI if needed** |

**Quick version check:**
```bash
node --version    # Should be 18.18.0+ or 20.x
npm --version     # Should be 10.5.0+
```

---

## ⚙️ Environment Variables Management

The setup process configures all required environment variables automatically in your `.env.local` file:

### 🔧 What Gets Configured

**Core Framework:**
```bash
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:3001
NODE_ENV=development
```

**AI Configuration (via `pixell config ai`):**
```bash
# Choose your AI provider
AI_DEFAULT_PROVIDER=openai                    # or aws-strand
OPENAI_API_KEY=sk-...                        # Your OpenAI API key
OPENAI_DEFAULT_MODEL=gpt-4o                  # Default model
AGENT_RUNTIME=aws-strand                     # Agent runtime
```

**Database (via `pixell env` + `pixell supabase init`):**
```bash
SUPABASE_URL=http://127.0.0.1:54321          # Local Supabase
SUPABASE_ANON_KEY=eyJ...                     # Auto-generated
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # Auto-generated
```

### 🛠️ Manual Configuration (If Needed)

If you need to configure manually, create `.env.local`:

```bash
# Core Framework
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:3001
NODE_ENV=development

# AI Configuration
AI_DEFAULT_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_DEFAULT_MODEL=gpt-4o

# Database (Local Development)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key

# Agent Runtime
AGENT_RUNTIME=aws-strand
```

**Get OpenAI API Key:**
1. Visit https://platform.openai.com/api-keys
2. Create new secret key
3. Copy to `OPENAI_API_KEY`

---

## 🛠️ Pixell CLI Commands

### Essential Setup Commands
```bash
# Environment management
pixell env                        # Create/switch environments

# Database setup
pixell supabase init              # Initialize local Supabase
pixell supabase status            # Check database status

# AI configuration
pixell config ai                  # Configure AI providers
pixell config show               # View current config

# Project startup
pixell start --env local          # Start with environment validation
pixell status                     # Check system status
```

### Docker Management
```bash
pixell docker status              # Check Docker status
pixell docker start               # Start Docker (if needed)
```

### File Operations
```bash
pixell ls                         # List workspace files
pixell tree                       # Show directory structure
```

---

## 🚨 Troubleshooting

### Setup Issues

**"Could not find a declaration file for module 'glob'"**
```bash
# Dependencies missing - reinstall
npm install
```

**"Error: listen EADDRINUSE: address already in use :::3001"**
```bash
# Kill existing process
lsof -ti:3001 | xargs kill -9

# Or use the smart startup
pixell start --env local
```

**"No environments configured"**
```bash
# Create environment first
pixell env
```

### Common Problems

**API key not configured:**
```bash
pixell config ai
```

**Cannot connect to database:**
```bash
pixell supabase status
pixell supabase init              # Reinitialize if needed
```

**Changes not taking effect:**
```bash
# Restart development servers
npm run dev

# Clear Next.js cache
rm -rf .next/ && npm run dev
```

---

## 🎯 Development Workflow

### Daily Routine
```bash
# Start everything with one command
pixell start --env local
```

This command:
- ✅ Validates environment configuration
- ✅ Checks Supabase setup
- ✅ Verifies Docker is running
- ✅ Starts development servers

### Alternative Commands
```bash
# Check status first
pixell status

# Start individual services
npm run dev                       # All services
npm run dev:web                   # Frontend only
npm run dev:orchestrator          # Backend only
```

---

## 📁 Project Structure

```
pixell-agent-framework/
├── apps/
│   ├── web/                      # Next.js 15 Frontend
│   └── orchestrator/             # Agent orchestrator backend
├── packages/
│   ├── cli/                      # Pixell CLI tools
│   ├── renderer/                 # AI response rendering
│   └── protocols/                # Agent communication
└── supabase/                     # Database schema & migrations
```

---

## 🚦 Service URLs

When running, access these services:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3003 | Web interface |
| **Backend** | http://localhost:3001 | API & orchestrator |
| **Database** | http://127.0.0.1:54321 | Supabase local |
| **DB Studio** | http://127.0.0.1:54323 | Database admin |

---

## 🎓 Next Steps

1. **Configure AI**: `pixell config ai`
2. **Start Development**: `pixell start --env local`
3. **Explore the Demo**: Visit http://localhost:3003
4. **Check Logs**: `pixell status`

---

**🚀 Ready to build intelligent agents? Start with `pixell env`!**

## Quick Setup

### For Fresh Machines (Recommended)
```bash
npm run setup:core  # Builds core packages only, fastest setup
```

### Alternative Setup Options
```bash
npm run setup         # Full setup with safe fallback
npm run setup:quick   # Fast development setup  
npm run setup:fresh   # Clean install + build
npm run setup:packages # Core packages only (no CLI link)
```

### Verify Setup
```bash
pixell start          # Should start both services
# - Orchestrator: http://localhost:3001/health
# - Web App: http://localhost:3000
```

### What's Built
- **Core Infrastructure**: ✅ Working
  - `@pixell/protocols` - Inter-agent communication
  - `@pixell/cli` - Command line interface  
  - `@pixell/file-storage` - File management
  - `@pixell/renderer` - Content rendering
  - `orchestrator` - Agent orchestration service

- **Web App**: ⚠️ Has minor type issues (non-blocking)
  - Runs successfully in development mode
  - Production build has TypeScript warnings (cosmetic)

## Architecture