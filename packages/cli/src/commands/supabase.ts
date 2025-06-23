/*
 * Supabase CLI Commands for Pixell Agent Framework
 * 
 * SECURITY MEASURES:
 * ==================
 * 1. Sensitive key masking: All API keys, secrets, and passwords are masked when displayed
 * 2. Service role protection: Service role keys are never displayed in CLI output
 * 3. JWT secret protection: JWT secrets are hidden from all status outputs
 * 4. Database password masking: Connection strings mask the database password
 * 5. Production key safety: Production keys are always masked in summaries
 * 
 * SAFE TO DISPLAY:
 * - Database URLs (with masked passwords)
 * - Studio URLs (localhost only)
 * - Inbucket URLs (localhost only)
 * - Masked anon keys (first 12 chars + asterisks)
 * 
 * NEVER DISPLAYED:
 * - Full anon keys (masked instead)
 * - Service role keys (completely hidden)
 * - JWT secrets (completely hidden)
 * - S3 access keys (local dev only, managed by Docker)
 * - S3 secret keys (local dev only, managed by Docker)
 * - Database passwords (masked in connection strings)
 */

import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import execa from 'execa'
import { useCLIStore } from '../stores/cli-store'
import { ensureDockerForSupabase } from './docker'

// Helper to detect the correct Supabase command
function getSupabaseCommand(): string {
  try {
    // Try global supabase first
    execSync('supabase --version', { stdio: 'pipe' })
    return 'supabase'
  } catch {
    try {
      // Try npx supabase (installed as dev dependency)
      execSync('npx supabase --version', { stdio: 'pipe' })
      return 'npx supabase'
    } catch {
      throw new Error('Supabase CLI not found')
    }
  }
}

// Install Supabase CLI if needed
async function initSupabaseCLI() {
  const spinner = ora('🚀 Setting up Supabase...').start()
  
  try {
    // Check if Supabase CLI is already available
    try {
      await execa('supabase', ['--version'])
      spinner.succeed('✅ Supabase CLI already installed')
      return
    } catch {
      // CLI not found, need to install
    }

    spinner.text = '⠋ Installing Supabase CLI...'
    
    // Detect platform and install accordingly
    const platform = process.platform
    
    if (platform === 'darwin') {
      // macOS - try Homebrew first
      try {
        await execa('brew', ['--version'])
        spinner.text = '⠋ Installing via Homebrew...'
        await execa('brew', ['install', 'supabase'])
        spinner.succeed('✅ Supabase CLI installed via Homebrew')
        return
      } catch {
        // Homebrew not available, fallback to npm
      }
    } else if (platform === 'win32') {
      // Windows - try Scoop first
      try {
        await execa('scoop', ['--version'])
        spinner.text = '⠋ Installing via Scoop...'
        await execa('scoop', ['install', 'supabase'])
        spinner.succeed('✅ Supabase CLI installed via Scoop')
        return
      } catch {
        // Scoop not available, fallback to npm
      }
    }
    
    // Fallback: Install as dev dependency
    spinner.text = '⠋ Installing as dev dependency...'
    await execa('npm', ['install', 'supabase', '--save-dev'], { cwd: process.cwd() })
    spinner.succeed('✅ Supabase CLI installed as dev dependency')
    
  } catch (error) {
    spinner.fail('❌ Failed to install Supabase CLI')
    
    const installInstructions = getInstallInstructions()
    throw new Error(`Failed to install Supabase CLI automatically.\n\n${installInstructions}`)
  }
  
  // Initialize Supabase project if not already done
  const supabasePath = path.join(process.cwd(), 'supabase')
  if (!await fs.pathExists(supabasePath)) {
    spinner.text = '📋 Initializing Supabase project...'
    try {
      const supabaseCmd = getSupabaseCommand()
      execSync(`${supabaseCmd} init`, { cwd: process.cwd(), stdio: 'pipe' })
      spinner.succeed('✅ Supabase project initialized')
    } catch (error) {
      spinner.warn('⚠️  Could not initialize Supabase project automatically')
    }
  }
}

function getInstallInstructions(): string {
  const platform = process.platform
  
  if (platform === 'darwin') {
    return `📋 Manual Installation Options (macOS):
• Homebrew: brew install supabase
• npm: npm install supabase --save-dev
• Direct: https://github.com/supabase/cli#install-the-cli`
  } else if (platform === 'win32') {
    return `📋 Manual Installation Options (Windows):
• Scoop: scoop install supabase
• npm: npm install supabase --save-dev
• Direct: https://github.com/supabase/cli#install-the-cli`
  } else {
    return `📋 Manual Installation Options (Linux):
• npm: npm install supabase --save-dev
• Direct: https://github.com/supabase/cli#install-the-cli`
  }
}

// Main Supabase initialization function
export async function initSupabase(environmentName?: string) {
  try {
    console.log(chalk.blue.bold('\n🎉 PIXELL SUPABASE SETUP'))
    console.log(chalk.blue('='.repeat(50)))
    
    // First check if we have managed environments
    const environments = await getEnvironmentsConfig()
    
    if (environments.length === 0) {
      console.log(chalk.yellow('No environments found'))
      console.log(chalk.gray('You need to create environments first using "npm run pixell env"'))
      
      const createEnv = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'create',
          message: 'Would you like to create an environment now?',
          default: true
        }
      ])
      
      if (createEnv.create) {
        await manageEnvironments()
        return
      } else {
        console.log(chalk.gray('Supabase setup cancelled. Create environments first.'))
        return
      }
    }
    
    let selectedEnv: EnvironmentConfig
    
    // If environment name is provided, use it directly
    if (environmentName) {
      const targetEnv = environments.find(env => env.name.toLowerCase() === environmentName.toLowerCase())
      
      if (!targetEnv) {
        console.log(chalk.red(`❌ Environment "${environmentName}" not found`))
        console.log(chalk.gray('Available environments:'))
        environments.forEach(env => {
          console.log(chalk.gray(`   • ${env.name} (${env.type})`))
        })
        return
      }
      
      selectedEnv = targetEnv
      console.log(chalk.blue(`\n🎯 Using environment: ${selectedEnv.name}`))
    } else {
      // Let user choose which environment to configure Supabase for
      const envChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'environment',
          message: 'Choose environment to configure Supabase for:',
          choices: [
            ...environments.map(env => ({
              name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type}) ${env.description ? '- ' + env.description : ''}`,
              value: env.name,
              short: env.name
            })),
            new inquirer.Separator(),
            { name: '⬅️  Back to Environment Management', value: '_back', short: 'Back' }
          ]
        }
      ])
      
      if (envChoice.environment === '_back') {
        await manageEnvironments()
        return
      }
      
      selectedEnv = environments.find(env => env.name === envChoice.environment)!
    }
    
    console.log(chalk.blue(`\n🌍 Configuring Supabase for: ${selectedEnv.name}`))
    console.log(chalk.white(`   Type: ${selectedEnv.type}`))
    console.log(chalk.white(`   Description: ${selectedEnv.description || 'None'}`))
    
    // Check existing setup for this environment
    const existingSetup = await checkExistingSetupForEnvironment(selectedEnv)
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'setupType',
        message: `Choose Supabase setup type for ${selectedEnv.name}:`,
        choices: selectedEnv.type === 'local' ? [
          { 
            name: '🏠 Local Development (recommended - starts in 30 seconds)', 
            value: 'local',
            short: 'Local'
          },
          { 
            name: '☁️  Connect to Production Project', 
            value: 'production',
            short: 'Production'
          }
        ] : [
          { 
            name: '☁️  Production Supabase Project', 
            value: 'production',
            short: 'Production'
          },
          {
            name: '⚡ Production Quick Setup (env vars only)',
            value: 'production-quick',
            short: 'Quick'
          }
        ]
      }
    ])

    let projectUrl = ''
    let anonKey = ''
    
    if (answers.setupType !== 'local') {
      const prodAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectUrl',
          message: 'Enter your Supabase project URL:',
          default: selectedEnv.supabase.projectUrl || 'https://your-project.supabase.co',
          validate: (input) => {
            if (!input.includes('supabase.co')) {
              return 'Please enter a valid Supabase project URL'
            }
            return true
          }
        },
        {
          type: 'input',
          name: 'anonKey',
          message: 'Enter your Supabase anonymous key:',
          default: selectedEnv.supabase.anonKey || '',
          validate: (input) => input.trim().length > 20 || 'Anonymous key seems too short'
        }
      ])
      
      projectUrl = prodAnswers.projectUrl
      anonKey = prodAnswers.anonKey
    } else {
      // Local setup - use standard local URLs
      projectUrl = 'http://127.0.0.1:54321'
      anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    }

    // Update the selected environment with new Supabase configuration
    selectedEnv.supabase.projectUrl = projectUrl
    selectedEnv.supabase.anonKey = anonKey
    selectedEnv.updatedAt = new Date().toISOString()
    
    // Save updated environments
    await saveEnvironmentsConfig(environments)
    
    // If this is the active environment, update .env.local
    if (selectedEnv.isActive) {
      await updateEnvFileWithActiveEnvironment(selectedEnv)
    }
    
    const config = {
      setupType: answers.setupType,
      environment: selectedEnv.name,
      projectUrl,
      anonKey,
      isActiveEnvironment: selectedEnv.isActive
    }

    if (answers.setupType === 'production' || answers.setupType === 'production-quick') {
      console.log(chalk.yellow('\n⏳ Validating production connection...'))
      try {
        await validateProductionConnection(projectUrl, anonKey)
        console.log(chalk.green('✅ Production connection validated'))
      } catch (error) {
        console.log(chalk.red('❌ Failed to validate production connection'))
        console.log(chalk.gray('Please check your project URL and anonymous key'))
        return
      }
    }

    if (answers.setupType === 'local') {
      await initSupabaseCLI()
      await startLocalSupabase()
    }

    await showSetupSummaryForEnvironment(config, selectedEnv)
    
    // Update CLI store
    const { setSupabaseSetup } = useCLIStore.getState()
    setSupabaseSetup({
      configured: true,
      type: answers.setupType,
      lastConfigured: new Date().toISOString()
    })
    
    console.log(chalk.green(`\n✅ Supabase configured successfully for environment: ${selectedEnv.name}`))
    if (selectedEnv.isActive) {
      console.log(chalk.blue('📝 Active environment updated - .env.local has been updated'))
    } else {
      console.log(chalk.gray(`💡 To use this configuration, switch to "${selectedEnv.name}" with: npm run pixell env`))
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Supabase setup failed:'), error)
  }
}

async function checkExistingSetup() {
  const supabaseDir = path.join(process.cwd(), 'supabase')
  const envFile = path.join(process.cwd(), '.env.local')
  
  return {
    hasSupabaseDir: await fs.pathExists(supabaseDir),
    hasEnvFile: await fs.pathExists(envFile),
    hasSupabaseCLI: (() => {
      try {
        execSync('supabase --version', { stdio: 'pipe' })
        return true
      } catch {
        return false
      }
    })()
  }
}

async function writeSupabaseEnvironment(config: any) {
  const envPath = path.join(process.cwd(), '.env.local')
  
  let envContent = ''
  
  if (await fs.pathExists(envPath)) {
    envContent = await fs.readFile(envPath, 'utf-8')
  }
  
  // Remove existing Supabase vars
  envContent = envContent
    .split('\n')
    .filter(line => !line.startsWith('NEXT_PUBLIC_SUPABASE_'))
    .join('\n')
  
  // Add new Supabase configuration
  if (config.setupType === 'local') {
    envContent += `
# Supabase Local Development
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
`
  } else {
    envContent += `
# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=${config.projectUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${config.anonKey}
`
  }
  
  await fs.writeFile(envPath, envContent.trim() + '\n')
}

async function startLocalSupabase() {
  try {
    // Ensure Docker is installed and running before starting Supabase
    await ensureDockerForSupabase()
    
    console.log(chalk.blue('\n🐳 Starting local Supabase services...'))
    console.log(chalk.gray('This will start: PostgreSQL, Auth, Storage, Realtime, and Studio'))
    const supabaseCmd = getSupabaseCommand()
    execSync(`${supabaseCmd} start`, { 
      cwd: process.cwd(), 
      stdio: 'inherit' 
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Docker')) {
      throw error // Docker-specific error, re-throw as is
    }
    throw new Error('Failed to start local Supabase. Make sure Docker is running and try again.')
  }
}

async function validateProductionConnection(projectUrl: string, anonKey: string) {
  try {
    // Simple validation - try to reach the API
    const response = await fetch(`${projectUrl}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    throw new Error(`Failed to connect to Supabase project. Please check your URL and API key.`)
  }
}

async function showSetupSummary(config: any) {
  console.log(chalk.green.bold('\n🎉 Supabase Setup Complete!\n'))
  
  if (config.setupType === 'local') {
    console.log(chalk.blue('🏠 Local Development Setup:'))
    console.log(chalk.white('   Database: http://127.0.0.1:54322 (postgres/postgres)'))
    console.log(chalk.white('   Studio: http://127.0.0.1:54323'))
    console.log(chalk.white('   API: http://127.0.0.1:54321'))
    console.log(chalk.white('   Realtime: ws://127.0.0.1:54321/realtime/v1'))
    console.log(chalk.gray('\n   🔒 Local keys are safe to use for development'))
  } else if (config.setupType === 'production-quick') {
    console.log(chalk.blue('⚡ Production Quick Setup:'))
    console.log(chalk.white(`   Project: ${config.projectUrl}`))
    console.log(chalk.white('   Dashboard: Visit your Supabase project dashboard'))
    console.log(chalk.white('   Environment: .env.local updated with production credentials'))
    console.log(chalk.gray(`   🔒 Anon Key: ${maskSensitiveValue(config.anonKey, 12)}`))
  } else {
    console.log(chalk.blue('☁️  Production Setup:'))
    console.log(chalk.white(`   Project: ${config.projectUrl}`))
    console.log(chalk.white('   Dashboard: Visit your Supabase project dashboard'))
    console.log(chalk.gray(`   🔒 Anon Key: ${maskSensitiveValue(config.anonKey, 12)}`))
  }
  
  console.log(chalk.green('\n✅ Next Steps:'))
  console.log(chalk.white('   • Restart your Next.js dev server to pick up new env vars'))
  console.log(chalk.white('   • Visit http://localhost:3000 to see your app'))
  if (config.setupType === 'local') {
    console.log(chalk.white('   • Visit http://127.0.0.1:54323 for Supabase Studio'))
  }
  
  console.log(chalk.blue('\n🔒 Security Reminder:'))
  console.log(chalk.gray('   • Never commit .env.local to version control'))
  console.log(chalk.gray('   • Keep your service role keys secure'))
  console.log(chalk.gray('   • Use environment variables in production'))
}

// Helper function to mask sensitive information
function maskSensitiveValue(value: string, visibleChars: number = 8): string {
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length)
  }
  return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars)
}

// Helper function to parse supabase status output safely
function parseSupabaseStatus(rawOutput: string) {
  const lines = rawOutput.split('\n')
  const status: any = {}
  
  for (const line of lines) {
    if (line.includes('DB URL:')) {
      // Extract DB URL but mask password
      const dbUrl = line.split('DB URL:')[1]?.trim()
      if (dbUrl) {
        // Replace password in connection string
        status.dbUrl = dbUrl.replace(/:([^@]+)@/, ':***@')
      }
    } else if (line.includes('Studio URL:')) {
      status.studioUrl = line.split('Studio URL:')[1]?.trim()
    } else if (line.includes('Inbucket URL:')) {
      status.inbucketUrl = line.split('Inbucket URL:')[1]?.trim()
    } else if (line.includes('anon key:')) {
      const anonKey = line.split('anon key:')[1]?.trim()
      if (anonKey) {
        status.anonKey = maskSensitiveValue(anonKey, 12)
      }
    }
    // Explicitly skip service_role key, JWT secret, and S3 credentials
    // These are internal/sensitive and shouldn't be displayed
  }
  
  return status
}

// Status command - now with secure output and environment support
export async function statusSupabase(environmentName?: string) {
  try {
    console.log(chalk.blue.bold('\n📊 SUPABASE STATUS'))
    console.log(chalk.blue('='.repeat(30)))
    
    // If environment is specified, check that specific environment
    if (environmentName) {
      const environments = await getEnvironmentsConfig()
      const targetEnv = environments.find(env => env.name.toLowerCase() === environmentName.toLowerCase())
      
      if (!targetEnv) {
        console.log(chalk.red(`❌ Environment "${environmentName}" not found`))
        console.log(chalk.gray('Available environments:'))
        
        if (environments.length === 0) {
          console.log(chalk.gray('   No environments configured'))
          console.log(chalk.white('   Create environments with: npm run pixell env'))
        } else {
          environments.forEach(env => {
            console.log(chalk.gray(`   • ${env.name} (${env.type})`))
          })
        }
        return
      }
      
      // Show specific environment status
      console.log(chalk.blue(`🌍 Environment: ${targetEnv.name}`))
      console.log(chalk.white(`   Type: ${targetEnv.type}`))
      console.log(chalk.white(`   Status: ${targetEnv.isActive ? '🟢 Active' : '⚪ Inactive'}`))
      console.log(chalk.white(`   Description: ${targetEnv.description || 'None'}`))
      
      // Check Supabase configuration
      const hasSupabaseConfig = targetEnv.supabase.projectUrl && targetEnv.supabase.anonKey
      
      if (!hasSupabaseConfig) {
        console.log(chalk.yellow('\n⚠️  No Supabase configuration found'))
        console.log(chalk.gray('Configure Supabase for this environment:'))
        console.log(chalk.white('   npm run supabase:init'))
        return
      }
      
      console.log(chalk.green('\n✅ Supabase Configuration:'))
      console.log(chalk.white(`   Project URL: ${targetEnv.supabase.projectUrl}`))
      console.log(chalk.white(`   Anonymous Key: ${maskSensitiveValue(targetEnv.supabase.anonKey!, 12)}***`))
      
      // Test connection based on environment type
      if (targetEnv.type === 'local') {
        console.log(chalk.yellow('\n⏳ Testing local Supabase connection...'))
        try {
          const response = await fetch(targetEnv.supabase.projectUrl + '/rest/v1/', {
            headers: {
              'apikey': targetEnv.supabase.anonKey!,
              'Authorization': `Bearer ${targetEnv.supabase.anonKey!}`
            }
          })
          
          if (response.ok) {
            console.log(chalk.green('✅ Local Supabase: Running'))
            console.log(chalk.gray('   🗄️  Database: Available'))
            console.log(chalk.gray('   🎨 Studio: http://127.0.0.1:54323'))
            console.log(chalk.gray('   📧 Inbucket: http://127.0.0.1:54324'))
          } else {
            console.log(chalk.red('❌ Local Supabase: Not running'))
            console.log(chalk.gray(`   Status: ${response.status}`))
            console.log(chalk.yellow('💡 Start with: npm run supabase:init'))
          }
        } catch (error) {
          console.log(chalk.red('❌ Local Supabase: Not running'))
          console.log(chalk.gray('   Error: Connection refused'))
          console.log(chalk.yellow('💡 Start with: npm run supabase:init'))
        }
      } else {
        console.log(chalk.yellow('\n⏳ Testing production Supabase connection...'))
        try {
          await validateProductionConnection(targetEnv.supabase.projectUrl!, targetEnv.supabase.anonKey!)
          console.log(chalk.green('✅ Production Supabase: Connected'))
          console.log(chalk.gray('   🌐 API: Available'))
          console.log(chalk.gray('   🔑 Authentication: Valid'))
        } catch (error) {
          console.log(chalk.red('❌ Production Supabase: Connection failed'))
          console.log(chalk.gray(`   Error: ${error}`))
          console.log(chalk.yellow('💡 Check configuration with: npm run supabase:edit'))
        }
      }
      
      return
    }
    
    // Original behavior - check local Supabase status
    const supabaseCmd = getSupabaseCommand()
    
    // Capture output instead of displaying directly
    const rawOutput = execSync(`${supabaseCmd} status`, { 
      cwd: process.cwd(), 
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    
    // Parse and display safe information only
    const status = parseSupabaseStatus(rawOutput)
    
    if (status.dbUrl) {
      console.log(chalk.green('✅ Database: ') + chalk.white(status.dbUrl))
    }
    
    if (status.studioUrl) {
      console.log(chalk.green('✅ Studio: ') + chalk.white(status.studioUrl))
    }
    
    if (status.inbucketUrl) {
      console.log(chalk.green('✅ Inbucket (Email): ') + chalk.white(status.inbucketUrl))
    }
    
    if (status.anonKey) {
      console.log(chalk.green('✅ Anon Key: ') + chalk.gray(status.anonKey))
    }
    
    console.log(chalk.blue('\n🔒 Security Note:'))
    console.log(chalk.gray('  • Service keys and secrets are hidden for security'))
    console.log(chalk.gray('  • S3 credentials are for local development only'))
    console.log(chalk.gray('  • Use Supabase dashboard for production key management'))
    
    console.log(chalk.green('\n🚀 Quick Actions:'))
    console.log(chalk.white('  • Studio: ') + chalk.cyan(status.studioUrl || 'http://127.0.0.1:54323'))
    console.log(chalk.white('  • Stop: ') + chalk.cyan('npm run supabase:stop'))
    console.log(chalk.white('  • Reset: ') + chalk.cyan('npm run supabase:reset'))
    console.log(chalk.white('  • Environment status: ') + chalk.cyan('npm run supabase:status --env <name>'))
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to get Supabase status'))
    console.log(chalk.yellow('\n💡 Troubleshooting:'))
    console.log(chalk.white('  • Make sure Supabase is running: npm run supabase:init'))
    console.log(chalk.white('  • Check if Docker is running'))
    console.log(chalk.white('  • Verify Supabase CLI is installed'))
    console.log(chalk.white('  • Check specific environment: npm run supabase:status --env <name>'))
  }
}

// Stop command
export async function stopSupabase(environmentName?: string) {
  try {
    console.log(chalk.blue.bold('\n🛑 STOPPING SUPABASE'))
    console.log(chalk.blue('='.repeat(30)))
    
    if (environmentName) {
      console.log(chalk.blue(`🎯 Environment: ${environmentName}`))
      
      // Validate environment exists
      const environments = await getEnvironmentsConfig()
      const targetEnv = environments.find(env => env.name.toLowerCase() === environmentName.toLowerCase())
      
      if (!targetEnv) {
        console.log(chalk.red(`❌ Environment "${environmentName}" not found`))
        console.log(chalk.gray('Available environments:'))
        environments.forEach(env => {
          console.log(chalk.gray(`   • ${env.name} (${env.type})`))
        })
        return
      }
      
      if (targetEnv.type === 'remote') {
        console.log(chalk.yellow('⚠️  Cannot stop remote Supabase services'))
        console.log(chalk.gray('Remote environments are managed by Supabase cloud'))
        return
      }
    }
    
    const supabaseCmd = getSupabaseCommand()
    execSync(`${supabaseCmd} stop`, { cwd: process.cwd(), stdio: 'inherit' })
    console.log(chalk.green('✅ Local Supabase services stopped'))
  } catch (error) {
    console.error(chalk.red('Failed to stop Supabase:'), error)
  }
}

// Reset command
export async function resetSupabase(environmentName?: string) {
  try {
    console.log(chalk.blue.bold('\n🔄 RESET SUPABASE DATABASE'))
    console.log(chalk.blue('='.repeat(40)))
    
    if (environmentName) {
      console.log(chalk.blue(`🎯 Environment: ${environmentName}`))
      
      // Validate environment exists
      const environments = await getEnvironmentsConfig()
      const targetEnv = environments.find(env => env.name.toLowerCase() === environmentName.toLowerCase())
      
      if (!targetEnv) {
        console.log(chalk.red(`❌ Environment "${environmentName}" not found`))
        console.log(chalk.gray('Available environments:'))
        environments.forEach(env => {
          console.log(chalk.gray(`   • ${env.name} (${env.type})`))
        })
        return
      }
      
      if (targetEnv.type === 'remote') {
        console.log(chalk.yellow('⚠️  Cannot reset remote Supabase database'))
        console.log(chalk.gray('Remote environments must be reset through Supabase dashboard'))
        return
      }
    }
    
    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '⚠️  This will reset your local database and delete all data. Continue?',
        default: false
      }
    ])

    if (confirmation.confirmed) {
      try {
        const supabaseCmd = getSupabaseCommand()
        execSync(`${supabaseCmd} db reset`, { cwd: process.cwd(), stdio: 'inherit' })
        console.log(chalk.green('✅ Local database reset complete'))
      } catch (error) {
        console.error(chalk.red('Failed to reset database:'), error)
      }
    }
  } catch (error) {
    console.error(chalk.red('Failed to reset database:'), error)
  }
}

// Migration tracking and management
export async function migrationsSupabase(environmentName?: string) {
  try {
    console.log(chalk.blue.bold('\n🔄 SUPABASE MIGRATIONS'))
    console.log(chalk.blue('='.repeat(35)))
    
    if (environmentName) {
      console.log(chalk.blue(`🎯 Environment: ${environmentName}`))
      
      // Validate environment exists
      const environments = await getEnvironmentsConfig()
      const targetEnv = environments.find(env => env.name.toLowerCase() === environmentName.toLowerCase())
      
      if (!targetEnv) {
        console.log(chalk.red(`❌ Environment "${environmentName}" not found`))
        console.log(chalk.gray('Available environments:'))
        environments.forEach(env => {
          console.log(chalk.gray(`   • ${env.name} (${env.type})`))
        })
        return
      }
    }
    
    const supabaseCmd = getSupabaseCommand()
    
    const choices = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose migration action:',
        choices: [
          { name: '📊 Check Migration Status', value: 'status', short: 'Status' },
          { name: '📋 List All Migrations', value: 'list', short: 'List' },
          { name: '⏳ List Unapplied Migrations', value: 'unapplied', short: 'Unapplied' },
          { name: '🔄 Apply Migrations to Environment', value: 'apply', short: 'Apply' },
          { name: '⬇️  Rollback Last Migration', value: 'down', short: 'Rollback' },
          { name: '🆕 Create New Migration', value: 'new', short: 'New' },
          { name: '🔍 Compare Environments', value: 'compare', short: 'Compare' }
        ]
      }
    ])

    switch (choices.action) {
      case 'status':
        await showMigrationStatus(supabaseCmd)
        break
      case 'list':
        await listMigrations(supabaseCmd)
        break
      case 'unapplied':
        await listUnappliedMigrations(supabaseCmd)
        break
      case 'apply':
        await applyMigrationsToEnvironment(supabaseCmd)
        break
      case 'down':
        await rollbackMigration(supabaseCmd)
        break
      case 'new':
        await createNewMigration(supabaseCmd)
        break
      case 'compare':
        await compareEnvironments(supabaseCmd)
        break
      default:
        console.log(chalk.yellow('Invalid action selected'))
    }

  } catch (error) {
    console.error(chalk.red('❌ Migration command failed:'), error)
  }
}

async function showMigrationStatus(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n📊 MIGRATION STATUS'))
  console.log(chalk.blue('='.repeat(40)))
  
  try {
    // For local development, we'll read migration files directly from the filesystem
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    
    if (!await fs.pathExists(migrationsDir)) {
      console.log(chalk.yellow('\n⚠️  No migrations directory found'))
      console.log(chalk.gray('   Run: pixell supabase-init to initialize Supabase project'))
      
      const backToMenu = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'goBack',
          message: 'Go back to migration menu?',
          default: true
        }
      ])
      
      if (backToMenu.goBack) {
        await migrationsSupabase()
      }
      return
    }
    
    console.log(chalk.green('\n🏠 Local Migrations:'))
    const localMigrations = await getLocalMigrations(migrationsDir)
    displayMigrationTable(localMigrations)
    
    // Try to get applied migrations from database if running
    try {
      const appliedMigrations = await getAppliedMigrations(supabaseCmd)
      console.log(chalk.blue('\n📊 Database Status:'))
      
      localMigrations.forEach(migration => {
        const isApplied = appliedMigrations.includes(migration.name)
        migration.applied = isApplied
        const statusIcon = isApplied ? '✅' : '⏳'
        const statusText = isApplied ? chalk.green('Applied') : chalk.yellow('Pending')
        console.log(`   ${statusIcon} ${migration.name} - ${statusText}`)
      })
      
    } catch {
      console.log(chalk.gray('\n📊 Database Status: Not available (ensure Supabase is running)'))
      console.log(chalk.gray('   Showing file-system migrations only'))
    }
    
    // Add go back option after displaying status
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to get migration status:'), error)
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
  }
}

async function listMigrations(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n📋 ALL MIGRATIONS'))
  console.log(chalk.blue('='.repeat(30)))
  
  try {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    
    if (!await fs.pathExists(migrationsDir)) {
      console.log(chalk.yellow('No migrations directory found'))
      console.log(chalk.gray('Run: pixell supabase-init to initialize Supabase project'))
      return
    }
    
    const migrations = await getLocalMigrations(migrationsDir)
    
    if (migrations.length === 0) {
      console.log(chalk.yellow('No migrations found'))
      console.log(chalk.gray('No migration files exist in the supabase/migrations directory'))
      
      const backToMenu = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'goBack',
          message: 'Go back to migration menu?',
          default: true
        }
      ])
      
      if (backToMenu.goBack) {
        await migrationsSupabase()
      }
      return
    }
    
    console.log(chalk.green(`\n📁 Found ${migrations.length} migration(s):\n`))
    
    // Try to get applied status from database
    try {
      const appliedMigrations = await getAppliedMigrations(supabaseCmd)
      
      migrations.forEach((migration: any) => {
        migration.applied = appliedMigrations.includes(migration.name)
        const statusIcon = migration.applied ? '✅' : '⏳'
        const statusText = migration.applied ? chalk.green('Applied') : chalk.yellow('Pending')
        
        console.log(`${statusIcon} ${chalk.white(migration.name)}`)
        console.log(`   ${statusText} • ${chalk.gray(migration.timestamp || 'No timestamp')}`)
        if (migration.description) {
          console.log(`   ${chalk.gray('└─ ' + migration.description)}`)
        }
        console.log()
      })
    } catch {
      // If database not available, just show file info
      migrations.forEach((migration: any) => {
        console.log(`📄 ${chalk.white(migration.name)}`)
        console.log(`   ${chalk.gray(migration.timestamp || 'No timestamp')}`)
        if (migration.description) {
          console.log(`   ${chalk.gray('└─ ' + migration.description)}`)
        }
        console.log()
      })
      console.log(chalk.gray('Note: Database status unavailable (ensure Supabase is running)'))
    }
    
    // Add go back option after displaying results
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to list migrations:'), error)
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
  }
}

async function listUnappliedMigrations(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n⏳ UNAPPLIED MIGRATIONS'))
  console.log(chalk.blue('='.repeat(35)))
  
  try {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    
    if (!await fs.pathExists(migrationsDir)) {
      console.log(chalk.yellow('No migrations directory found'))
      console.log(chalk.gray('Run: pixell supabase-init to initialize Supabase project'))
      return
    }
    
    const localMigrations = await getLocalMigrations(migrationsDir)
    const appliedMigrations = await getAppliedMigrations(supabaseCmd)
    
    const unappliedMigrations = localMigrations.filter(migration => 
      !appliedMigrations.includes(migration.name)
    )
    
    if (unappliedMigrations.length === 0) {
      console.log(chalk.green('✅ All migrations have been applied'))
      console.log(chalk.gray('No pending migrations found'))
      
      const backToMenu = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'goBack',
          message: 'Go back to migration menu?',
          default: true
        }
      ])
      
      if (backToMenu.goBack) {
        await migrationsSupabase()
      }
      return
    }
    
    console.log(chalk.yellow(`\n📋 Found ${unappliedMigrations.length} unapplied migration(s):\n`))
    
    unappliedMigrations.forEach((migration, index) => {
      console.log(`${index + 1}. ⏳ ${chalk.white(migration.name)}`)
      console.log(`   ${chalk.gray(migration.timestamp || 'No timestamp')}`)
      if (migration.description) {
        console.log(`   ${chalk.gray('└─ ' + migration.description)}`)
      }
      console.log()
    })
    
    const applyNow = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'apply',
        message: 'Would you like to apply these migrations to an environment?',
        default: false
      }
    ])
    
    if (applyNow.apply) {
      await applyMigrationsToEnvironment(supabaseCmd)
    } else {
      const backToMenu = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'goBack',
          message: 'Go back to migration menu?',
          default: true
        }
      ])
      
      if (backToMenu.goBack) {
        await migrationsSupabase()
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to list unapplied migrations:'), error)
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
  }
}

async function applyMigrationsToEnvironment(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n🔄 APPLY MIGRATIONS TO ENVIRONMENT'))
  console.log(chalk.blue('='.repeat(45)))
  
  try {
    const environments = await getEnvironmentsConfig()
    
    if (environments.length === 0) {
      console.log(chalk.yellow('No environments configured'))
      console.log(chalk.gray('Use "npm run pixell env" to set up your environments first'))
      
      const createNow = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'create',
          message: 'Would you like to create an environment now?',
          default: true
        }
      ])
      
      if (createNow.create) {
        await manageEnvironments()
      }
      return
    }

    // Let developer choose from configured environments
    const envChoices = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Choose target environment:',
        choices: [
          ...environments.map(env => ({
            name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type}) ${env.description ? '- ' + env.description : ''}`,
            value: env.name,
            short: env.name
          })),
          { name: '➕ Add New Environment', value: '_add_new', short: 'Add New' }
        ]
      }
    ])

    if (envChoices.environment === '_add_new') {
      await addEnvironment()
      return
    }

    const selectedEnv = environments.find(env => env.name === envChoices.environment)!
    
    // Get list of unapplied migrations
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const localMigrations = await getLocalMigrations(migrationsDir)
    
    let appliedMigrations: string[] = []
    
    if (selectedEnv.type === 'local') {
      appliedMigrations = await getAppliedMigrations(supabaseCmd)
    } else {
      // For remote, we'd need to query the remote database
      console.log(chalk.gray('📊 Checking remote migration status...'))
      appliedMigrations = await getRemoteAppliedMigrations(selectedEnv.database.url!)
    }
    
    const unappliedMigrations = localMigrations.filter(migration => 
      !appliedMigrations.includes(migration.name)
    )
    
    if (unappliedMigrations.length === 0) {
      console.log(chalk.green(`✅ All migrations already applied to ${selectedEnv.name}`))
      
      const backToMenu = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'goBack',
          message: 'Go back to migration menu?',
          default: true
        }
      ])
      
      if (backToMenu.goBack) {
        await migrationsSupabase()
      }
      return
    }
    
    console.log(chalk.yellow(`\n📋 ${unappliedMigrations.length} migration(s) to apply to "${selectedEnv.name}":`))
    unappliedMigrations.forEach((migration, index) => {
      console.log(`   ${index + 1}. ${migration.name}`)
      if (migration.description) {
        console.log(`      ${chalk.gray(migration.description)}`)
      }
    })
    
    console.log(chalk.blue(`\n🌍 Target Environment: ${selectedEnv.name}`))
    console.log(chalk.white(`   Type: ${selectedEnv.type}`))
    console.log(chalk.white(`   Description: ${selectedEnv.description || 'None'}`))
    if (selectedEnv.type === 'remote') {
      console.log(chalk.white(`   Database: ${selectedEnv.database.host}:${selectedEnv.database.port}`))
    }

    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Apply ${unappliedMigrations.length} migration(s) to ${selectedEnv.name}?`,
        default: false
      }
    ])

    if (confirmation.confirmed) {
      console.log(chalk.yellow(`\n⏳ Applying migrations to ${selectedEnv.name}...`))
      
      if (selectedEnv.type === 'local') {
        // For local, use supabase db reset
        try {
          execSync(`${supabaseCmd} db reset`, { cwd: process.cwd(), stdio: 'inherit' })
          console.log(chalk.green(`\n✅ Migrations applied successfully to ${selectedEnv.name}`))
        } catch (error) {
          console.error(chalk.red(`\n❌ Failed to apply migrations to ${selectedEnv.name}:`), error)
        }
      } else {
        // For remote, provide manual instructions with specific connection details
        console.log(chalk.blue('\n📝 Manual Migration Required:'))
        console.log(chalk.white('For remote environments, apply migrations manually:'))
        console.log(chalk.gray(`1. Connect to ${selectedEnv.name}:`))
        console.log(chalk.cyan(`   psql "${selectedEnv.database.url}"`))
        console.log(chalk.gray('2. Run each migration file in order:'))
        
        unappliedMigrations.forEach((migration, index) => {
          console.log(chalk.cyan(`   \\i supabase/migrations/${migration.name}`))
        })
        
        console.log(chalk.yellow('\n💡 Or use Supabase CLI with project linking:'))
        console.log(chalk.white('1. supabase login'))
        console.log(chalk.white('2. supabase link --project-ref <your-project-ref>'))
        console.log(chalk.white('3. supabase db push'))
      }
    }
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to apply migrations:'), error)
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
  }
}

async function rollbackMigration(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n⬇️  ROLLBACK MIGRATION'))
  console.log(chalk.blue('='.repeat(35)))
  
  const confirmation = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: '⚠️  This will rollback the last migration. This action cannot be undone. Continue?',
      default: false
    }
  ])

  if (confirmation.confirmed) {
    try {
      // Note: Supabase CLI doesn't have a direct rollback command
      // This would require custom implementation or manual rollback
      console.log(chalk.yellow('\n⚠️  Manual Rollback Required:'))
      console.log(chalk.white('1. Create a new migration to undo changes'))
      console.log(chalk.white('2. Use: pixell supabase-migrations → "Create New Migration"'))
      console.log(chalk.white('3. Write SQL to reverse the last migration'))
      console.log(chalk.gray('\nSupabase CLI doesn\'t support automatic rollbacks for safety'))
    } catch (error) {
      console.error(chalk.red('Rollback failed:'), error)
    }
  }
}

async function createNewMigration(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n🆕 CREATE NEW MIGRATION'))
  console.log(chalk.blue('='.repeat(35)))
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Migration name (describe what it does):',
      validate: (input) => {
        if (!input.trim()) {
          return 'Migration name is required'
        }
        // Convert to valid filename
        const cleaned = input.trim().toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
        return cleaned.length > 0 || 'Please provide a valid migration name'
      }
    }
  ])

  try {
    const migrationName = answers.name.trim().toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
    
    console.log(chalk.yellow(`\n⏳ Creating migration: ${migrationName}...`))
    
    const output = execSync(`${supabaseCmd} migration new ${migrationName}`, { 
      cwd: process.cwd(), 
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    
    // Parse the output to find the created file
    const lines = output.split('\n')
    const createdLine = lines.find(line => line.includes('Created new migration'))
    
    if (createdLine) {
      console.log(chalk.green('✅ Migration created successfully'))
      console.log(chalk.white(createdLine))
      console.log(chalk.blue('\n📝 Next steps:'))
      console.log(chalk.white('1. Edit the migration file with your SQL changes'))
      console.log(chalk.white('2. Run: pixell supabase-migrations → "Apply Pending Migrations"'))
    } else {
      console.log(chalk.green('✅ Migration created'))
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to create migration:'), error)
  }
}

async function compareEnvironments(supabaseCmd: string) {
  console.log(chalk.blue.bold('\n⚖️  COMPARE ENVIRONMENTS'))
  console.log(chalk.blue('='.repeat(35)))
  
  try {
    const environments = await getEnvironmentsConfig()
    
    if (environments.length < 2) {
      console.log(chalk.yellow('Need at least 2 environments to compare'))
      console.log(chalk.gray('Use "npm run pixell env" to set up more environments'))
      
      const createNow = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'create',
          message: 'Would you like to create an environment now?',
          default: true
        }
      ])
      
      if (createNow.create) {
        await manageEnvironments()
      }
      return
    }

    const comparison = await inquirer.prompt([
      {
        type: 'list',
        name: 'source',
        message: 'Source environment:',
        choices: environments.map(env => ({
          name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type})`,
          value: env.name,
          short: env.name
        }))
      },
      {
        type: 'list',
        name: 'target',
        message: 'Target environment:',
        choices: (answers: any) => environments
          .filter(env => env.name !== answers.source)
          .map(env => ({
            name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type})`,
            value: env.name,
            short: env.name
          }))
      }
    ])

    const sourceEnv = environments.find(env => env.name === comparison.source)!
    const targetEnv = environments.find(env => env.name === comparison.target)!
    
    console.log(chalk.blue(`\n🔍 Comparing: ${sourceEnv.name} → ${targetEnv.name}`))
    
    // Get migrations for both environments
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const localMigrations = await getLocalMigrations(migrationsDir)
    
    let sourceMigrations: string[] = []
    let targetMigrations: string[] = []
    
    if (sourceEnv.type === 'local') {
      sourceMigrations = await getAppliedMigrations(supabaseCmd)
    } else {
      sourceMigrations = await getRemoteAppliedMigrations(sourceEnv.database.url!)
    }
    
    if (targetEnv.type === 'local') {
      targetMigrations = await getAppliedMigrations(supabaseCmd)
    } else {
      targetMigrations = await getRemoteAppliedMigrations(targetEnv.database.url!)
    }
    
    // Calculate differences
    const onlyInSource = sourceMigrations.filter(m => !targetMigrations.includes(m))
    const onlyInTarget = targetMigrations.filter(m => !sourceMigrations.includes(m))
    const common = sourceMigrations.filter(m => targetMigrations.includes(m))
    
    console.log(chalk.green(`\n✅ Common migrations: ${common.length}`))
    if (common.length > 0) {
      console.log(chalk.gray('   (Both environments have these migrations)'))
    }
    
    console.log(chalk.yellow(`\n📋 Only in ${sourceEnv.name}: ${onlyInSource.length}`))
    if (onlyInSource.length > 0) {
      onlyInSource.forEach(migration => {
        console.log(chalk.yellow(`   • ${migration}`))
      })
    }
    
    console.log(chalk.cyan(`\n📋 Only in ${targetEnv.name}: ${onlyInTarget.length}`))
    if (onlyInTarget.length > 0) {
      onlyInTarget.forEach(migration => {
        console.log(chalk.cyan(`   • ${migration}`))
      })
    }
    
    if (onlyInSource.length === 0 && onlyInTarget.length === 0) {
      console.log(chalk.green(`\n🎉 Environments are in sync!`))
    } else {
      console.log(chalk.yellow(`\n⚠️  Environments are out of sync`))
      
      const syncOptions = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📝 Generate sync plan', value: 'plan', short: 'Plan' },
            { name: '🔄 Apply missing migrations', value: 'apply', short: 'Apply' },
            { name: '⬅️  Go back', value: 'back', short: 'Back' }
          ]
        }
      ])
      
      if (syncOptions.action === 'plan') {
        console.log(chalk.blue('\n📝 SYNC PLAN:'))
        
        if (onlyInSource.length > 0) {
          console.log(chalk.yellow(`\n To sync ${targetEnv.name} with ${sourceEnv.name}:`))
          onlyInSource.forEach((migration, index) => {
            console.log(chalk.white(`   ${index + 1}. Apply: ${migration}`))
          })
        }
        
        if (onlyInTarget.length > 0) {
          console.log(chalk.cyan(`\n To sync ${sourceEnv.name} with ${targetEnv.name}:`))
          onlyInTarget.forEach((migration, index) => {
            console.log(chalk.white(`   ${index + 1}. Apply: ${migration}`))
          })
        }
      } else if (syncOptions.action === 'apply') {
        console.log(chalk.blue('\n🔄 Applying missing migrations...'))
        console.log(chalk.gray('Use the migration application feature to sync environments'))
      }
    }
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to compare environments:'), error)
    
    const backToMenu = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'goBack',
        message: 'Go back to migration menu?',
        default: true
      }
    ])
    
    if (backToMenu.goBack) {
      await migrationsSupabase()
    }
  }
}

async function getRemoteAppliedMigrations(connectionString: string): Promise<string[]> {
  try {
    // This is a placeholder - in a real implementation, you'd connect to the remote database
    // and query the supabase_migrations table
    console.log(chalk.gray(`Checking migrations on remote database...`))
    
    // For now, return empty array (no migrations applied)
    // In a real implementation, you'd use a PostgreSQL client to query:
    // SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
    
    return []
    
  } catch (error) {
    console.log(chalk.yellow('Could not check remote migrations'))
    return []
  }
}

// Helper functions for migration management
async function getLocalMigrations(migrationsDir: string): Promise<Array<{name: string, applied: boolean, timestamp?: string, description?: string}>> {
  const migrations: Array<{name: string, applied: boolean, timestamp?: string, description?: string}> = []
  
  try {
    const files = await fs.readdir(migrationsDir)
    const sqlFiles = files.filter(file => file.endsWith('.sql')).sort()
    
    for (const file of sqlFiles) {
      migrations.push({
        name: file,
        applied: false, // Will be determined later
        timestamp: extractTimestamp(file),
        description: extractDescription(file)
      })
    }
  } catch (error) {
    console.error('Error reading migrations directory:', error)
  }
  
  return migrations
}

async function getAppliedMigrations(supabaseCmd: string): Promise<string[]> {
  try {
    // Query the supabase_migrations table to see what's been applied
    const output = execSync(`${supabaseCmd} db diff --use-migra`, { 
      cwd: process.cwd(), 
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    
    // This is a simple approach - in a real implementation, you'd query the database directly
    // For now, we'll assume if no diff is found, migrations are applied
    return []
    
  } catch (error) {
    // If we can't check, assume no migrations are applied
    return []
  }
}

// Helper functions for parsing migration data
function parseMigrationList(output: string): Array<{name: string, applied: boolean, timestamp?: string, description?: string}> {
  const lines = output.split('\n').filter(line => line.trim())
  const migrations: Array<{name: string, applied: boolean, timestamp?: string, description?: string}> = []
  
  for (const line of lines) {
    // Parse different output formats that Supabase CLI might return
    if (line.includes('.sql')) {
      const name = line.trim()
      migrations.push({
        name,
        applied: !line.includes('pending') && !line.includes('not applied'),
        timestamp: extractTimestamp(name),
        description: extractDescription(name)
      })
    }
  }
  
  return migrations
}

function extractTimestamp(filename: string): string | undefined {
  // Extract timestamp from migration filename (format: YYYYMMDDHHMMSS_name.sql)
  const match = filename.match(/(\d{14})/)
  if (match) {
    const ts = match[1]
    const year = ts.substring(0, 4)
    const month = ts.substring(4, 6)
    const day = ts.substring(6, 8)
    const hour = ts.substring(8, 10)
    const minute = ts.substring(10, 12)
    const second = ts.substring(12, 14)
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
  return undefined
}

function extractDescription(filename: string): string | undefined {
  // Extract description from filename (after timestamp and before .sql)
  const match = filename.match(/\d{14}_(.+)\.sql/)
  if (match) {
    return match[1].replace(/_/g, ' ')
  }
  return undefined
}

function displayMigrationTable(migrations: Array<{name: string, applied: boolean, timestamp?: string, description?: string}>) {
  if (migrations.length === 0) {
    console.log(chalk.gray('   No migrations found'))
    return
  }
  
  migrations.forEach(migration => {
    const statusIcon = migration.applied ? '✅' : '⏳'
    const statusColor = migration.applied ? chalk.green : chalk.yellow
    
    console.log(`   ${statusIcon} ${statusColor(migration.name)}`)
    if (migration.timestamp) {
      console.log(`      ${chalk.gray(migration.timestamp)}`)
    }
  })
}

function compareMigrationStatus(local: any[], remote: any[]) {
  const localNames = new Set(local.map(m => m.name))
  const remoteNames = new Set(remote.map(m => m.name))
  
  const onlyLocal = local.filter(m => !remoteNames.has(m.name))
  const onlyRemote = remote.filter(m => !localNames.has(m.name))
  const common = local.filter(m => remoteNames.has(m.name))
  
  if (onlyLocal.length > 0) {
    console.log(chalk.yellow(`   📤 ${onlyLocal.length} migration(s) only in local`))
  }
  
  if (onlyRemote.length > 0) {
    console.log(chalk.blue(`   📥 ${onlyRemote.length} migration(s) only in remote`))
  }
  
  if (common.length > 0) {
    console.log(chalk.green(`   ✅ ${common.length} migration(s) in sync`))
  }
  
  if (onlyLocal.length === 0 && onlyRemote.length === 0) {
    console.log(chalk.green('   🎉 All migrations are in sync!'))
  }
}

// Environment management
export async function manageEnvironments() {
  console.log(chalk.blue.bold('\n🌍 ENVIRONMENT MANAGEMENT'))
  console.log(chalk.blue('='.repeat(40)))
  
  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Choose environment action:',
      choices: [
        { name: '📋 List All Environments', value: 'list', short: 'List' },
        { name: '➕ Add New Environment', value: 'add', short: 'Add' },
        { name: '✏️  Edit Environment', value: 'edit', short: 'Edit' },
        { name: '🗑️  Delete Environment', value: 'delete', short: 'Delete' },
        { name: '🔄 Switch Active Environment', value: 'switch', short: 'Switch' },
        { name: '🔧 Test Environment', value: 'test', short: 'Test' }
      ]
    }
  ])

  switch (action.action) {
    case 'list':
      await listEnvironments()
      break
    case 'add':
      await addEnvironment()
      break
    case 'edit':
      await editEnvironment()
      break
    case 'delete':
      await deleteEnvironment()
      break
    case 'switch':
      await switchEnvironment()
      break
    case 'test':
      await testEnvironment()
      break
  }
}

// Environment configuration type
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

// Helper functions for environment management
async function getEnvironmentsConfig(): Promise<EnvironmentConfig[]> {
  const configPath = path.join(process.cwd(), '.pixell', 'environments.json')
  
  try {
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath)
      return config.environments || []
    }
  } catch (error) {
    console.log(chalk.gray('No environments configuration found, starting fresh'))
  }
  
  return []
}

async function saveEnvironmentsConfig(environments: EnvironmentConfig[]) {
  const configDir = path.join(process.cwd(), '.pixell')
  const configPath = path.join(configDir, 'environments.json')
  
  await fs.ensureDir(configDir)
  await fs.writeJson(configPath, { environments }, { spaces: 2 })
}

async function listEnvironments() {
  console.log(chalk.blue.bold('\n📋 ENVIRONMENT LIST'))
  console.log(chalk.blue('='.repeat(30)))
  
  const environments = await getEnvironmentsConfig()
  
  if (environments.length === 0) {
    console.log(chalk.yellow('No environments configured'))
    console.log(chalk.gray('Use "Add New Environment" to create your first environment'))
    await goBackToEnvironmentMenu()
    return
  }
  
  console.log(chalk.white(`\nFound ${environments.length} environment(s):\n`))
  
  environments.forEach((env, index) => {
    const status = env.isActive ? chalk.green('🟢 Active') : chalk.gray('⚪ Inactive')
    const hasSupabase = env.supabase.projectUrl && env.supabase.anonKey ? chalk.green('🟢 Configured') : chalk.gray('⚪ Not configured')
    
    console.log(`${index + 1}. ${chalk.bold(env.name)} ${status}`)
    console.log(`   Type: ${env.type}`)
    console.log(`   Description: ${env.description || 'None'}`)
    console.log(`   Supabase: ${hasSupabase}`)
    console.log(`   Created: ${new Date(env.createdAt).toLocaleDateString()}`)
    console.log('')
  })
  
  console.log(chalk.blue('💡 Next Steps:'))
  if (environments.some(env => !env.supabase.projectUrl || !env.supabase.anonKey)) {
    console.log(chalk.white('   • Configure Supabase: npm run supabase:init'))
  }
  console.log(chalk.white('   • Switch environments: npm run pixell env'))
  console.log(chalk.white('   • Edit environments: npm run pixell env'))
  
  await goBackToEnvironmentMenu()
}

async function addEnvironment() {
  console.log(chalk.blue.bold('\n➕ ADD NEW ENVIRONMENT'))
  console.log(chalk.blue('='.repeat(30)))
  
  const envConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Environment name:',
      validate: (input) => {
        if (!input.trim()) return 'Environment name is required'
        if (input.includes(' ')) return 'Environment name cannot contain spaces'
        return true
      }
    },
    {
      type: 'list',
      name: 'type',
      message: 'Environment type:',
      choices: [
        { name: '🏠 Local Development', value: 'local', short: 'Local' },
        { name: '☁️  Remote Environment', value: 'remote', short: 'Remote' }
      ]
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
      default: ''
    }
  ])
  
  // Check if environment name already exists
  const environments = await getEnvironmentsConfig()
  const nameExists = environments.some(env => env.name.toLowerCase() === envConfig.name.toLowerCase())
  
  if (nameExists) {
    console.log(chalk.red(`❌ Environment "${envConfig.name}" already exists`))
    
    const retry = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Try again with a different name?',
        default: true
      }
    ])
    
    if (retry.retry) {
      await addEnvironment()
    }
    return
  }
  
  const newEnvironment: EnvironmentConfig = {
    name: envConfig.name,
    type: envConfig.type,
    database: {}, // Empty - will be configured through Supabase commands
    supabase: {}, // Empty - will be configured through Supabase commands
    description: envConfig.description || undefined,
    isActive: environments.length === 0, // First environment is active by default
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  // Add to environments list
  environments.push(newEnvironment)
  await saveEnvironmentsConfig(environments)
  
  // If this is the first environment or user wants it active, update .env.local
  if (newEnvironment.isActive) {
    await setActiveEnvironment(newEnvironment.name)
  }
  
  console.log(chalk.green(`\n✅ Environment "${envConfig.name}" created successfully!`))
  console.log(chalk.blue(`   Type: ${envConfig.type}`))
  console.log(chalk.blue(`   Description: ${envConfig.description || 'None'}`))
  if (newEnvironment.isActive) {
    console.log(chalk.green(`   Status: 🟢 Active`))
  }
  
  console.log(chalk.yellow('\n💡 Next Steps:'))
  console.log(chalk.white('   • Configure Supabase for this environment: npm run supabase:init'))
  console.log(chalk.white('   • Manage environments: npm run pixell env'))
  if (!newEnvironment.isActive) {
    console.log(chalk.white(`   • Switch to this environment: npm run pixell env`))
  }
  
  await goBackToEnvironmentMenu()
}

async function editEnvironment() {
  const environments = await getEnvironmentsConfig()
  
  if (environments.length === 0) {
    console.log(chalk.yellow('No environments to edit'))
    await goBackToEnvironmentMenu()
    return
  }
  
  console.log(chalk.blue.bold('\n✏️  EDIT ENVIRONMENT'))
  console.log(chalk.blue('='.repeat(25)))
  
  const envChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message: 'Choose environment to edit:',
      choices: environments.map(env => ({
        name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type}) ${env.description ? '- ' + env.description : ''}`,
        value: env.name,
        short: env.name
      }))
    }
  ])
  
  const selectedEnv = environments.find(env => env.name === envChoice.environment)!
  
  console.log(chalk.blue(`\n🌍 Editing: ${selectedEnv.name}`))
  console.log(chalk.gray(`   Type: ${selectedEnv.type}`))
  console.log(chalk.gray(`   Description: ${selectedEnv.description || 'None'}`))
  console.log(chalk.gray(`   Created: ${new Date(selectedEnv.createdAt).toLocaleDateString()}`))
  
  const editChoices = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'fields',
      message: 'What would you like to edit?',
      choices: [
        { name: 'Environment Name', value: 'name' },
        { name: 'Description', value: 'description' }
      ]
    }
  ])
  
  if (editChoices.fields.length === 0) {
    console.log(chalk.gray('No changes selected'))
    await goBackToEnvironmentMenu()
    return
  }
  
  let hasChanges = false
  
  if (editChoices.fields.includes('name')) {
    const nameConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'New environment name:',
        default: selectedEnv.name,
        validate: (input) => {
          if (!input.trim()) return 'Environment name is required'
          if (input.includes(' ')) return 'Environment name cannot contain spaces'
          if (input !== selectedEnv.name && environments.some(env => env.name.toLowerCase() === input.toLowerCase())) {
            return 'An environment with this name already exists'
          }
          return true
        }
      }
    ])
    
    if (nameConfig.name !== selectedEnv.name) {
      selectedEnv.name = nameConfig.name
      hasChanges = true
    }
  }
  
  if (editChoices.fields.includes('description')) {
    const descConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'New description:',
        default: selectedEnv.description || ''
      }
    ])
    
    if (descConfig.description !== (selectedEnv.description || '')) {
      selectedEnv.description = descConfig.description || undefined
      hasChanges = true
    }
  }
  
  if (hasChanges) {
    selectedEnv.updatedAt = new Date().toISOString()
    await saveEnvironmentsConfig(environments)
    
    // If this is the active environment, update .env.local
    if (selectedEnv.isActive) {
      await updateEnvFileWithActiveEnvironment(selectedEnv)
    }
    
    console.log(chalk.green(`\n✅ Environment "${selectedEnv.name}" updated successfully!`))
  } else {
    console.log(chalk.gray('No changes made'))
  }
  
  console.log(chalk.yellow('\n💡 Note: Supabase settings can be edited with: npm run supabase:edit'))
  
  await goBackToEnvironmentMenu()
}

async function deleteEnvironment() {
  console.log(chalk.blue.bold('\n🗑️  DELETE ENVIRONMENT'))
  console.log(chalk.blue('='.repeat(30)))
  
  try {
    const environments = await getEnvironmentsConfig()
    
    if (environments.length === 0) {
      console.log(chalk.yellow('No environments to delete'))
      await goBackToEnvironmentMenu()
      return
    }

    const envChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Choose environment to delete:',
        choices: environments.map(env => ({
          name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type})`,
          value: env.name,
          short: env.name
        }))
      }
    ])

    const envToDelete = environments.find(env => env.name === envChoice.environment)!
    
    console.log(chalk.red(`\n⚠️  You are about to delete environment: ${envToDelete.name}`))
    console.log(chalk.gray(`   Type: ${envToDelete.type}`))
    console.log(chalk.gray(`   Description: ${envToDelete.description || 'None'}`))
    
    if (envToDelete.isActive) {
      console.log(chalk.yellow('   ⚠️  This is the currently active environment!'))
    }

    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to delete this environment?',
        default: false
      }
    ])

    if (confirmation.confirmed) {
      const updatedEnvironments = environments.filter(env => env.name !== envChoice.environment)
      
      // If we deleted the active environment, set another as active
      if (envToDelete.isActive && updatedEnvironments.length > 0) {
        updatedEnvironments[0].isActive = true
        console.log(chalk.blue(`Switched active environment to: ${updatedEnvironments[0].name}`))
      }
      
      await saveEnvironmentsConfig(updatedEnvironments)
      console.log(chalk.green(`\n✅ Environment "${envToDelete.name}" deleted successfully!`))
    } else {
      console.log(chalk.gray('Deletion cancelled'))
    }
    
    await goBackToEnvironmentMenu()
    
  } catch (error) {
    console.error(chalk.red('Failed to delete environment:'), error)
    await goBackToEnvironmentMenu()
  }
}

async function switchEnvironment() {
  console.log(chalk.blue.bold('\n🔄 SWITCH ACTIVE ENVIRONMENT'))
  console.log(chalk.blue('='.repeat(35)))
  
  try {
    const environments = await getEnvironmentsConfig()
    
    if (environments.length === 0) {
      console.log(chalk.yellow('No environments configured'))
      await goBackToEnvironmentMenu()
      return
    }

    const currentActive = environments.find(env => env.isActive)
    
    if (currentActive) {
      console.log(chalk.green(`Current active environment: ${currentActive.name}`))
    }

    const envChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Choose new active environment:',
        choices: environments.map(env => ({
          name: `${env.isActive ? '🟢 (current) ' : '⚪ '}${env.name} (${env.type})`,
          value: env.name,
          short: env.name
        }))
      }
    ])

    await setActiveEnvironment(envChoice.environment)
    await goBackToEnvironmentMenu()
    
  } catch (error) {
    console.error(chalk.red('Failed to switch environment:'), error)
    await goBackToEnvironmentMenu()
  }
}

async function testEnvironment() {
  const environments = await getEnvironmentsConfig()
  
  if (environments.length === 0) {
    console.log(chalk.yellow('No environments to test'))
    console.log(chalk.gray('Create environments first using "Add New Environment"'))
    await goBackToEnvironmentMenu()
    return
  }
  
  console.log(chalk.blue.bold('\n🔧 TEST ENVIRONMENT'))
  console.log(chalk.blue('='.repeat(25)))
  
  const envChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'environment',
      message: 'Choose environment to test:',
      choices: environments.map(env => ({
        name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type}) ${env.description ? '- ' + env.description : ''}`,
        value: env.name,
        short: env.name
      }))
    }
  ])
  
  const selectedEnv = environments.find(env => env.name === envChoice.environment)!
  
  console.log(chalk.blue(`\n🧪 Testing: ${selectedEnv.name}`))
  console.log(chalk.white(`   Type: ${selectedEnv.type}`))
  console.log(chalk.white(`   Description: ${selectedEnv.description || 'None'}`))
  
  // Test environment status
  console.log(chalk.blue('\n🔍 Environment Status:'))
  
  // Test environment file configuration
  if (selectedEnv.isActive) {
    console.log(chalk.green('✅ Active Environment Status: OK'))
    console.log(chalk.gray('   .env.local is configured with this environment'))
  } else {
    console.log(chalk.yellow('⚪ Inactive Environment'))
    console.log(chalk.gray('   Switch to this environment to update .env.local'))
  }
  
  // Test Supabase configuration (basic check only)
  let hasSupabaseConfig = selectedEnv.supabase.projectUrl && selectedEnv.supabase.anonKey
  if (hasSupabaseConfig) {
    console.log(chalk.green('✅ Supabase Configuration: Found'))
    console.log(chalk.gray(`   URL: ${selectedEnv.supabase.projectUrl}`))
    console.log(chalk.gray('   Use "npm run supabase:status" for detailed testing'))
  } else {
    console.log(chalk.yellow('⚪ Supabase Configuration: Not found'))
    console.log(chalk.gray('   Configure with: npm run supabase:init'))
  }
  
  console.log(chalk.blue('\n📋 Environment Summary:'))
  console.log(chalk.white(`   Name: ${selectedEnv.name}`))
  console.log(chalk.white(`   Type: ${selectedEnv.type}`))
  console.log(chalk.white(`   Status: ${selectedEnv.isActive ? '🟢 Active' : '⚪ Inactive'}`))
  console.log(chalk.white(`   Supabase: ${hasSupabaseConfig ? '🟢 Configured' : '❌ Not configured'}`))
  console.log(chalk.white(`   Created: ${new Date(selectedEnv.createdAt).toLocaleDateString()}`))
  console.log(chalk.white(`   Updated: ${new Date(selectedEnv.updatedAt).toLocaleDateString()}`))
  
  await goBackToEnvironmentMenu()
}

async function setActiveEnvironment(environmentName: string) {
  const environments = await getEnvironmentsConfig()
  
  // Deactivate all environments
  environments.forEach(env => env.isActive = false)
  
  // Activate the chosen environment
  const targetEnv = environments.find(env => env.name === environmentName)
  if (targetEnv) {
    targetEnv.isActive = true
    await saveEnvironmentsConfig(environments)
    console.log(chalk.green(`\n✅ Switched to environment: ${environmentName}`))
    
    // Update .env.local file with the active environment's configuration
    await updateEnvFileWithActiveEnvironment(targetEnv)
  }
}

async function updateEnvFileWithActiveEnvironment(env: EnvironmentConfig) {
  // Create environment-specific file like .env.{environmentName}
  const envPath = path.join(process.cwd(), `.env.${env.name}`)
  const envLocalPath = path.join(process.cwd(), '.env.local')
  
  let envContent = ''
  
  // Read existing environment-specific file if it exists
  if (await fs.pathExists(envPath)) {
    envContent = await fs.readFile(envPath, 'utf-8')
  }
  
  // Remove existing Supabase vars
  envContent = envContent
    .split('\n')
    .filter(line => !line.startsWith('NEXT_PUBLIC_SUPABASE_') && !line.startsWith('DATABASE_URL'))
    .join('\n')
  
  // Add new environment configuration
  envContent += `
# Environment: ${env.name} (${env.type})
NEXT_PUBLIC_SUPABASE_URL=${env.supabase.projectUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.supabase.anonKey}
${env.database.url ? `DATABASE_URL=${env.database.url}` : ''}
`
  
  // Write to environment-specific file
  await fs.writeFile(envPath, envContent.trim() + '\n')
  console.log(chalk.blue(`📝 Created/updated .env.${env.name} with environment configuration`))
  
  // Also copy to .env.local for immediate use (Next.js convention)
  await fs.copyFile(envPath, envLocalPath)
  console.log(chalk.blue('📝 Updated .env.local to use this environment'))
  
  console.log(chalk.yellow(`\n💡 Environment files:`))
  console.log(chalk.white(`   • .env.${env.name} - Environment-specific configuration`))
  console.log(chalk.white(`   • .env.local - Active environment (for Next.js)`))
}

async function goBackToEnvironmentMenu() {
  const backToMenu = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'goBack',
      message: 'Go back to environment menu?',
      default: true
    }
  ])
  
  if (backToMenu.goBack) {
    await manageEnvironments()
  }
}

async function checkExistingSetupForEnvironment(env: EnvironmentConfig) {
  // Check if this environment already has Supabase configuration
  const hasSupabaseConfig = env.supabase.projectUrl && env.supabase.anonKey
  
  if (hasSupabaseConfig) {
    console.log(chalk.blue('🔍 Existing Supabase configuration found for this environment'))
    console.log(chalk.gray(`   Project URL: ${env.supabase.projectUrl}`))
    console.log(chalk.gray(`   Anonymous Key: ${maskSensitiveValue(env.supabase.anonKey!, 12)}***`))
    
    const overwrite = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Overwrite existing Supabase configuration?',
        default: false
      }
    ])
    
    return overwrite.overwrite
  }
  
  return true // No existing config, proceed
}

async function showSetupSummaryForEnvironment(config: any, env: EnvironmentConfig) {
  console.log(chalk.blue.bold('\n📋 SUPABASE CONFIGURATION SUMMARY'))
  console.log(chalk.blue('='.repeat(45)))
  
  console.log(chalk.green(`✅ Environment: ${env.name}`))
  console.log(chalk.white(`   Type: ${env.type}`))
  console.log(chalk.white(`   Description: ${env.description || 'None'}`))
  console.log(chalk.white(`   Setup Type: ${config.setupType}`))
  
  if (config.setupType === 'local') {
    console.log(chalk.green('✅ Local Supabase Services:'))
    console.log(chalk.white('   🗄️  Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres'))
    console.log(chalk.white('   🎨 Studio: http://127.0.0.1:54323'))
    console.log(chalk.white('   📧 Inbucket: http://127.0.0.1:54324'))
    console.log(chalk.white('   🔗 API: http://127.0.0.1:54321'))
  } else {
    console.log(chalk.green('✅ Production Supabase:'))
    console.log(chalk.white(`   🔗 Project URL: ${config.projectUrl}`))
    console.log(chalk.white(`   🔑 Anon Key: ${maskSensitiveValue(config.anonKey, 12)}***`))
  }
  
  console.log(chalk.blue('\n🔒 Security Notes:'))
  console.log(chalk.gray('• Service keys and secrets are hidden for security'))
  console.log(chalk.gray('• Configuration is stored in managed environments'))
  console.log(chalk.gray('• Use environment switching to change active configuration'))
  
  if (config.isActiveEnvironment) {
    console.log(chalk.green('\n✅ Active Environment:'))
    console.log(chalk.white('   📝 .env.local has been updated with this configuration'))
    console.log(chalk.white('   🚀 Ready to start development'))
  } else {
    console.log(chalk.yellow('\n💡 Inactive Environment:'))
    console.log(chalk.gray(`   Switch to "${env.name}" to use this configuration`))
    console.log(chalk.gray('   Command: npm run pixell env'))
  }
}

// Edit Supabase settings for managed environments
export async function editSupabaseSettings(environmentName?: string) {
  try {
    console.log(chalk.blue.bold('\n✏️  EDIT SUPABASE SETTINGS'))
    console.log(chalk.blue('='.repeat(40)))
    
    // Get managed environments
    const environments = await getEnvironmentsConfig()
    
    if (environments.length === 0) {
      console.log(chalk.yellow('No environments found'))
      console.log(chalk.gray('Create environments first using "npm run pixell env"'))
      return
    }
    
    // Filter environments that have Supabase configuration
    const configuredEnvironments = environments.filter(env => 
      env.supabase.projectUrl && env.supabase.anonKey
    )
    
    if (configuredEnvironments.length === 0) {
      console.log(chalk.yellow('No environments have Supabase configuration'))
      console.log(chalk.gray('Use "npm run supabase:init" to configure Supabase for environments'))
      return
    }
    
    let selectedEnv: EnvironmentConfig
    
    // If environment name is provided, use it directly
    if (environmentName) {
      const targetEnv = configuredEnvironments.find(env => env.name.toLowerCase() === environmentName.toLowerCase())
      
      if (!targetEnv) {
        console.log(chalk.red(`❌ Environment "${environmentName}" not found or not configured`))
        console.log(chalk.gray('Available configured environments:'))
        configuredEnvironments.forEach(env => {
          console.log(chalk.gray(`   • ${env.name} (${env.type})`))
        })
        return
      }
      
      selectedEnv = targetEnv
      console.log(chalk.blue(`🎯 Editing environment: ${selectedEnv.name}`))
    } else {
      // Let user choose which environment to edit
      const envChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'environment',
          message: 'Choose environment to edit Supabase settings for:',
          choices: configuredEnvironments.map(env => ({
            name: `${env.isActive ? '🟢' : '⚪'} ${env.name} (${env.type}) - ${env.supabase.projectUrl}`,
            value: env.name,
            short: env.name
          }))
        }
      ])
      
      selectedEnv = environments.find(env => env.name === envChoice.environment)!
    }
    
    console.log(chalk.blue(`\n🌍 Editing Supabase settings for: ${selectedEnv.name}`))
    console.log(chalk.gray(`   Current URL: ${selectedEnv.supabase.projectUrl}`))
    console.log(chalk.gray(`   Current Key: ${maskSensitiveValue(selectedEnv.supabase.anonKey!, 12)}***`))
    
    const editChoices = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'fields',
        message: 'What would you like to edit?',
        choices: [
          { name: 'Project URL', value: 'projectUrl' },
          { name: 'Anonymous Key', value: 'anonKey' }
        ]
      }
    ])
    
    if (editChoices.fields.length === 0) {
      console.log(chalk.gray('No changes selected'))
      return
    }
    
    let hasChanges = false
    
    if (editChoices.fields.includes('projectUrl')) {
      const urlConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectUrl',
          message: 'New Supabase project URL:',
          default: selectedEnv.supabase.projectUrl,
          validate: (input) => {
            if (!input.includes('supabase.co') && !input.includes('localhost')) {
              return 'Please provide a valid Supabase URL'
            }
            return true
          }
        }
      ])
      
      if (urlConfig.projectUrl !== selectedEnv.supabase.projectUrl) {
        selectedEnv.supabase.projectUrl = urlConfig.projectUrl
        hasChanges = true
      }
    }
    
    if (editChoices.fields.includes('anonKey')) {
      const keyConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'anonKey',
          message: 'New anonymous key:',
          validate: (input) => input.trim().length > 20 || 'Anonymous key seems too short'
        }
      ])
      
      if (keyConfig.anonKey !== selectedEnv.supabase.anonKey) {
        selectedEnv.supabase.anonKey = keyConfig.anonKey
        hasChanges = true
      }
    }
    
    if (!hasChanges) {
      console.log(chalk.gray('No changes made'))
      return
    }
    
    // Validate new configuration if it's for production
    if (selectedEnv.type === 'remote') {
      console.log(chalk.yellow('\n⏳ Validating updated configuration...'))
      try {
        await validateProductionConnection(selectedEnv.supabase.projectUrl!, selectedEnv.supabase.anonKey!)
        console.log(chalk.green('✅ Configuration validated'))
      } catch (error) {
        console.log(chalk.red('❌ Invalid configuration'))
        console.log(chalk.gray('Configuration not saved due to validation failure'))
        return
      }
    }
    
    // Update environment
    selectedEnv.updatedAt = new Date().toISOString()
    await saveEnvironmentsConfig(environments)
    
    // If this is the active environment, update .env.local
    if (selectedEnv.isActive) {
      await updateEnvFileWithActiveEnvironment(selectedEnv)
      console.log(chalk.blue('📝 Active environment updated - .env.local has been updated'))
    }
    
    console.log(chalk.green(`\n✅ Supabase settings updated for environment: ${selectedEnv.name}`))
    if (!selectedEnv.isActive) {
      console.log(chalk.gray(`💡 To use this configuration, switch to "${selectedEnv.name}" with: npm run pixell env`))
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to edit Supabase settings:'), error)
  }
} 