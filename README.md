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

### Step 2: Complete Setup (Auto-Install CLI!)
```bash
# Complete setup - installs dependencies, links CLI globally, and sets up environment
npm run setup
```
This comprehensive setup will:
- 📦 Install all dependencies  
- 🔗 **Link `pixell` command globally** (new!)
- 🏠 Guide you through environment creation
- 🔧 Configure database connections  
- ✅ Update your `.env.local` automatically
- 🎯 Set everything up for you

**✨ After setup, you can use `pixell` directly instead of `npm run pixell`!**

### Step 3: Database Setup  
```bash
# The CLI will automatically check for Docker and install it if needed!
# After setup, you can use either command:
pixell supabase-init              # Direct command (after setup)
npm run pixell supabase-init     # Traditional way (always works)
```
This will:
- 🐳 **Auto-install Docker if not present** (new!)
- 🚀 **Auto-start Docker if not running** (new!)
- 🗄️ Initialize local Supabase instance
- 📝 Apply database migrations
- ✅ Verify connectivity  
- 🚀 Get you ready to code

**✨ New!** The CLI now automatically handles Docker installation - no manual setup required!

### Start Development
```bash
# Smart project startup with environment validation (after setup)
pixell start --env local

# Or using npm (always works)
npm run pixell start --env local

# Default is local environment if no --env specified
pixell start
```

**🎉 You're ready!** Visit:
- **Frontend**: http://localhost:3003
- **Backend**: http://localhost:4001
- **Database Studio**: http://127.0.0.1:54323

---

## 📋 Prerequisites

Ensure you have the right versions before starting:

| Requirement | Version | Critical Notes |
|-------------|---------|----------------|
| **Node.js** | 18.18.0+ or 20.x LTS | ⚠️ **18.16.x will NOT work** |
| **npm** | 10.5.0+ | Comes with Node.js |
| **Docker** | Latest | ✨ **Auto-installed by CLI if needed** |
| **Git** | Latest | For version control |

**Quick version check:**
```bash
node --version    # Should be 18.18.0+ or 20.x
npm --version     # Should be 10.5.0+
docker --version  # Should show Docker version
docker ps         # Should connect to Docker daemon
```

### 🐳 Docker Setup

**Supabase requires Docker to run locally.** Make sure Docker is installed and running:

**Windows/Mac:**
1. Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install and start Docker Desktop
3. Verify Docker is running: `docker ps`

**Linux:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker ps
```

**✨ The Pixell CLI can now auto-install Docker for you!** Just run `pixell supabase-init` (after setup) and it will handle everything automatically.

### 🔗 CLI Global Installation

The setup process automatically makes `pixell` available as a global command:

```bash
npm run setup                    # Links pixell globally
pixell help                      # Now works directly!
```

**What happens during setup:**
1. 📦 Installs all dependencies
2. 🔗 Links `pixell` command globally via `npm link`
3. 🌍 Guides you through environment creation
4. 🗄️ Sets up database configuration

**After setup, you can use:**
- `pixell start --env local` (direct command)
- `npm run pixell start --env local` (traditional way)

Both work the same way!

### 📋 Alternative Setup Commands

If you need more control over the setup process:

```bash
npm run setup:install            # Just install dependencies
npm run setup:link               # Just link CLI globally  
npm run setup:env                # Just setup environment & database
npm run setup:quick              # Install + link CLI (skip database setup)
```

**For quick CLI access without full setup:**
```bash
npm run setup:quick              # Fast: install deps + link CLI
pixell help                      # Ready to use!
```

### 🐳 Docker Command Guide

Choose the right Docker command for your situation:

| Command | When to Use | What It Does |
|---------|-------------|--------------|
| `docker-install` | **First time setup** | Installs Docker on your system |
| `docker-start` | **Daily development** | Quickly starts Docker (no prompts) |
| `docker-status` | **Troubleshooting** | Shows detailed status + option to start |

**💡 Pro Tip:** Use `docker-start` in your daily workflow and `docker-status` when something's not working.

---

## 🛠️ Pixell CLI - Your Development Assistant

The Pixell CLI is your one-stop tool for agent development. It handles everything from environment management to database setup to file operations.

### Essential Commands

**🏗️ Setup & Configuration**
```bash
# After running 'npm run setup', use pixell directly:
pixell env                           # Manage environments (START HERE)
pixell supabase-init                 # Setup database  
pixell config-ai                     # Configure AI runtime and credentials (NEW!)
pixell start --env local             # Smart project startup with AI
pixell config-show                   # View current config
pixell help                          # See all commands

# Traditional way (always works):
npm run pixell env                   # Alternative syntax
```

**🐳 Docker Management (Auto-Installation & Start)**
```bash
npm run pixell docker-install        # Install Docker automatically
npm run pixell docker-status         # Check status & optionally start Docker
npm run pixell docker-start          # Start Docker quickly (no status check)
```

**🗄️ Database Management**
```bash
npm run pixell supabase-status       # Check database status
npm run pixell supabase-migrations   # Manage migrations
npm run pixell supabase-stop         # Stop local services
npm run pixell supabase-reset        # Reset database (⚠️ destructive)
```

**📁 File Operations (Unix-like)**
```bash
# Navigation & listing
npm run pixell ls -la                # List files with details
npm run pixell tree myproject/       # Show directory structure

# File manipulation  
npm run pixell mkdir -p src/agents   # Create directories
npm run pixell cp -r templates/ new/ # Copy files/folders
npm run pixell mv old.txt new.txt    # Move/rename
npm run pixell rm *.tmp              # Remove files

# Content operations
npm run pixell cat package.json      # Display file content
npm run pixell grep -r "TODO" src/   # Search in files
npm run pixell find "*.ts" src/      # Find TypeScript files
```

---

## 🌍 Environment Management Deep Dive

The CLI's environment system lets you manage multiple setups (local, staging, production) seamlessly.

### Creating Your First Environment

When you run `npm run pixell env`, you'll see an interactive menu:

```
🌍 ENVIRONMENT MANAGEMENT
==========================
1. 📋 List Environments  
2. ➕ Add New Environment
3. ✏️  Edit Environment
4. 🔄 Switch Active Environment
5. 🧪 Test Environment Connection
6. 🗑️  Delete Environment
```

**For beginners, choose "Add New Environment" and select:**
- **🏠 Local Development** - Perfect for getting started
- Pre-configured with localhost Supabase
- No external dependencies needed

### Environment Types

**🏠 Local Development Environment**
- Uses localhost Supabase (port 54321)
- Perfect for development and testing
- No cloud setup required
- Automatically configured

**☁️ Remote Environment**
- Connect to production/staging Supabase
- Custom database connections
- Team collaboration
- Requires Supabase project URL and keys

### Switching Environments

```bash
npm run pixell env  # Interactive menu to switch
```

When you switch environments, the CLI automatically:
- Updates your `.env.local` file
- Switches database connections
- Updates all configuration files
- Tests the new connection

---

## 🗄️ Database Setup & Management

### Initial Database Setup

After creating an environment, set up your database:

```bash
npm run pixell supabase-init
```

**What this does:**
1. 🔧 Installs Supabase CLI if needed
2. 🏗️ Creates local Supabase project
3. 🚀 Starts local services (Database, Auth, API, Studio)
4. 📝 Applies initial migrations
5. ✅ Verifies everything works

### Managing Migrations

```bash
npm run pixell supabase-migrations
```

**Interactive migration menu:**
```
🗄️ DATABASE MIGRATIONS
=======================
1. 📊 Show Migration Status
2. ✅ Apply Pending Migrations  
3. 📝 Create New Migration
4. ⚖️  Compare Environments
5. 🔄 Rollback Migration
```

**Common workflows:**
```bash
# Check what migrations need to be applied
npm run pixell supabase-migrations  # → Show Migration Status

# Apply all pending migrations
npm run pixell supabase-migrations  # → Apply Pending Migrations

# Create a new migration
npm run pixell supabase-migrations  # → Create New Migration
```

### Database Health Checks

```bash
# Quick status check
npm run pixell supabase-status

# Detailed service status
curl http://127.0.0.1:54321/health

# Access database studio
open http://127.0.0.1:54323
```

---

## 🔧 Development Workflow

### Daily Development Routine

**Morning startup (New Smart Way!):**
```bash
# One command does it all! 🚀 (after running setup)
pixell start --env local

# Or traditional way
npm run pixell start --env local
```

**This single command will:**
- ✅ Validate your environment exists
- ✅ Check Supabase configuration
- ✅ Verify Docker is running (starts if needed)
- ✅ Launch the development servers
- ✅ Show you exactly what's happening

**Traditional startup (still works):**
```bash
# 1. Check environment status
npm run pixell config-show

# 2. Start Docker if needed (quick)
npm run pixell docker-start

# 3. Check database status  
npm run pixell supabase-status

# 4. Start development servers
npm run dev
```

**During development:**
```bash
# Monitor logs
npm run pixell tail -f logs/development.log

# Find files quickly
npm run pixell find "*.ts" src/agents/

# Search for TODOs
npm run pixell grep -r "TODO" src/
```

**End of day:**
```bash
# Stop services to save resources
npm run pixell supabase-stop

# Clean up temporary files  
npm run pixell find "*.tmp" -delete
```

### Building & Testing

```bash
# Development
npm run dev                    # Start all services
npm run dev:web               # Frontend only  
npm run dev:orchestrator      # Backend only

# Production builds
npm run build                 # Build everything
npm run lint                  # Check code quality
npm run test                  # Run tests
```

---

## 🌐 Service Architecture

When everything is running, you'll have these services:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3003 | Next.js web interface |
| **Backend API** | http://localhost:4001 | Agent orchestrator |
| **Health Check** | http://localhost:4001/health | API health status |
| **Database** | http://127.0.0.1:54321 | Supabase local instance |
| **DB Studio** | http://127.0.0.1:54323 | Database admin interface |
| **Auth Server** | http://127.0.0.1:54324 | Supabase Auth |

---

## 📁 Project Structure

Understanding the codebase:

```
pixell-agent-framework/
├── apps/
│   ├── web/                    # 🎨 Next.js 15 Frontend
│   │   ├── src/app/           # App router pages & API routes
│   │   ├── src/components/    # Reusable UI components
│   │   └── src/lib/           # Utilities & configurations
│   └── orchestrator/          # 🤖 Agent orchestrator backend
│       ├── src/core/          # Core agent functionality
│       └── src/demo/          # Phase 2 demonstration
├── packages/
│   ├── cli/                   # 🛠️ Pixell CLI tools
│   ├── protocols/             # 📡 Agent communication
│   ├── file-storage/          # 📂 File management
│   └── workers/               # 👷 Worker agent implementations
├── supabase/                  # 🗄️ Database schema & migrations
├── .pixell/                   # ⚙️ CLI configuration (auto-generated)
└── workspace-files/           # 📁 Your agent workspace
```

---

## 🔧 Technology Stack

**Frontend**
- Next.js 15.1.6 (App Router)
- React 19 (Latest stable)
- TypeScript 5.7.3
- Tailwind CSS + shadcn/ui
- Zustand (State management)

**Backend**  
- Express.js + TypeScript
- WebSocket (Real-time)
- Multi-agent orchestration
- A2A protocol communication

**Database & Auth**
- Supabase (PostgreSQL + Auth + Real-time)
- Automatic migrations
- Local development + cloud deployment

**CLI & DevOps**
- Commander.js (CLI framework)
- Inquirer.js (Interactive prompts)
- Turbo (Monorepo build system)

---

## ⚠️ Troubleshooting

### Node.js Version Issues
```
Error: You are using Node.js 18.16.1. For Next.js, Node.js version "^18.18.0 || ^19.8.0 || >= 20.0.0" is required.
```

**Fix:** Update Node.js
```bash
# Using nvm (recommended)
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version  # Should show 20.x.x
```

### CLI Commands Not Working
```bash
# Reinstall dependencies
npm install

# Rebuild CLI
npm run build --workspace=@pixell/cli

# Test CLI
npm run pixell help
```

### Database Connection Issues
```bash
# Reset everything
npm run pixell supabase-stop
npm run pixell supabase-reset  
npm run pixell supabase-init

# Check status
npm run pixell supabase-status
```

### Docker Issues

**Error: "Failed to start local Supabase. Make sure Docker is running"**

This error occurs when Docker is not installed or not running:

```bash
# 1. Check if Docker is installed
docker --version

# 2. Check if Docker is running  
docker ps

# 3. If Docker is not running, start it:
# Windows/Mac: Start Docker Desktop application
# Linux: sudo systemctl start docker

# 4. Verify Docker is working
docker run hello-world

# 5. Try Supabase setup again
npm run pixell supabase-init
```

**✨ Automatic Docker Management (New!):**
```bash
# Let the CLI install Docker for you
npm run pixell docker-install

# Quick start Docker (daily use)
npm run pixell docker-start

# Detailed status check (troubleshooting)
npm run pixell docker-status
```

**Common Docker fixes:**
- **Windows**: Make sure Docker Desktop is running (check system tray)
- **Mac**: Make sure Docker Desktop is running (check menu bar)  
- **Linux**: Make sure Docker daemon is started: `sudo systemctl start docker`
- **All platforms**: Try restarting Docker completely

### Environment Configuration Problems
```bash
# Reset configuration
npm run pixell config-init

# Recreate environments
npm run pixell env
```

---

## ✅ Health Check Verification

### 1. CLI Health Check
```bash
npm run pixell help                 # ✅ Should show command list
npm run pixell config-show          # ✅ Should show current config
npm run pixell ls                   # ✅ Should list workspace files
```

### 2. Service Health Check
```bash
curl http://localhost:3003          # ✅ Should return HTML
curl http://localhost:4001/health   # ✅ Should return JSON status
npm run pixell supabase-status      # ✅ Should show all services running
```

### 3. Environment Check
```bash
npm run pixell env                  # ✅ Should show configured environments
cat .env.local                     # ✅ Should show environment variables
```

---

## 🚀 New: Smart Project Startup

**The Pixell CLI now includes a powerful `start` command that handles everything for you!**

### 🤖 Multi-Provider AI Configuration Guide

**Configure multiple AI providers for maximum flexibility:**

```bash
# Interactive multi-provider AI setup
pixell config-ai
```

**🚀 Quick Setup (Recommended for beginners):**
- **OpenAI (Default)**: GPT-4o, GPT-4o Mini, o1-preview, o1-mini
  - Just need an OpenAI API key from https://platform.openai.com/api-keys
  - Best for getting started quickly

**⚙️ Advanced Setup (Multiple providers):**
- **🧠 OpenAI**: GPT-4o, GPT-4o Mini, o1 models
- **🎭 Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus  
- **🏗️ AWS Bedrock**: Multiple models via AWS (Claude, Llama, etc.)
- **☁️ Azure OpenAI**: Enterprise GPT models with Azure infrastructure
- **🔍 Google AI**: Gemini 1.5 Pro, Gemini 1.5 Flash

**✨ Multi-Provider Benefits:**
- **Fallback/Redundancy**: If one provider is down, use another
- **Model Specialization**: Different models excel at different tasks
- **Cost Optimization**: Use cheaper models for simple tasks
- **Runtime Switching**: Change models dynamically in your application

**The command will:**
1. Guide you through provider selection
2. Configure multiple providers simultaneously  
3. Set a default provider for your application
4. Write all credentials to `.env.local`
5. Enable runtime model switching

### ✨ What `pixell start` Does

```bash
# Direct command (after setup and AI config)
pixell start --env local

# Or traditional way
npm run pixell start --env local
```

**This single command performs a complete startup sequence:**

1. **🔍 Environment Validation**
   - Checks if the specified environment exists
   - Displays environment configuration details
   - Lists available environments if the specified one doesn't exist

2. **🗄️ Supabase Setup Verification**
   - For **local** environments: Verifies local Supabase is initialized
   - For **remote** environments: Validates connection credentials
   - Aborts with clear instructions if setup is incomplete

3. **🐳 Docker Management**
   - Checks if Docker is installed
   - Offers to install Docker automatically if missing
   - Starts Docker if installed but not running
   - Waits for Docker to be ready before proceeding

4. **🎯 Project Launch**
   - Maps environment to appropriate npm script
   - Shows service URLs that will be available
   - Starts the development servers

### 🌍 Environment Support

```bash
# Local development (default) - after setup
pixell start
pixell start --env local

# Staging environment
pixell start --env staging

# Production environment  
pixell start --env production

# Any custom environment you've created
pixell start --env my-custom-env

# Traditional syntax (always works)
npm run pixell start --env local
```

### 🎯 Benefits

- **⚡ One Command Setup**: No more running multiple commands
- **🛡️ Validation First**: Catches configuration issues before starting
- **🤖 Auto-Installation**: Installs Docker if needed
- **📊 Clear Feedback**: Shows exactly what's happening at each step
- **🚨 Smart Error Handling**: Provides actionable error messages

---

## 🚦 Development Phases

- ✅ **Phase 0**: Setup & Infrastructure (COMPLETE)
- ✅ **Phase 1**: CLI Tools & Environment Management (COMPLETE)  
- ✅ **Phase 2**: Multi-Agent Orchestration (COMPLETE)
- 🔄 **Phase 3**: Advanced Features (NEXT)

---

## 🎯 Next Steps

Now that your environment is set up:

1. **🤖 Configure AI (Required for Chat Features)**
   ```bash
   pixell config-ai                  # Configure AWS Strand or OpenAI
   ```

2. **🚀 Start Development**
   ```bash
   pixell start --env local          # All-in-one startup command (after setup)
   pixell start                      # Uses local env by default
   
   # Or traditional way:
   npm run pixell start --env local  # Alternative syntax
   ```

3. **🤖 Explore the Demo**
   ```bash
   curl http://localhost:4001/demo/reddit
   ```

4. **📝 Check the Logs**
   ```bash
   npm run pixell tail -f logs/development.log
   ```

5. **🔍 Explore the Code**
   ```bash
   npm run pixell tree apps/orchestrator/src/
   ```

6. **🧪 Test AI Chat Features**
   - Visit the frontend at http://localhost:3003
   - Try the AI-powered chat workspace
   - Test real AI responses with your configured runtime
   - Explore the database studio

7. **🌍 Multi-Environment Development**
   ```bash
   pixell start --env staging           # Start with staging env
   pixell start --env production        # Start with production env
   ```

---

## 💡 Pro Tips

### Efficient CLI Usage
```bash
# Create aliases for common commands
alias penv="npm run pixell env"
alias pdb="npm run pixell supabase-status"  
alias pls="npm run pixell ls -la"

# Chain commands for complex workflows
npm run pixell find "*.ts" | npm run pixell grep -l "Agent"
```

### Development Best Practices
```bash
# Morning routine
npm run pixell supabase-status && npm run dev

# Before committing
npm run lint && npm run pixell find "*.tmp" -delete

# Environment switching
npm run pixell env  # Interactive menu is faster than flags
```

---

## 🤝 Contributing

1. **Setup**: Follow the Quick Start guide
2. **Environment**: Use `npm run pixell env` to configure
3. **Database**: Use `npm run pixell supabase-init` for setup
4. **Development**: Use CLI tools for file management
5. **Testing**: Verify all health checks pass

---

## 📚 Additional Resources

- **CLI Commands**: Run `npm run pixell help` for full command list
- **Database Studio**: http://127.0.0.1:54323 for database management
- **API Documentation**: http://localhost:4001/health for API status
- **File Management**: Use `npm run pixell ls`, `cp`, `mv` for workspace operations

---

**🚀 Ready to build intelligent agents? Start with `npm run pixell env`!**