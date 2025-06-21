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

### Step 2: Environment Setup
```bash
# Let the CLI guide you through environment setup
npm run pixell env
```
This interactive command will:
- 🏠 Create your local development environment  
- 🔧 Configure database connections
- ✅ Update your `.env.local` automatically
- 🎯 Set everything up for you

### Step 3: Database Setup  
```bash
# Complete Supabase setup with one command
npm run pixell supabase-init
```
This will:
- 🗄️ Initialize local Supabase instance
- 📝 Apply database migrations
- ✅ Verify connectivity  
- 🚀 Get you ready to code

### Start Development
```bash
npm run dev
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
| **Git** | Latest | For version control |

**Quick version check:**
```bash
node --version    # Should be 18.18.0+ or 20.x
npm --version     # Should be 10.5.0+
```

---

## 🛠️ Pixell CLI - Your Development Assistant

The Pixell CLI is your one-stop tool for agent development. It handles everything from environment management to database setup to file operations.

### Essential Commands

**🏗️ Setup & Configuration**
```bash
npm run pixell env                    # Manage environments (START HERE)
npm run pixell supabase-init         # Setup database  
npm run pixell config-show           # View current config
npm run pixell help                  # See all commands
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

**Morning startup:**
```bash
# 1. Check environment status
npm run pixell config-show

# 2. Check database status  
npm run pixell supabase-status

# 3. Start development servers
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

## 🚦 Development Phases

- ✅ **Phase 0**: Setup & Infrastructure (COMPLETE)
- ✅ **Phase 1**: CLI Tools & Environment Management (COMPLETE)  
- ✅ **Phase 2**: Multi-Agent Orchestration (COMPLETE)
- 🔄 **Phase 3**: Advanced Features (NEXT)

---

## 🎯 Next Steps

Now that your environment is set up:

1. **🤖 Explore the Demo**
   ```bash
   curl http://localhost:4001/demo/reddit
   ```

2. **📝 Check the Logs**
   ```bash
   npm run pixell tail -f logs/development.log
   ```

3. **🔍 Explore the Code**
   ```bash
   npm run pixell tree apps/orchestrator/src/
   ```

4. **🧪 Test Multi-Agent Features**
   - Visit the frontend at http://localhost:3003
   - Try the agent orchestration demo
   - Explore the database studio

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