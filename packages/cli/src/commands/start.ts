import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync, spawn, ChildProcess } from 'child_process'
import execa from 'execa'
import path from 'path'
import fs from 'fs-extra'
import { checkDockerInstallation, checkDockerEngineRunning, installDocker } from './docker'

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
  description?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Main start command - validates environment, checks docker/supabase, and starts the project
 */
export async function startProject(options: { env?: string }) {
  const envName = options.env || 'local'
  
  console.log(chalk.blue.bold('\n🚀 PIXELL PROJECT STARTUP'))
  console.log(chalk.blue('='.repeat(50)))
  console.log(chalk.gray(`Starting with environment: ${envName}`))
  
  try {
    // Load environment variables from env-specific files
    loadEnvFiles(envName)

    // Validate Firebase env presence and warn early if missing
    validateFirebaseEnv()
    
    // Step 1: Check if environment exists
    const environment = await validateEnvironment(envName)
    
    // Step 2: Check Supabase setup for the environment
    await validateSupabaseSetup(environment)
    
    // NEW: ensure .env.local has Supabase vars for active environment
    await ensureEnvFileSupabase(environment)
    
    // Step 3: Check Docker status
    await validateDockerSetup()
    
    // Step 4: Start the project
    await runProject(envName)
    
  } catch (error) {
    console.log(chalk.red('\n❌ Startup failed'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

/**
 * Step 1: Validate that the environment exists and is configured
 */
async function validateEnvironment(envName: string): Promise<EnvironmentConfig> {
  const spinner = ora(`🔍 Checking environment: ${envName}`).start()
  
  try {
    const environments = await getEnvironmentsConfig()
    
    // Check if environments is an array and has items
    if (!Array.isArray(environments) || environments.length === 0) {
      spinner.fail('❌ No environments configured')
      console.log(chalk.yellow('\n⚠️  No environments found!'))
      console.log(chalk.gray('You need to create environments first.'))
      console.log(chalk.blue('Run: npm run pixell env'))
      throw new Error('No environments configured. Please run "npm run pixell env" first.')
    }
    
    const environment = environments.find(env => env?.name?.toLowerCase() === envName.toLowerCase())
    
    if (!environment) {
      spinner.fail(`❌ Environment "${envName}" not found`)
      console.log(chalk.yellow('\n📋 Available environments:'))
      environments.forEach(env => {
        if (env?.name) {
          console.log(chalk.gray(`   • ${env.name} (${env.type || 'unknown'}) ${env.isActive ? '🟢 active' : ''}`))
        }
      })
      throw new Error(`Environment "${envName}" not found. Use one of the available environments above.`)
    }
    
    spinner.succeed(`✅ Environment "${envName}" found (${environment.type})`)
    
    // Show environment info
    console.log(chalk.blue(`\n🌍 Environment Details:`))
    console.log(chalk.gray(`   Name: ${environment.name}`))
    console.log(chalk.gray(`   Type: ${environment.type}`))
    if (environment.description) {
      console.log(chalk.gray(`   Description: ${environment.description}`))
    }
    console.log(chalk.gray(`   Status: ${environment.isActive ? '🟢 Active' : '⚪ Inactive'}`))
    
    return environment
    
  } catch (error) {
    spinner.fail('❌ Environment validation failed')
    throw error
  }
}

/**
 * Step 2: Validate Supabase setup for the environment
 */
async function validateSupabaseSetup(environment: EnvironmentConfig): Promise<void> {
  const spinner = ora(`🗄️  Checking Supabase setup for ${environment.name}`).start()
  
  try {
    if (environment.type === 'local') {
      // For local environment, check if local Supabase is configured
      const supabasePath = path.join(process.cwd(), 'supabase')
      
      if (!await fs.pathExists(supabasePath)) {
        spinner.fail('❌ Local Supabase not initialized')
        console.log(chalk.yellow('\n⚠️  Local Supabase is not set up!'))
        console.log(chalk.gray('Local development requires Supabase to be initialized.'))
        console.log(chalk.blue('Run: npm run pixell supabase-init'))
        throw new Error('Local Supabase not initialized. Please run "npm run pixell supabase-init" first.')
      }
      
      // Check if config.toml exists
      const configPath = path.join(supabasePath, 'config.toml')
      if (!await fs.pathExists(configPath)) {
        spinner.fail('❌ Supabase configuration missing')
        throw new Error('Supabase configuration file missing. Please run "npm run pixell supabase-init".')
      }
      
      spinner.succeed('✅ Local Supabase configured')
      console.log(chalk.blue(`\n🗄️  Supabase Info:`))
      console.log(chalk.gray(`   Type: Local Development`))
      console.log(chalk.gray(`   Database: http://127.0.0.1:54321`))
      console.log(chalk.gray(`   Studio: http://127.0.0.1:54323`))
      
    } else {
      // For remote environment, check if Supabase credentials are set
      if (!environment.supabase?.projectUrl || !environment.supabase?.anonKey) {
        spinner.fail('❌ Remote Supabase not configured')
        console.log(chalk.yellow('\n⚠️  Remote Supabase credentials missing!'))
        console.log(chalk.gray(`Environment "${environment.name}" requires Supabase credentials.`))
        console.log(chalk.blue('Run: npm run pixell env'))
        throw new Error(`Remote Supabase not configured for environment "${environment.name}". Please configure it using "npm run pixell env".`)
      }
      
      spinner.succeed('✅ Remote Supabase configured')
      console.log(chalk.blue(`\n🗄️  Supabase Info:`))
      console.log(chalk.gray(`   Type: Remote (${environment.supabase.projectUrl})`))
      console.log(chalk.gray(`   Project: ${maskUrl(environment.supabase.projectUrl)}`))
      console.log(chalk.gray(`   Anon Key: ${maskKey(environment.supabase.anonKey)}`))
    }
    
  } catch (error) {
    spinner.fail('❌ Supabase validation failed')
    throw error
  }
}

/**
 * Step 3: Validate Docker setup (required for local Supabase)
 */
async function validateDockerSetup(): Promise<void> {
  const spinner = ora('🐳 Checking Docker status').start()
  
  try {
    const dockerInstalled = await checkDockerInstallation()
    
    if (!dockerInstalled) {
      spinner.warn('⚠️  Docker not installed')
      console.log(chalk.yellow('\n🐳 Docker is required for local Supabase development'))
      
      const shouldInstall = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'install',
          message: 'Would you like to install Docker automatically?',
          default: true
        }
      ])
      
      if (!shouldInstall.install) {
        throw new Error('Docker installation declined. Docker is required for local development.')
      }
      
      spinner.text = '🐳 Installing Docker...'
      await installDocker()
      spinner.succeed('✅ Docker installed successfully')
      console.log(chalk.blue('\n🐳 Docker Status: Installed and ready'))
      return
    }
    
    const dockerRunning = await checkDockerEngineRunning()
    
    if (!dockerRunning) {
      spinner.warn('⚠️  Docker installed but not running')
      console.log(chalk.yellow('\n🐳 Docker is installed but not running'))
      
      const shouldStart = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'start',
          message: 'Would you like to start Docker now?',
          default: true
        }
      ])
      
      if (!shouldStart.start) {
        throw new Error('Docker not running. Please start Docker and try again.')
      }
      
      spinner.text = '🐳 Starting Docker...'
      await startDocker()
      spinner.succeed('✅ Docker started successfully')
      console.log(chalk.blue('\n🐳 Docker Status: Running'))
    } else {
      spinner.succeed('✅ Docker is running')
      console.log(chalk.blue('\n🐳 Docker Status: Running'))
    }
    
  } catch (error) {
    spinner.fail('❌ Docker validation failed')
    throw error
  }
}

/**
 * Step 4: Start the project with the appropriate npm script
 */
async function runProject(envName: string): Promise<void> {
  const spinner = ora('🚀 Starting project...').start()
  
  try {
    // Map environment names to npm scripts
    const scriptMap: { [key: string]: string } = {
      'local': 'dev',
      'development': 'dev',
      'dev': 'dev',
      'staging': 'dev', // Could be different if you have staging-specific scripts
      'production': 'start', // Assuming production uses 'start' script
      'prod': 'start'
    }
    
    const scriptName = scriptMap[envName.toLowerCase()] || 'dev'
    
    spinner.succeed(`✅ All checks passed! Starting with "npm run ${scriptName}"`)
    
    console.log(chalk.green.bold('\n🎉 STARTUP COMPLETE'))
    console.log(chalk.green('='.repeat(50)))
    console.log(chalk.blue(`🌐 Environment: ${envName}`))
    console.log(chalk.blue(`📋 Script: npm run ${scriptName}`))
    console.log(chalk.gray('\n📍 Services will be available at:'))
    console.log(chalk.gray('   • Frontend: http://localhost:3003'))
    console.log(chalk.gray('   • Backend: http://localhost:3001'))
    console.log(chalk.gray('   • Database Studio: http://127.0.0.1:54323'))
    console.log(chalk.gray('\n💡 To start PAF Core Agent separately, run: pixell start core-agent'))
    console.log(chalk.gray('\n⏳ Starting services...\n'))
    
    // Start the main project
    execSync(`npm run ${scriptName}`, { 
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, PIXELL_ENV: envName }
    })
    
  } catch (error) {
    spinner.fail('❌ Failed to start project')
    throw error
  }
}

/**
 * Start PAF Core Agent as a separate process
 */
export async function startPafCoreAgent(): Promise<ChildProcess | null> {
  const pafCoreAgentPath = path.join(process.cwd(), 'paf-core-agent')
  
  // Check if PAF Core Agent directory exists
  if (!(await fs.pathExists(pafCoreAgentPath))) {
    console.log(chalk.yellow('⚠️ PAF Core Agent directory not found, skipping...'))
    return null
  }
  
  // Check if it's a valid PAF Core Agent installation
  const requirementsPath = path.join(pafCoreAgentPath, 'requirements.txt')
  const mainPath = path.join(pafCoreAgentPath, 'app', 'main.py')
  
  if (!(await fs.pathExists(requirementsPath)) || !(await fs.pathExists(mainPath))) {
    console.log(chalk.yellow('⚠️ PAF Core Agent not properly installed, skipping...'))
    return null
  }
  
  console.log(chalk.blue('🧠 Starting PAF Core Agent...'))
  
  try {
    // Check if virtual environment exists, create if it doesn't
    const venvPath = path.join(pafCoreAgentPath, 'venv')
    if (!(await fs.pathExists(venvPath))) {
      console.log(chalk.gray('📦 Creating Python virtual environment...'))
      execSync('python3 -m venv venv', { cwd: pafCoreAgentPath, stdio: 'inherit' })
    }
    
    // Check if dependencies are installed
    const isWindows = process.platform === 'win32'
    const activateCmd = isWindows ? 'venv\\Scripts\\activate.bat' : 'source venv/bin/activate'
    const shellCmd = isWindows ? 'cmd' : 'bash'
    const shellArgs = isWindows ? ['/c'] : ['-c']
    
    try {
      execSync(`${activateCmd} && python -c "import fastapi"`, { 
        cwd: pafCoreAgentPath, 
        stdio: 'pipe',
        shell: shellCmd
      })
    } catch {
      console.log(chalk.gray('📦 Installing PAF Core Agent dependencies...'))
      execSync(`${activateCmd} && pip install -r requirements.txt`, { 
        cwd: pafCoreAgentPath, 
        stdio: 'inherit',
        shell: shellCmd
      })
    }
    
    // Start PAF Core Agent using the start script
    const startScriptPath = path.join(pafCoreAgentPath, 'scripts', 'start.sh')
    let pafProcess: ChildProcess
    
    if (await fs.pathExists(startScriptPath)) {
      // Make script executable and run it
      execSync('chmod +x scripts/start.sh', { cwd: pafCoreAgentPath })
      pafProcess = spawn('./scripts/start.sh', [], {
        cwd: pafCoreAgentPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      })
    } else {
      // Fallback to direct uvicorn command
      if (isWindows) {
        pafProcess = spawn('cmd', ['/c', 'venv\\Scripts\\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload'], {
          cwd: pafCoreAgentPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        })
      } else {
        pafProcess = spawn('bash', ['-c', 'source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload'], {
          cwd: pafCoreAgentPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        })
      }
    }
    
    // Handle PAF Core Agent output
    pafProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim()
      if (output) {
        console.log(chalk.gray(`[PAF Core Agent] ${output}`))
      }
    })
    
    pafProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim()
      if (output) {
        // On Windows, pip info messages may appear in stderr, so treat them as normal output
        if (output.includes('INFO') || output.includes('WARNING') || output.includes('Successfully installed')) {
          console.log(chalk.gray(`[PAF Core Agent] ${output}`))
        } else {
          console.log(chalk.red(`[PAF Core Agent Error] ${output}`))
        }
      }
    })
    
    pafProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(chalk.red(`❌ PAF Core Agent exited with code ${code}`))
      }
    })
    
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log(chalk.green('✅ PAF Core Agent started successfully'))
    return pafProcess
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to start PAF Core Agent: ${error instanceof Error ? error.message : String(error)}`))
    return null
  }
}

/**
 * Start PAF Core Agent command - for use with 'pixell start core-agent'
 */
export async function startPafCoreAgentCommand(): Promise<void> {
  console.log(chalk.blue.bold('\n🧠 STARTING PAF CORE AGENT'))
  console.log(chalk.blue('='.repeat(50)))
  
  try {
    const pafProcess = await startPafCoreAgent()
    
    if (!pafProcess) {
      console.log(chalk.red('\n❌ Failed to start PAF Core Agent'))
      return
    }
    
    console.log(chalk.green('\n🎉 PAF Core Agent started successfully!'))
    console.log(chalk.gray('\n📍 Available at:'))
    console.log(chalk.gray('   • API: http://localhost:8000'))
    console.log(chalk.gray('   • Docs: http://localhost:8000/docs'))
    console.log(chalk.gray('   • Health: http://localhost:8000/api/health'))
    console.log(chalk.gray('\n📋 Press Ctrl+C to stop the PAF Core Agent\n'))
    
    // Set up cleanup on exit
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down PAF Core Agent...'))
      if (pafProcess && !pafProcess.killed) {
        pafProcess.kill('SIGTERM')
      }
      process.exit(0)
    })
    
    process.on('SIGTERM', () => {
      if (pafProcess && !pafProcess.killed) {
        pafProcess.kill('SIGTERM')
      }
    })
    
    // Keep the process running
    pafProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(chalk.red(`\n❌ PAF Core Agent exited with code ${code}`))
      } else {
        console.log(chalk.gray('\n👋 PAF Core Agent stopped'))
      }
      process.exit(code || 0)
    })
    
    // Keep the main process alive
    await new Promise(() => {}) // This will run indefinitely until killed
    
  } catch (error) {
    console.log(chalk.red('\n❌ Failed to start PAF Core Agent'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

/**
 * Helper functions
 */

async function getEnvironmentsConfig(): Promise<EnvironmentConfig[]> {
  const configPath = path.join(process.cwd(), '.pixell', 'environments.json')
  
  try {
    if (await fs.pathExists(configPath)) {
      const data = await fs.readJson(configPath)
      
      // Handle the structure { "environments": [...] }
      if (data && data.environments && Array.isArray(data.environments)) {
        return data.environments
      }
      // Fallback: if data is directly an array
      else if (Array.isArray(data)) {
        return data
      } 
      // Fallback: if it's a single environment object
      else if (data && typeof data === 'object' && data.name) {
        return [data]
      }
    }
    return []
  } catch (error) {
    console.error(chalk.gray(`Warning: Could not read environments config: ${error}`))
    return []
  }
}

async function startDocker(): Promise<void> {
  const platform = process.platform
  
  if (platform === 'darwin') {
    // macOS - start Docker Desktop
    await execa('open', ['-a', 'Docker'])
    // Wait a bit for Docker to start
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Wait for Docker to be ready
    let attempts = 0
    while (attempts < 30) { // Wait up to 30 seconds
      try {
        await execa('docker', ['ps'])
        return
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
    }
    throw new Error('Docker failed to start within 30 seconds')
    
  } else if (platform === 'win32') {
    // Windows - start Docker Desktop
    await execa('cmd', ['/c', 'start', 'docker'])
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Wait for Docker to be ready
    let attempts = 0
    while (attempts < 30) {
      try {
        await execa('docker', ['ps'])
        return
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
    }
    throw new Error('Docker failed to start within 30 seconds')
    
  } else {
    // Linux - start docker service
    try {
      await execa('sudo', ['systemctl', 'start', 'docker'])
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {
      throw new Error('Failed to start Docker service. Please start Docker manually.')
    }
  }
}

function maskUrl(url: string): string {
  if (!url) return ''
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.hostname}...`
  } catch {
    return url.substring(0, 20) + '...'
  }
}

function maskKey(key: string): string {
  if (!key) return ''
  return key.substring(0, 12) + '...' + '*'.repeat(8)
}

/**
 * Utility: load env files into process.env so child processes inherit them
 * Priority order (first found wins for each var):
 *  - .env.dev (root)
 *  - apps/web/.env.dev
 *  - .env.local (root)
 *  - apps/web/.env.local
 *  - .env (root)
 *  - apps/web/.env
 * Additionally, if envName provided, try .env.<envName> in root and apps/web just after .env.dev.
 */
function loadEnvFiles(envName?: string) {
  try {
    const cwd = process.cwd()
    const loaded: string[] = []

    // STRICT mapping: if env provided, use ONLY root .env.<env>
    if (envName) {
      const p = path.join(cwd, `.env.${envName}`)
      if (fs.existsSync(p)) {
        const applied = applyEnvFile(p)
        if (applied) loaded.push(p)
      }
    } else {
      // If no env provided, try root .env.local, then .env
      const candidates = [path.join(cwd, '.env.local'), path.join(cwd, '.env')]
      for (const p of candidates) {
        if (!fs.existsSync(p)) continue
        const applied = applyEnvFile(p)
        if (applied) loaded.push(p)
      }
    }

    if (loaded.length) {
      console.log(chalk.gray(`\n🧩 Using env file:`))
      loaded.forEach(p => console.log(chalk.gray(`   • ${path.relative(cwd, p)}`)))
    } else {
      console.log(chalk.yellow(`\n⚠️  No env file found for "${envName ?? 'default'}"`))
    }
  } catch (err) {
    console.warn('Warning: failed to load env files', err)
  }
}

/**
 * Minimal .env parser and applier. Only handles KEY=VALUE with optional quotes.
 * Does not override variables that are already set in process.env.
 */
function applyEnvFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    let appliedAny = false
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIndex = line.indexOf('=')
      if (eqIndex === -1) continue
      const key = line.substring(0, eqIndex).trim()
      let value = line.substring(eqIndex + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) {
        process.env[key] = value
        appliedAny = true
      }
    }
    return appliedAny
  } catch {
    return false
  }
}

/**
 * Sync Firebase NEXT_PUBLIC_* vars into apps/web/.env.local so Next.js picks them up in dev
 */
async function ensureEnvFileFirebase(): Promise<void> {
  try {
    const keys = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ]

    // Prefer values from env-specific files directly to avoid relying on process.env
    const envName = process.argv.includes('--env')
      ? process.argv[process.argv.indexOf('--env') + 1]
      : undefined
    const fromFiles = await collectEnvValues(keys, envName)

    // If nothing parsed from files, fall back to process.env
    const values: Record<string, string> = {}
    for (const k of keys) {
      const v = fromFiles[k] ?? process.env[k]
      if (v && String(v).trim() !== '') values[k] = String(v)
    }
    if (Object.keys(values).length === 0) return

    const webEnvPath = path.join(process.cwd(), 'apps', 'web', '.env.local')
    let existing = ''
    if (await fs.pathExists(webEnvPath)) {
      existing = await fs.readFile(webEnvPath, 'utf8')
    }
    const lines = existing.split('\n').filter(Boolean)
    const filtered = lines.filter(l => !keys.some(k => l.startsWith(`${k}=`)))
    for (const k of Object.keys(values)) {
      filtered.push(`${k}=${values[k]}`)
    }
    await fs.writeFile(webEnvPath, filtered.join('\n') + '\n', 'utf8')
  } catch (err) {
    console.warn('Warning: failed to write Firebase vars to apps/web/.env.local', err)
  }
}

/**
 * Parse env-specific files and collect values for selected keys
 */
async function collectEnvValues(keys: string[], envName?: string): Promise<Record<string, string>> {
  const cwd = process.cwd()
  const webDir = path.join(cwd, 'apps', 'web')
  const order: string[] = []
  if (envName) {
    order.push(path.join(cwd, `.env.${envName}`))
    order.push(path.join(webDir, `.env.${envName}`))
  }
  order.push(path.join(cwd, '.env.local'))
  order.push(path.join(webDir, '.env.local'))
  order.push(path.join(cwd, '.env'))
  order.push(path.join(webDir, '.env'))

  const result: Record<string, string> = {}
  for (const p of order) {
    if (!fs.existsSync(p)) continue
    try {
      const content = await fs.readFile(p, 'utf8')
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const k = line.substring(0, eq).trim()
        if (!keys.includes(k)) continue
        let v = line.substring(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (result[k] === undefined) {
          result[k] = v
        }
      }
    } catch {}
  }
  return result
}

/**
 * Check presence of required Firebase envs and print clear guidance if missing
 */
function validateFirebaseEnv() {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ]
  const missing = required.filter(k => !process.env[k] || String(process.env[k]).trim() === '')
  if (missing.length) {
    console.log(chalk.yellow('\n⚠️  Missing Firebase env variables:'))
    missing.forEach(k => console.log(chalk.yellow(`   • ${k}`)))
    console.log(chalk.gray('\nTips:'))
    console.log(chalk.gray(' - Add them to .env.dev or apps/web/.env.dev for local dev'))
    console.log(chalk.gray(' - Or place them in .env.local /.env in root or apps/web'))
    console.log(chalk.gray(' - Ensure keys match your Firebase project and are not restricted'))
  }
}

/**
 * Utility: ensure .env.local contains Supabase vars for the given environment
 */
async function ensureEnvFileSupabase(env: EnvironmentConfig): Promise<void> {
  try {
    if (!env.supabase?.projectUrl || !env.supabase?.anonKey) return // nothing to write

    const envPath = path.join(process.cwd(), '.env.local')
    let content = ''

    if (await fs.pathExists(envPath)) {
      content = await fs.readFile(envPath, 'utf8')
    }

    const lines = content.split('\n').filter(Boolean)

    // remove existing Supabase lines
    const filtered = lines.filter(l => !l.startsWith('NEXT_PUBLIC_SUPABASE_URL=') && !l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='))

    filtered.push(`NEXT_PUBLIC_SUPABASE_URL=${env.supabase.projectUrl}`)
    filtered.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.supabase.anonKey}`)

    await fs.writeFile(envPath, filtered.join('\n') + '\n', 'utf8')

    // also ensure web app has its own .env.local
    const webEnvPath = path.join(process.cwd(), 'apps', 'web', '.env.local')
    let webContent = ''
    if (await fs.pathExists(webEnvPath)) {
      webContent = await fs.readFile(webEnvPath, 'utf8')
    }
    const wLines = webContent.split('\n').filter(Boolean)
    const wFiltered = wLines.filter(l => !l.startsWith('NEXT_PUBLIC_SUPABASE_URL=') && !l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='))
    wFiltered.push(`NEXT_PUBLIC_SUPABASE_URL=${env.supabase.projectUrl}`)
    wFiltered.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.supabase.anonKey}`)
    await fs.writeFile(webEnvPath, wFiltered.join('\n') + '\n', 'utf8')
  } catch (err) {
    console.warn('Warning: failed to write Supabase vars to .env.local', err)
  }
} 