import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync, spawn } from 'child_process'
import execa from 'execa'
import path from 'path'
import fs from 'fs-extra'

/**
 * Service Management Commands
 * Handles starting, stopping, and monitoring all Pixell services
 */

interface ServiceStatus {
  name: string
  status: 'running' | 'stopped' | 'starting' | 'error'
  port?: number
  url?: string
  healthCheck?: string
  description: string
}

interface ServicesOptions {
  environment?: string
  detached?: boolean
  services?: string[]
}

/**
 * Start all services
 */
export async function startServices(options: ServicesOptions = {}): Promise<void> {
  console.log(chalk.blue.bold('\n🚀 STARTING ALL SERVICES'))
  console.log(chalk.blue('='.repeat(50)))
  
  const environment = options.environment || 'local'
  console.log(chalk.gray(`Environment: ${environment}`))
  
  try {
    // Check prerequisites
    await checkPrerequisites()
    
    // Determine Docker Compose files
    const composeFiles = getComposeFiles(environment)
    
    // Start services
    await startDockerServices(composeFiles, options)
    
    // Wait for services to initialize
    console.log(chalk.gray('\n⏳ Waiting for services to initialize...'))
    await new Promise(resolve => setTimeout(resolve, 15000))
    
    // Check service health
    await checkAllServicesHealth()
    
    // Display service URLs
    displayServiceUrls()
    
    console.log(chalk.green('\n🎉 All services started successfully!'))
    
  } catch (error) {
    console.log(chalk.red('\n❌ Failed to start services'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

/**
 * Stop all services
 */
export async function stopServices(options: ServicesOptions = {}): Promise<void> {
  console.log(chalk.blue.bold('\n🛑 STOPPING ALL SERVICES'))
  console.log(chalk.blue('='.repeat(50)))
  
  try {
    const environment = options.environment || 'local'
    const composeFiles = getComposeFiles(environment)
    
    const spinner = ora('🛑 Stopping Docker services...').start()
    
    // Stop services
    execSync(`docker compose ${composeFiles.join(' ')} down`, {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    spinner.succeed('✅ All services stopped')
    
  } catch (error) {
    console.log(chalk.red('❌ Failed to stop services'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Restart all services
 */
export async function restartServices(options: ServicesOptions = {}): Promise<void> {
  console.log(chalk.blue.bold('\n🔄 RESTARTING ALL SERVICES'))
  console.log(chalk.blue('='.repeat(50)))
  
  await stopServices(options)
  await new Promise(resolve => setTimeout(resolve, 2000))
  await startServices(options)
}

/**
 * Check status of all services
 */
export async function statusServices(): Promise<void> {
  console.log(chalk.blue.bold('\n📊 SERVICE STATUS'))
  console.log(chalk.blue('='.repeat(40)))
  
  const services = await getAllServiceStatuses()
  
  console.log(chalk.blue('\n🔍 Service Health Checks:'))
  
  for (const service of services) {
    const statusIcon = getStatusIcon(service.status)
    const statusColor = getStatusColor(service.status)
    
    console.log(statusColor(`   ${statusIcon} ${service.name}`))
    console.log(chalk.gray(`     Description: ${service.description}`))
    
    if (service.url) {
      console.log(chalk.gray(`     URL: ${service.url}`))
    }
    
    if (service.port) {
      console.log(chalk.gray(`     Port: ${service.port}`))
    }
    
    console.log(chalk.gray(`     Status: ${service.status}`))
    console.log('')
  }
  
  // Summary
  const running = services.filter(s => s.status === 'running').length
  const total = services.length
  
  if (running === total) {
    console.log(chalk.green(`🎉 All ${total} services are running!`))
  } else {
    console.log(chalk.yellow(`⚠️ ${running}/${total} services are running`))
  }
  
  // Docker Compose status
  await showDockerComposeStatus()
}

/**
 * Show logs for services
 */
export async function logsServices(options: { service?: string; follow?: boolean } = {}): Promise<void> {
  console.log(chalk.blue.bold('\n📋 SERVICE LOGS'))
  console.log(chalk.blue('='.repeat(40)))
  
  try {
    const composeFiles = getComposeFiles('local')
    const serviceArg = options.service ? options.service : ''
    const followArg = options.follow ? '-f' : ''
    
    const command = `docker compose ${composeFiles.join(' ')} logs ${followArg} ${serviceArg}`.trim()
    
    console.log(chalk.gray(`Command: ${command}\n`))
    
    // Use spawn for real-time logs
    const child = spawn('docker', ['compose',
      ...composeFiles,
      'logs',
      ...(options.follow ? ['-f'] : []),
      ...(options.service ? [options.service] : [])
    ], {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      child.kill('SIGINT')
      process.exit(0)
    })
    
  } catch (error) {
    console.log(chalk.red('❌ Failed to show logs'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Scale services
 */
export async function scaleServices(service: string, replicas: number): Promise<void> {
  console.log(chalk.blue.bold(`\n📈 SCALING ${service.toUpperCase()}`))
  console.log(chalk.blue('='.repeat(40)))
  
  try {
    const composeFiles = getComposeFiles('local')
    
    const spinner = ora(`📈 Scaling ${service} to ${replicas} replicas...`).start()
    
    execSync(`docker compose ${composeFiles.join(' ')} up -d --scale ${service}=${replicas}`, {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    spinner.succeed(`✅ ${service} scaled to ${replicas} replicas`)
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to scale ${service}`))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Helper Functions
 */

async function checkPrerequisites(): Promise<void> {
  const spinner = ora('🔍 Checking prerequisites...').start()
  
  try {
    // Check Docker
    await execa('docker', ['--version'])
    await execa('docker', ['compose', '--version'])
    
    // Check if Docker is running
    await execa('docker', ['ps'])
    
    spinner.succeed('✅ Prerequisites check passed')
    
  } catch (error) {
    spinner.fail('❌ Prerequisites check failed')
    console.log(chalk.yellow('\n💡 Required:'))
    console.log(chalk.white('   • Docker installed and running'))
    console.log(chalk.white('   • Docker Compose installed'))
    throw new Error('Prerequisites not met')
  }
}

function getComposeFiles(environment: string): string[] {
  const files = ['-f', 'docker-compose.yml']
  
  if (environment === 'local' || environment === 'development') {
    if (fs.existsSync(path.join(process.cwd(), 'docker-compose.dev.yml'))) {
      files.push('-f', 'docker-compose.dev.yml')
    }
  }
  
  if (environment === 'production') {
    if (fs.existsSync(path.join(process.cwd(), 'docker-compose.prod.yml'))) {
      files.push('-f', 'docker-compose.prod.yml')
    }
  }
  
  return files
}

async function startDockerServices(composeFiles: string[], options: ServicesOptions): Promise<void> {
  const spinner = ora('🐳 Starting Docker services...').start()
  
  try {
    const services = options.services ? options.services.join(' ') : ''
    const detachedFlag = options.detached !== false ? '-d' : '' // Default to detached
    
    const command = `docker compose ${composeFiles.join(' ')} up ${detachedFlag} ${services}`.trim()
    
    execSync(command, {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    spinner.succeed('✅ Docker services started')
    
  } catch (error) {
    spinner.fail('❌ Failed to start Docker services')
    throw error
  }
}

async function getAllServiceStatuses(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [
    {
      name: 'PAF Core Agent',
      description: 'Python microservice with UPEE cognitive loop',
      port: 8000,
      url: 'http://localhost:8000',
      healthCheck: 'http://localhost:8000/api/health',
      status: 'stopped'
    },
    {
      name: 'Supabase REST API',
      description: 'PostgreSQL REST API via PostgREST',
      port: 54321,
      url: 'http://localhost:54321',
      healthCheck: 'http://localhost:54321/rest/v1/',
      status: 'stopped'
    },
    {
      name: 'Supabase Database',
      description: 'PostgreSQL database',
      port: 54322,
      url: 'postgresql://postgres:postgres@localhost:54322/postgres',
      status: 'stopped'
    },
    {
      name: 'Supabase Studio',
      description: 'Database management interface',
      port: 54323,
      url: 'http://localhost:54323',
      healthCheck: 'http://localhost:54323',
      status: 'stopped'
    },
    {
      name: 'Supabase Auth',
      description: 'Authentication service',
      port: 54324,
      url: 'http://localhost:54324',
      status: 'stopped'
    },
    {
      name: 'Supabase Storage',
      description: 'File storage service',
      port: 54325,
      url: 'http://localhost:54325',
      status: 'stopped'
    },
    {
      name: 'Supabase Realtime',
      description: 'Real-time subscriptions',
      port: 54326,
      url: 'http://localhost:54326',
      status: 'stopped'
    }
  ]
  
  // Check actual status of each service
  for (const service of services) {
    if (service.healthCheck) {
      try {
        await execa('curl', ['-f', service.healthCheck], { timeout: 3000 })
        service.status = 'running'
      } catch {
        service.status = 'stopped'
      }
    } else if (service.port) {
      // Check if port is in use
      try {
        await execa('nc', ['-z', 'localhost', service.port.toString()], { timeout: 2000 })
        service.status = 'running'
      } catch {
        service.status = 'stopped'
      }
    }
  }
  
  return services
}

async function checkAllServicesHealth(): Promise<void> {
  const services = await getAllServiceStatuses()
  
  console.log(chalk.blue('\n🔍 Health Check Results:'))
  
  for (const service of services) {
    const statusIcon = getStatusIcon(service.status)
    const statusColor = getStatusColor(service.status)
    
    console.log(statusColor(`   ${statusIcon} ${service.name}`))
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'running': return '✅'
    case 'starting': return '🟡'
    case 'stopped': return '🔴'
    case 'error': return '❌'
    default: return '❓'
  }
}

function getStatusColor(status: string): typeof chalk.green {
  switch (status) {
    case 'running': return chalk.green
    case 'starting': return chalk.yellow
    case 'stopped': return chalk.red
    case 'error': return chalk.red
    default: return chalk.gray
  }
}

function displayServiceUrls(): void {
  console.log(chalk.blue('\n📍 Service URLs:'))
  console.log(chalk.gray('   • PAF Core Agent: http://localhost:8000'))
  console.log(chalk.gray('   • PAF Core Agent API Docs: http://localhost:8000/docs'))
  console.log(chalk.gray('   • Supabase REST API: http://localhost:54321'))
  console.log(chalk.gray('   • Supabase Studio: http://localhost:54323'))
  console.log(chalk.gray('   • PostgreSQL: localhost:54322'))
  
  console.log(chalk.blue('\n🛠️ Development URLs:'))
  console.log(chalk.gray('   • Frontend: http://localhost:3003 (when running npm run dev)'))
  console.log(chalk.gray('   • Backend: http://localhost:3001 (when running npm run dev)'))
}

async function showDockerComposeStatus(): Promise<void> {
  try {
    console.log(chalk.blue('\n🐳 Docker Compose Status:'))
    
    const result = await execa('docker', ['compose', 'ps'], {
      cwd: process.cwd()
    })
    
    if (result.stdout.trim()) {
      console.log(chalk.gray(result.stdout))
    } else {
      console.log(chalk.gray('   No containers running'))
    }
    
  } catch (error) {
    console.log(chalk.gray('   Could not retrieve Docker Compose status'))
  }
}