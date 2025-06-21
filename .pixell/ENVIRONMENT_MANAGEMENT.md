# 🌍 Environment Management System

The Pixell CLI now includes a comprehensive environment management system that allows developers to easily configure, manage, and switch between multiple development environments.

## ✨ Features

### 🎯 What You Can Do

- **Create Custom Environments**: Add local or remote environments with any name (dev, staging, prod-v2, etc.)
- **Edit Configurations**: Modify database settings, Supabase URLs, descriptions
- **Switch Active Environment**: Automatically updates your `.env.local` file
- **Test Connections**: Validate environment configurations
- **Delete Environments**: Remove unused environments safely
- **Migration Integration**: Migrations automatically use configured environments

### 🚀 How to Use

#### Quick Start
```bash
npm run pixell env                      # Interactive environment menu
```

#### Available Commands
- 📋 **List All Environments** - View all configured environments
- ➕ **Add New Environment** - Create local or remote environments  
- ✏️ **Edit Environment** - Modify name, description, and database settings
- 🗑️ **Delete Environment** - Remove environments (with confirmation)
- 🔄 **Switch Active Environment** - Change which environment is active
- 📊 **Test Environment Connection** - Verify environment connectivity

> 💡 **Note**: Supabase-specific settings (project URLs, API keys) are managed through `npm run supabase:init` and other Supabase commands, not through environment editing.

### 🏗️ Environment Types

#### 🏠 Local Development
Perfect for development and testing:
- Automatically configured for local Supabase (localhost:54321)
- Uses default local database credentials (postgres:postgres)
- No manual configuration needed

#### ☁️ Remote Environment
For staging, production, or custom setups:
- Custom database host, port, credentials
- Production or staging Supabase projects
- Full configuration flexibility

### 📊 Configuration Storage

Environments are stored in `.pixell/environments.json` with:
- **Name & Description**: Custom identifiers (editable)
- **Database Settings**: Host, port, user, password, connection strings (editable for remote environments)
- **Supabase Configuration**: Project URL, anonymous keys (managed via Supabase commands)
- **Active Status**: Which environment is currently active
- **Timestamps**: Creation and modification tracking

> 🔧 **Environment Editing Scope**: Only name, description, and database connection settings can be edited through environment management. Supabase settings are configured during initial setup and managed through dedicated Supabase commands.

### 🔒 Security Features

**Secure by Design**:
- ✅ Passwords masked during input (`*****`)
- ✅ Service keys never displayed in CLI output  
- ✅ Configuration stored locally (not in git)
- ✅ Connection strings properly formatted and protected
- ✅ Anonymous keys masked in status displays

### 🎯 Active Environment Benefits

The active environment (shown with 🟢):
1. **Auto-Updates .env.local**: Keeps your environment variables in sync
2. **Migration Integration**: Used by default in migration commands
3. **CLI Operations**: Applied to all CLI database operations
4. **Visual Indicators**: Clear marking in all environment lists

### 🔄 Migration Integration

The migration system now uses configured environments:

```bash
npm run supabase:migrations            # Interactive migration menu
```

**Enhanced Features**:
- Select from configured environments (no manual connection strings)
- Environment-aware migration application
- Compare migration status between any environments
- Smart local vs remote handling

### 💡 Usage Examples

#### 1. Setup Development Environment
```bash
npm run pixell env
# Choose: Add New Environment
# Name: "local-dev"
# Type: Local Development
# Description: "My local development environment"
```

#### 2. Add Production Environment  
```bash
npm run pixell env
# Choose: Add New Environment
# Name: "production"
# Type: Remote Environment
# Database Host: your-prod-db.com
# Supabase URL: https://your-project.supabase.co
```

#### 3. Switch Between Environments
```bash
npm run pixell env
# Choose: Switch Active Environment
# Select: production
# ✅ .env.local automatically updated
```

#### 4. Apply Migrations to Staging
```bash
npm run supabase:migrations
# Choose: Apply Migrations to Environment
# Select: staging
# Review and confirm migration application
```

### 🔧 Integration with Existing Workflow

The environment system integrates seamlessly:
- **No Breaking Changes**: Existing workflows continue to work
- **Optional Usage**: Can still use manual connection strings if preferred
- **Backwards Compatible**: Previous migration commands still function
- **Enhanced UX**: Better developer experience when adopted

### 📁 File Structure

```
.pixell/
└── environments.json           # Environment configurations (git-ignored)

.env.local                      # Auto-updated with active environment
```

### 🎉 Benefits

1. **Developer Productivity**: No more manual connection string management
2. **Environment Safety**: Clear active environment indicators prevent mistakes
3. **Team Consistency**: Standardized environment configurations
4. **Migration Confidence**: Know exactly which migrations are applied where
5. **Security First**: Sensitive data properly protected throughout CLI

### 🔮 Future Enhancements

Planned features:
- Environment templates and sharing
- Automated environment synchronization
- Integration with deployment pipelines  
- Environment health monitoring
- Backup and restore capabilities

## Advanced Features

### Supabase Integration

Environment management is tightly integrated with Supabase configuration, creating a "foreign key" relationship between environments and Supabase settings.

#### How It Works
- **Environment-First**: Supabase settings can only be configured for managed environments
- **Foreign Key Relationship**: Supabase configurations are tied to specific environments
- **Automatic Validation**: Production environments validate connections before saving
- **Secure Storage**: All Supabase settings stored in environment configuration
- **Active Environment Sync**: Changing active environment updates Supabase config automatically

#### Workflow
```bash
# 1. Create environments first
npm run pixell env
# Choose "Add New Environment" → Create local/remote environments

# 2. Configure Supabase for environments  
npm run supabase:init
# Select environment → Choose setup type → Configure settings

# 3. Edit Supabase settings for environments
npm run supabase:edit
# Select environment → Edit URL/keys → Validate configuration

# 4. Use migration commands with environments
npm run supabase:migrations
# All migration commands now use configured environments
```

#### Benefits
- **No Manual Connection Strings**: Migration commands use environment configs
- **Environment Switching**: Change environment = change Supabase config
- **Consistent Configuration**: Same environment always uses same Supabase settings
- **Security**: Settings encrypted and stored securely per environment
- **Developer Experience**: One command switches entire development context

#### Example: Multi-Environment Setup
```bash
# Local development environment
npm run pixell env → Add "local" → Local Development
npm run supabase:init → Select "local" → Local Development Setup

# Staging environment  
npm run pixell env → Add "staging" → Remote Environment
npm run supabase:init → Select "staging" → Production Supabase

# Production environment
npm run pixell env → Add "production" → Remote Environment  
npm run supabase:init → Select "production" → Production Supabase

# Switch between environments
npm run pixell env → Switch Active Environment
# Supabase config automatically updates!
```

---

**Get Started**: Run `npm run pixell env` to begin managing your development environments! 