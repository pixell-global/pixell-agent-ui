import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync, spawn } from 'child_process'
import execa from 'execa'
import path from 'path'
import fs from 'fs-extra'
import { ensureDockerForSupabase } from './docker'
import { ensureSystemDependencies, ensureDockerRunning, checkPythonEnvironment } from './system-dependencies'

interface EnvironmentConfig {
  name: string
  type: 'local' | 'remote'
  database: {
    url?: string
    host?: string
    port?: number
    user?: string
    password?: string
    database?: string
  }
  supabase: {
    projectUrl?: string
    anonKey?: string
    serviceRoleKey?: string
  }
  pafCoreAgent?: {
    url?: string
  }
  description?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

interface SetupOptions {
  skipClone?: boolean
  skipDocker?: boolean
  skipEnv?: boolean
  environment?: string
}

/**
 * Complete automated setup for Pixell Agent Framework
 */
export async function setupComplete(options: SetupOptions = {}): Promise<void> {
  console.log(chalk.blue.bold('\n🚀 PIXELL COMPLETE SETUP'))
  console.log(chalk.blue('='.repeat(60)))
  console.log(chalk.gray('Setting up the complete Pixell Agent Framework with all services...'))
  
  try {
    // Step 0: Check and install system dependencies
    await ensureSystemDependencies()
    
    // Step 1: Install dependencies and build packages
    await installDependencies()
    
    // Step 2: Clone PAF Core Agent repository
    if (!options.skipClone) {
      await clonePafCoreAgent()
    }
    
    // Step 3: Set up Docker and Docker Compose
    if (!options.skipDocker) {
      await setupDockerEnvironment()
    }
    
    // Step 4: Create default environments
    if (!options.skipEnv) {
      await createDefaultEnvironments()
    }
    
    // Step 5: Initialize Supabase
    await initializeSupabase()
    
    // Step 6: Configure AI providers
    await configureAIProviders()
    
    // Step 7: Start all services
    await startAllServices(options.environment || 'local')
    
    // Step 8: Display success information
    displaySuccessInfo()
    
  } catch (error) {
    console.log(chalk.red('\n❌ Setup failed'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    console.log(chalk.yellow('\n💡 You can retry individual steps:'))
    console.log(chalk.white('   • npm run setup:install - Install dependencies'))
    console.log(chalk.white('   • npm run pixell paf-core-agent:clone - Clone PAF Core Agent'))
    console.log(chalk.white('   • npm run pixell docker-setup - Set up Docker'))
    console.log(chalk.white('   • npm run pixell env - Configure environments'))
    process.exit(1)
  }
}

/**
 * Step 1: Install dependencies and build packages
 */
async function installDependencies(): Promise<void> {
  const spinner = ora('📦 Installing dependencies and building packages...').start()
  
  try {
    // Install root dependencies
    execSync('npm install', { 
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    // Build core packages (excluding web to avoid type issues)
    execSync('npm run setup:packages', { 
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    // Link CLI globally
    execSync('npm link', { 
      stdio: 'pipe',
      cwd: path.join(process.cwd(), 'packages', 'cli')
    })
    
    spinner.succeed('✅ Dependencies installed and packages built')
    
  } catch (error) {
    spinner.fail('❌ Failed to install dependencies')
    throw new Error(`Dependency installation failed: ${error}`)
  }
}

/**
 * Step 2: Clone PAF Core Agent repository
 */
async function clonePafCoreAgent(): Promise<void> {
  const spinner = ora('🐍 Cloning PAF Core Agent repository...').start()
  
  try {
    const pafPath = path.join(process.cwd(), 'paf-core-agent')
    
    // Check if already exists
    if (await fs.pathExists(pafPath)) {
      spinner.info('📁 PAF Core Agent directory already exists')
      
      const shouldUpdate = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'update',
          message: 'Update existing PAF Core Agent repository?',
          default: true
        }
      ])
      
      if (shouldUpdate.update) {
        spinner.text = '🔄 Updating PAF Core Agent...'
        execSync('git pull origin main', { 
          stdio: 'pipe',
          cwd: pafPath
        })
        spinner.succeed('✅ PAF Core Agent updated')
      } else {
        spinner.succeed('✅ Using existing PAF Core Agent')
      }
      return
    }
    
    // Clone the repository
    execSync('git clone https://github.com/pixell-global/paf-core-agent.git', { 
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    spinner.succeed('✅ PAF Core Agent cloned successfully')
    
    // Set up Python environment with enhanced checking
    await setupPythonEnvironmentEnhanced(pafPath)
    
  } catch (error) {
    spinner.fail('❌ Failed to clone PAF Core Agent')
    throw new Error(`PAF Core Agent clone failed: ${error}`)
  }
}

/**
 * Step 3: Set up Docker environment
 */
async function setupDockerEnvironment(): Promise<void> {
  const spinner = ora('🐳 Setting up Docker environment...').start()
  
  try {
    // Ensure Docker is installed and running (enhanced version)
    await ensureDockerRunning()
    
    // Create PAF Core Agent Dockerfile if it doesn't exist
    await createPafCoreAgentDockerfile()
    
    // Create environment-specific Docker Compose files
    await createEnvironmentDockerFiles()
    
    spinner.succeed('✅ Docker environment configured')
    
  } catch (error) {
    spinner.fail('❌ Failed to setup Docker environment')
    throw new Error(`Docker setup failed: ${error}`)
  }
}

/**
 * Step 4: Create default environments
 */
async function createDefaultEnvironments(): Promise<void> {
  const spinner = ora('🌍 Creating default environments...').start()
  
  try {
    const pixellDir = path.join(process.cwd(), '.pixell')
    const envFile = path.join(pixellDir, 'environments.json')
    
    // Ensure .pixell directory exists
    await fs.ensureDir(pixellDir)
    
    // Check if environments already exist
    let existingEnvironments: EnvironmentConfig[] = []
    if (await fs.pathExists(envFile)) {
      const data = await fs.readJson(envFile)
      existingEnvironments = data.environments || data || []
    }
    
    const now = new Date().toISOString()
    const defaultEnvironments: EnvironmentConfig[] = [
      {
        name: 'local',
        type: 'local',
        description: 'Local development environment with Docker Compose',
        database: {
          host: 'localhost',
          port: 54322,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        supabase: {
          projectUrl: 'http://127.0.0.1:54321',
          anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        },
        pafCoreAgent: {
          url: 'http://localhost:8000'
        },
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        name: 'development',
        type: 'local',
        description: 'Development environment with debugging enabled',
        database: {
          host: 'localhost',
          port: 54332,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        supabase: {
          projectUrl: 'http://127.0.0.1:54331',
          anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        },
        pafCoreAgent: {
          url: 'http://localhost:8001'
        },
        isActive: false,
        createdAt: now,
        updatedAt: now
      },
      {
        name: 'staging',
        type: 'remote',
        description: 'Staging environment (configure with your remote Supabase)',
        database: {},
        supabase: {
          projectUrl: 'https://your-project.supabase.co',
          anonKey: 'your-staging-anon-key',
          serviceRoleKey: 'your-staging-service-key'
        },
        pafCoreAgent: {
          url: 'https://your-staging-paf-core-agent.com'
        },
        isActive: false,
        createdAt: now,
        updatedAt: now
      },
      {
        name: 'production',
        type: 'remote',
        description: 'Production environment (configure with your production Supabase)',
        database: {},
        supabase: {
          projectUrl: 'https://your-project.supabase.co',
          anonKey: 'your-production-anon-key',
          serviceRoleKey: 'your-production-service-key'
        },
        pafCoreAgent: {
          url: 'https://your-production-paf-core-agent.com'
        },
        isActive: false,
        createdAt: now,
        updatedAt: now
      }
    ]
    
    // Merge with existing environments (avoid duplicates)
    const mergedEnvironments = [...existingEnvironments]
    for (const defaultEnv of defaultEnvironments) {
      const existingIndex = mergedEnvironments.findIndex(env => env.name === defaultEnv.name)
      if (existingIndex >= 0) {
        // Update existing environment but preserve user modifications
        mergedEnvironments[existingIndex] = {
          ...defaultEnv,
          ...mergedEnvironments[existingIndex],
          updatedAt: now
        }
      } else {
        mergedEnvironments.push(defaultEnv)
      }
    }
    
    // Save environments
    await fs.writeJson(envFile, { environments: mergedEnvironments }, { spaces: 2 })
    
    spinner.succeed('✅ Default environments created')
    console.log(chalk.blue('\n🌍 Created environments:'))
    mergedEnvironments.forEach(env => {
      console.log(chalk.gray(`   • ${env.name} (${env.type}) ${env.isActive ? '🟢 active' : ''}`))
    })
    
  } catch (error) {
    spinner.fail('❌ Failed to create environments')
    throw new Error(`Environment creation failed: ${error}`)
  }
}

/**
 * Step 5: Initialize Supabase
 */
async function initializeSupabase(): Promise<void> {
  const spinner = ora('🗄️ Initializing Supabase...').start()
  
  try {
    const supabasePath = path.join(process.cwd(), 'supabase')
    
    // Check if Supabase is already initialized
    if (await fs.pathExists(path.join(supabasePath, 'config.toml'))) {
      spinner.succeed('✅ Supabase already initialized')
      return
    }
    
    // Initialize Supabase
    execSync('npx supabase init', { 
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    // Update config.toml with our settings
    await updateSupabaseConfig()
    
    spinner.succeed('✅ Supabase initialized')
    
  } catch (error) {
    spinner.fail('❌ Failed to initialize Supabase')
    throw new Error(`Supabase initialization failed: ${error}`)
  }
}

/**
 * Step 6: Configure AI providers
 */
async function configureAIProviders(): Promise<void> {
  console.log(chalk.blue('\n🤖 AI Provider Configuration'))
  console.log(chalk.blue('='.repeat(40)))
  
  const envPath = path.join(process.cwd(), '.env.local')
  let envContent = ''
  
  if (await fs.pathExists(envPath)) {
    envContent = await fs.readFile(envPath, 'utf8')
  }
  
  // Check if OpenAI API key is already configured
  if (envContent.includes('OPENAI_API_KEY=sk-')) {
    console.log(chalk.green('✅ OpenAI API key already configured'))
    
    // Extract the API key and ensure it's also in .env for Docker
    const apiKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/)
    if (apiKeyMatch && apiKeyMatch[1]) {
      const dockerEnvPath = path.join(process.cwd(), '.env')
      let dockerEnvContent = ''
      
      if (await fs.pathExists(dockerEnvPath)) {
        dockerEnvContent = await fs.readFile(dockerEnvPath, 'utf8')
      }
      
      if (!dockerEnvContent.includes('OPENAI_API_KEY=')) {
        const dockerEnvLines = dockerEnvContent.split('\n').filter(line => !line.startsWith('OPENAI_API_KEY='))
        dockerEnvLines.push(`OPENAI_API_KEY=${apiKeyMatch[1]}`)
        
        // Add other defaults if not present
        if (!dockerEnvContent.includes('ANTHROPIC_API_KEY=')) {
          dockerEnvLines.push('ANTHROPIC_API_KEY=')
        }
        if (!dockerEnvContent.includes('AWS_REGION=')) {
          dockerEnvLines.push('AWS_REGION=us-east-1')
        }
        if (!dockerEnvContent.includes('DEBUG=')) {
          dockerEnvLines.push('DEBUG=false')
        }
        
        await fs.writeFile(dockerEnvPath, dockerEnvLines.filter(line => line.trim()).join('\n') + '\n')
      }
    }
  } else {
    const aiConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'openaiKey',
        message: 'Enter your OpenAI API key (optional, press Enter to skip):',
        validate: (input) => {
          if (!input) return true
          return input.startsWith('sk-') || 'OpenAI API key should start with "sk-"'
        }
      }
    ])
    
    if (aiConfig.openaiKey) {
      // Update .env.local
      const envLines = envContent.split('\n').filter(line => !line.startsWith('OPENAI_API_KEY='))
      envLines.push(`OPENAI_API_KEY=${aiConfig.openaiKey}`)
      await fs.writeFile(envPath, envLines.join('\n') + '\n')
      
      // Also create/update .env file for Docker Compose
      const dockerEnvPath = path.join(process.cwd(), '.env')
      let dockerEnvContent = ''
      
      if (await fs.pathExists(dockerEnvPath)) {
        dockerEnvContent = await fs.readFile(dockerEnvPath, 'utf8')
      }
      
      const dockerEnvLines = dockerEnvContent.split('\n').filter(line => !line.startsWith('OPENAI_API_KEY='))
      dockerEnvLines.push(`OPENAI_API_KEY=${aiConfig.openaiKey}`)
      
      // Add other defaults if not present
      if (!dockerEnvContent.includes('ANTHROPIC_API_KEY=')) {
        dockerEnvLines.push('ANTHROPIC_API_KEY=')
      }
      if (!dockerEnvContent.includes('AWS_REGION=')) {
        dockerEnvLines.push('AWS_REGION=us-east-1')
      }
      if (!dockerEnvContent.includes('DEBUG=')) {
        dockerEnvLines.push('DEBUG=false')
      }
      
      await fs.writeFile(dockerEnvPath, dockerEnvLines.filter(line => line.trim()).join('\n') + '\n')
      console.log(chalk.green('✅ OpenAI API key configured'))
    } else {
      console.log(chalk.yellow('⚠️ OpenAI API key skipped - you can configure it later'))
    }
  }
}

/**
 * Step 7: Start all services
 */
async function startAllServices(environment: string): Promise<void> {
  const spinner = ora(`🚀 Starting all services for ${environment} environment...`).start()
  
  try {
    // Start Docker Compose services
    const composeFiles = [
      '-f', 'docker-compose.yml'
    ]
    
    if (environment === 'local' || environment === 'development') {
      composeFiles.push('-f', 'docker-compose.dev.yml')
    }
    
    // Start services in detached mode
    spawn('docker', ['compose', ...composeFiles, 'up', '-d'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      detached: true
    })
    
    // Wait for services to start
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Health check for key services
    await healthCheckServices()
    
    spinner.succeed('✅ All services started successfully')
    
  } catch (error) {
    spinner.fail('❌ Failed to start services')
    throw new Error(`Service startup failed: ${error}`)
  }
}

/**
 * Helper function to create PAF Core Agent Dockerfile
 */
async function createPafCoreAgentDockerfile(): Promise<void> {
  const dockerfilePath = path.join(process.cwd(), 'paf-core-agent', 'Dockerfile')
  
  if (await fs.pathExists(dockerfilePath)) {
    return // Dockerfile already exists
  }
  
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

/**
 * Helper function to create environment-specific Docker files
 */
async function createEnvironmentDockerFiles(): Promise<void> {
  // Create .env file for Docker Compose
  const envDockerPath = path.join(process.cwd(), '.env.docker')
  const envDockerContent = `# Docker Compose Environment Variables
OPENAI_API_KEY=${process.env.OPENAI_API_KEY || 'your-openai-api-key'}
ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key'}
AWS_REGION=${process.env.AWS_REGION || 'us-east-1'}
DEBUG=false
MAX_CONTEXT_TOKENS=4000
DEFAULT_MODEL=gpt-3.5-turbo
`
  
  await fs.writeFile(envDockerPath, envDockerContent)
}

/**
 * Helper function to update Supabase config
 */
async function updateSupabaseConfig(): Promise<void> {
  const configPath = path.join(process.cwd(), 'supabase', 'config.toml')
  
  if (await fs.pathExists(configPath)) {
    let config = await fs.readFile(configPath, 'utf8')
    
    // Update ports to match our Docker Compose setup
    config = config.replace(/db_port = 54322/, 'db_port = 54322')
    config = config.replace(/api_port = 54321/, 'api_port = 54321')
    config = config.replace(/studio_port = 54323/, 'studio_port = 54323')
    
    await fs.writeFile(configPath, config)
  }
}

/**
 * Helper function for health checks
 */
async function healthCheckServices(): Promise<void> {
  const services = [
    { name: 'PAF Core Agent', url: 'http://localhost:8000/api/health' },
    { name: 'Supabase REST', url: 'http://localhost:54321/rest/v1/' },
    { name: 'Supabase Studio', url: 'http://localhost:54323' }
  ]
  
  for (const service of services) {
    try {
      await execa('curl', ['-f', service.url], { timeout: 5000 })
      console.log(chalk.green(`   ✅ ${service.name} is healthy`))
    } catch {
      console.log(chalk.yellow(`   ⚠️ ${service.name} is starting up...`))
    }
  }
}

/**
 * Display success information
 */
function displaySuccessInfo(): void {
  console.log(chalk.green.bold('\n🎉 SETUP COMPLETE!'))
  console.log(chalk.green('='.repeat(50)))
  
  console.log(chalk.blue('\n📍 Services are running at:'))
  console.log(chalk.gray('   • Frontend: http://localhost:3003'))
  console.log(chalk.gray('   • Backend: http://localhost:3001'))
  console.log(chalk.gray('   • PAF Core Agent: http://localhost:8000'))
  console.log(chalk.gray('   • Supabase REST: http://localhost:54321'))
  console.log(chalk.gray('   • Supabase Studio: http://localhost:54323'))
  console.log(chalk.gray('   • Database: localhost:54322'))
  
  console.log(chalk.blue('\n🛠️ Useful commands:'))
  console.log(chalk.white('   • npm run dev - Start frontend and backend'))
  console.log(chalk.white('   • pixell services:status - Check service health'))
  console.log(chalk.white('   • pixell env - Manage environments'))
  console.log(chalk.white('   • docker compose logs -f - View service logs'))
  
  console.log(chalk.blue('\n📚 Next steps:'))
  console.log(chalk.gray('   1. Visit http://localhost:3003 to see the web interface'))
  console.log(chalk.gray('   2. Check http://localhost:8000/docs for PAF Core Agent API'))
  console.log(chalk.gray('   3. Use http://localhost:54323 for database management'))
  console.log(chalk.gray('   4. Run "npm run dev" to start the main applications'))
  
  console.log(chalk.green('\n🚀 Your Pixell Agent Framework is ready for development!'))
}

/**
 * Enhanced Python environment setup with comprehensive checking
 */
async function setupPythonEnvironmentEnhanced(targetPath: string): Promise<void> {
  const spinner = ora('🐍 Setting up Python environment...').start()
  
  try {
    // Check Python environment using enhanced checker
    const pythonStatus = await checkPythonEnvironment()
    
    if (!pythonStatus.python3Available) {
      spinner.fail('❌ Python 3.11+ is required but not available')
      console.log(chalk.yellow('💡 Python 3.11+ was checked during system dependencies'))
      console.log(chalk.yellow('💡 Please ensure Python is properly installed and try again'))
      throw new Error('Python 3.11+ not available')
    }
    
    if (!pythonStatus.venvSupported) {
      spinner.fail('❌ Python venv module is not available')
      console.log(chalk.yellow('💡 Please ensure Python venv module is installed'))
      console.log(chalk.gray('   • On Ubuntu/Debian: sudo apt install python3-venv'))
      console.log(chalk.gray('   • On CentOS/RHEL: sudo yum install python3-venv'))
      throw new Error('Python venv module not available')
    }
    
    spinner.text = `🐍 Creating virtual environment (Python ${pythonStatus.version})...`
    
    // Create virtual environment
    execSync('python3 -m venv venv', {
      cwd: targetPath,
      stdio: 'pipe'
    })
    
    // Determine correct paths for different platforms
    const isWindows = process.platform === 'win32'
    const venvBinDir = isWindows ? 'Scripts' : 'bin'
    const pythonCmd = path.join(targetPath, 'venv', venvBinDir, isWindows ? 'python.exe' : 'python')
    const pipCmd = path.join(targetPath, 'venv', venvBinDir, isWindows ? 'pip.exe' : 'pip')
    
    // Upgrade pip
    spinner.text = '📦 Upgrading pip...'
    execSync(`"${pipCmd}" install --upgrade pip`, {
      cwd: targetPath,
      stdio: 'pipe'
    })
    
    // Install requirements if they exist
    const requirementsPath = path.join(targetPath, 'requirements.txt')
    if (await fs.pathExists(requirementsPath)) {
      spinner.text = '📦 Installing Python dependencies...'
      execSync(`"${pipCmd}" install -r requirements.txt`, {
        cwd: targetPath,
        stdio: 'pipe'
      })
    }
    
    // Create .env file if it doesn't exist
    const envPath = path.join(targetPath, '.env')
    if (!await fs.pathExists(envPath)) {
      const envExamplePath = path.join(targetPath, '.env.example')
      if (await fs.pathExists(envExamplePath)) {
        await fs.copy(envExamplePath, envPath)
        spinner.text = '⚙️ Created .env file from template...'
      }
    }
    
    spinner.succeed(`✅ Python environment ready (${pythonStatus.version})`)
    
    console.log(chalk.blue('\n🐍 Python Environment Details:'))
    console.log(chalk.gray(`   Python Version: ${pythonStatus.version}`))
    console.log(chalk.gray(`   Virtual Environment: ${path.join(targetPath, 'venv')}`))
    console.log(chalk.gray(`   Activate Command: ${isWindows ? 'venv\\Scripts\\activate' : 'source venv/bin/activate'}`))
    
  } catch (error) {
    spinner.fail('❌ Python environment setup failed')
    console.log(chalk.yellow('\n💡 Manual Python setup:'))
    console.log(chalk.white(`   cd ${targetPath}`))
    console.log(chalk.white('   python3 -m venv venv'))
    console.log(chalk.white('   source venv/bin/activate  # or venv\\Scripts\\activate on Windows'))
    console.log(chalk.white('   pip install --upgrade pip'))
    console.log(chalk.white('   pip install -r requirements.txt'))
    throw error
  }
}