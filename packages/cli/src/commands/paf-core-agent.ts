import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync } from 'child_process'
import execa from 'execa'
import path from 'path'
import fs from 'fs-extra'

/**
 * PAF Core Agent Management Commands
 * Handles cloning, updating, and managing the PAF Core Agent repository
 */

interface PafCoreAgentOptions {
  branch?: string
  force?: boolean
  dev?: boolean
}

/**
 * Clone PAF Core Agent repository
 */
export async function clonePafCoreAgent(options: PafCoreAgentOptions = {}): Promise<void> {
  console.log(chalk.blue.bold('\n🐍 PAF CORE AGENT - CLONE'))
  console.log(chalk.blue('='.repeat(40)))
  
  const targetPath = path.join(process.cwd(), 'paf-core-agent')
  const repoUrl = 'https://github.com/pixell-global/paf-core-agent.git'
  const branch = options.branch || 'main'
  
  try {
    // Check if directory already exists
    if (await fs.pathExists(targetPath)) {
      if (!options.force) {
        const shouldOverwrite = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'PAF Core Agent directory already exists. Overwrite?',
            default: false
          }
        ])
        
        if (!shouldOverwrite.overwrite) {
          console.log(chalk.yellow('❌ Clone cancelled'))
          return
        }
      }
      
      console.log(chalk.yellow('🗑️ Removing existing directory...'))
      await fs.remove(targetPath)
    }
    
    const spinner = ora(`🔄 Cloning PAF Core Agent from ${repoUrl}...`).start()
    
    // Clone the repository
    execSync(`git clone -b ${branch} ${repoUrl}`, {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    spinner.succeed(`✅ PAF Core Agent cloned successfully (branch: ${branch})`)
    
    // Set up the Python environment
    await setupPythonEnvironment(targetPath, options.dev)
    
    // Create Docker files if they don't exist
    await createDockerFiles(targetPath)
    
    console.log(chalk.green('\n🎉 PAF Core Agent is ready!'))
    console.log(chalk.blue('\n📚 Next steps:'))
    console.log(chalk.gray('   1. Configure your API keys in .env'))
    console.log(chalk.gray('   2. Run: docker-compose up paf-core-agent'))
    console.log(chalk.gray('   3. Visit: http://localhost:8000/docs'))
    
  } catch (error) {
    console.log(chalk.red('❌ Clone failed'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

/**
 * Update PAF Core Agent repository
 */
export async function updatePafCoreAgent(options: PafCoreAgentOptions = {}): Promise<void> {
  console.log(chalk.blue.bold('\n🔄 PAF CORE AGENT - UPDATE'))
  console.log(chalk.blue('='.repeat(40)))
  
  const targetPath = path.join(process.cwd(), 'paf-core-agent')
  
  try {
    // Check if directory exists
    if (!await fs.pathExists(targetPath)) {
      console.log(chalk.red('❌ PAF Core Agent not found'))
      console.log(chalk.yellow('💡 Run: npm run pixell paf-core-agent:clone'))
      return
    }
    
    const spinner = ora('🔄 Updating PAF Core Agent...').start()
    
    // Check current branch
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: targetPath,
      encoding: 'utf8'
    }).trim()
    
    // Stash any local changes
    try {
      execSync('git stash', {
        cwd: targetPath,
        stdio: 'pipe'
      })
    } catch {
      // No changes to stash
    }
    
    // Pull latest changes
    execSync('git pull origin ' + currentBranch, {
      cwd: targetPath,
      stdio: 'pipe'
    })
    
    spinner.succeed(`✅ PAF Core Agent updated (branch: ${currentBranch})`)
    
    // Update Python dependencies
    await updatePythonDependencies(targetPath)
    
    console.log(chalk.green('\n🎉 PAF Core Agent updated successfully!'))
    
  } catch (error) {
    console.log(chalk.red('❌ Update failed'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Check PAF Core Agent status
 */
export async function statusPafCoreAgent(): Promise<void> {
  console.log(chalk.blue.bold('\n📊 PAF CORE AGENT - STATUS'))
  console.log(chalk.blue('='.repeat(40)))
  
  const targetPath = path.join(process.cwd(), 'paf-core-agent')
  
  try {
    // Check if directory exists
    if (!await fs.pathExists(targetPath)) {
      console.log(chalk.red('❌ PAF Core Agent not found'))
      console.log(chalk.yellow('💡 Run: npm run pixell paf-core-agent:clone'))
      return
    }
    
    console.log(chalk.green('✅ PAF Core Agent directory exists'))
    
    // Check Git status
    try {
      const gitStatus = execSync('git status --porcelain', {
        cwd: targetPath,
        encoding: 'utf8'
      })
      
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: targetPath,
        encoding: 'utf8'
      }).trim()
      
      const lastCommit = execSync('git log -1 --format="%h %s"', {
        cwd: targetPath,
        encoding: 'utf8'
      }).trim()
      
      console.log(chalk.blue('\n📁 Repository Info:'))
      console.log(chalk.gray(`   Branch: ${currentBranch}`))
      console.log(chalk.gray(`   Last commit: ${lastCommit}`))
      
      if (gitStatus.trim()) {
        console.log(chalk.yellow('   Status: Has uncommitted changes'))
        console.log(chalk.gray('   Changes:'))
        gitStatus.split('\n').forEach(line => {
          if (line.trim()) {
            console.log(chalk.gray(`     ${line}`))
          }
        })
      } else {
        console.log(chalk.green('   Status: Clean working directory'))
      }
      
    } catch (error) {
      console.log(chalk.yellow('⚠️ Not a Git repository or Git error'))
    }
    
    // Check Python environment
    const venvPath = path.join(targetPath, 'venv')
    if (await fs.pathExists(venvPath)) {
      console.log(chalk.green('✅ Python virtual environment exists'))
    } else {
      console.log(chalk.yellow('⚠️ Python virtual environment not found'))
    }
    
    // Check requirements.txt
    const requirementsPath = path.join(targetPath, 'requirements.txt')
    if (await fs.pathExists(requirementsPath)) {
      console.log(chalk.green('✅ Requirements file exists'))
    } else {
      console.log(chalk.yellow('⚠️ Requirements file not found'))
    }
    
    // Check if service is running
    await checkServiceHealth()
    
  } catch (error) {
    console.log(chalk.red('❌ Status check failed'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Remove PAF Core Agent
 */
export async function removePafCoreAgent(): Promise<void> {
  console.log(chalk.blue.bold('\n🗑️ PAF CORE AGENT - REMOVE'))
  console.log(chalk.blue('='.repeat(40)))
  
  const targetPath = path.join(process.cwd(), 'paf-core-agent')
  
  try {
    if (!await fs.pathExists(targetPath)) {
      console.log(chalk.yellow('⚠️ PAF Core Agent directory not found'))
      return
    }
    
    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'remove',
        message: 'Are you sure you want to remove PAF Core Agent? This will delete the entire directory.',
        default: false
      }
    ])
    
    if (!confirmation.remove) {
      console.log(chalk.yellow('❌ Removal cancelled'))
      return
    }
    
    const spinner = ora('🗑️ Removing PAF Core Agent...').start()
    
    await fs.remove(targetPath)
    
    spinner.succeed('✅ PAF Core Agent removed successfully')
    
  } catch (error) {
    console.log(chalk.red('❌ Removal failed'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Setup Python environment for PAF Core Agent
 */
async function setupPythonEnvironment(targetPath: string, dev: boolean = false): Promise<void> {
  const spinner = ora('🐍 Setting up Python environment...').start()
  
  try {
    // Check if Python is available
    try {
      execSync('python3 --version', { stdio: 'pipe' })
    } catch {
      spinner.fail('❌ Python 3 not found')
      console.log(chalk.yellow('💡 Please install Python 3.11+ and try again'))
      return
    }
    
    // Create virtual environment
    execSync('python3 -m venv venv', {
      cwd: targetPath,
      stdio: 'pipe'
    })
    
    // Activate venv and install dependencies
    const venvPython = path.join(targetPath, 'venv', 'bin', 'python')
    const venvPip = path.join(targetPath, 'venv', 'bin', 'pip')
    
    // Check if we're on Windows
    const isWindows = process.platform === 'win32'
    const pythonCmd = isWindows ? path.join(targetPath, 'venv', 'Scripts', 'python.exe') : venvPython
    const pipCmd = isWindows ? path.join(targetPath, 'venv', 'Scripts', 'pip.exe') : venvPip
    
    // Upgrade pip
    execSync(`${pipCmd} install --upgrade pip`, {
      cwd: targetPath,
      stdio: 'pipe'
    })
    
    // Install requirements
    const requirementsPath = path.join(targetPath, 'requirements.txt')
    if (await fs.pathExists(requirementsPath)) {
      execSync(`${pipCmd} install -r requirements.txt`, {
        cwd: targetPath,
        stdio: 'pipe'
      })
    }
    
    // Install development dependencies if dev mode
    if (dev) {
      const devRequirementsPath = path.join(targetPath, 'requirements-dev.txt')
      if (await fs.pathExists(devRequirementsPath)) {
        execSync(`${pipCmd} install -r requirements-dev.txt`, {
          cwd: targetPath,
          stdio: 'pipe'
        })
      }
    }
    
    spinner.succeed('✅ Python environment setup complete')
    
  } catch (error) {
    spinner.fail('❌ Python environment setup failed')
    console.log(chalk.yellow('💡 You can manually set up the environment:'))
    console.log(chalk.white('   cd paf-core-agent'))
    console.log(chalk.white('   python3 -m venv venv'))
    console.log(chalk.white('   source venv/bin/activate'))
    console.log(chalk.white('   pip install -r requirements.txt'))
  }
}

/**
 * Update Python dependencies
 */
async function updatePythonDependencies(targetPath: string): Promise<void> {
  const spinner = ora('📦 Updating Python dependencies...').start()
  
  try {
    const venvPip = path.join(targetPath, 'venv', 'bin', 'pip')
    const isWindows = process.platform === 'win32'
    const pipCmd = isWindows ? path.join(targetPath, 'venv', 'Scripts', 'pip.exe') : venvPip
    
    // Check if virtual environment exists
    if (!await fs.pathExists(isWindows ? path.join(targetPath, 'venv', 'Scripts') : path.join(targetPath, 'venv', 'bin'))) {
      spinner.warn('⚠️ Virtual environment not found, skipping dependency update')
      return
    }
    
    // Update pip
    execSync(`${pipCmd} install --upgrade pip`, {
      cwd: targetPath,
      stdio: 'pipe'
    })
    
    // Update requirements
    const requirementsPath = path.join(targetPath, 'requirements.txt')
    if (await fs.pathExists(requirementsPath)) {
      execSync(`${pipCmd} install --upgrade -r requirements.txt`, {
        cwd: targetPath,
        stdio: 'pipe'
      })
    }
    
    spinner.succeed('✅ Python dependencies updated')
    
  } catch (error) {
    spinner.fail('❌ Failed to update Python dependencies')
  }
}

/**
 * Create Docker files for PAF Core Agent
 */
async function createDockerFiles(targetPath: string): Promise<void> {
  const dockerfilePath = path.join(targetPath, 'Dockerfile')
  const dockerfileDevPath = path.join(targetPath, 'Dockerfile.dev')
  const envExamplePath = path.join(targetPath, '.env.example')
  
  // Create production Dockerfile if it doesn't exist
  if (!await fs.pathExists(dockerfilePath)) {
    const dockerfileContent = `# Production Dockerfile for PAF Core Agent
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD curl -f http://localhost:8000/api/health || exit 1

# Expose port
EXPOSE 8000

# Start the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
`
    await fs.writeFile(dockerfilePath, dockerfileContent)
  }
  
  // Create development Dockerfile if it doesn't exist
  if (!await fs.pathExists(dockerfileDevPath)) {
    const dockerfileDevContent = `# Development Dockerfile for PAF Core Agent
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    git \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
COPY requirements-dev.txt* .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install development dependencies if available
RUN if [ -f "requirements-dev.txt" ]; then pip install --no-cache-dir -r requirements-dev.txt; fi

# Install development tools
RUN pip install debugpy

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose ports (8000 for app, 5678 for debugger)
EXPOSE 8000 5678

# Start the application with auto-reload
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
`
    await fs.writeFile(dockerfileDevPath, dockerfileDevContent)
  }
  
  // Create .env.example if it doesn't exist
  if (!await fs.pathExists(envExamplePath)) {
    const envExampleContent = `# PAF Core Agent Environment Variables
# Copy this file to .env and fill in your values

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
DEFAULT_MODEL=gpt-3.5-turbo

# Anthropic Configuration (optional)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# AWS Configuration (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Application Configuration
DEBUG=false
MAX_CONTEXT_TOKENS=4000
REQUEST_TIMEOUT=30
MAX_CONCURRENT_REQUESTS=150

# Security
JWT_SECRET=your-jwt-secret-here
HMAC_SECRET=your-hmac-secret-here

# Observability
LOG_LEVEL=info
METRICS_ENABLED=true
TRACING_ENABLED=false
`
    await fs.writeFile(envExamplePath, envExampleContent)
  }
}

/**
 * Check if PAF Core Agent service is running
 */
async function checkServiceHealth(): Promise<void> {
  try {
    await execa('curl', ['-f', 'http://localhost:8000/api/health'], { timeout: 5000 })
    console.log(chalk.green('✅ PAF Core Agent service is running and healthy'))
  } catch {
    console.log(chalk.yellow('⚠️ PAF Core Agent service is not running'))
    console.log(chalk.gray('   Start with: docker-compose up paf-core-agent'))
  }
}