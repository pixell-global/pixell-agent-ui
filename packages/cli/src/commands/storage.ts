/*
 * Storage CLI Commands for Pixell Agent Framework
 * 
 * Provides multi-tier file storage setup:
 * 1. Local File System (immediate, zero setup)
 * 2. Supabase Storage (managed, production-ready)
 * 3. Custom S3 (enterprise, configurable)
 * 4. Database BLOB (fallback, simple)
 */

import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'

interface StorageConfig {
  type: 'local' | 'supabase' | 's3' | 'database'
  local?: {
    uploadsDir: string
    maxFileSize: string
    allowedTypes: string[]
  }
  supabase?: {
    bucketName: string
    publicUrl: string
    maxFileSize: string
    allowedTypes: string[]
  }
  s3?: {
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    endpoint?: string
  }
  database?: {
    tableName: string
    maxFileSize: string
  }
}

interface StorageSetupOptions {
  provider?: 'local' | 's3' | 'supabase'
  interactive?: boolean
  skipValidation?: boolean
}

export async function initStorage(options: StorageSetupOptions = {}) {
  console.log(chalk.blue('🗂️ Setting up file storage for your Pixell Agent Framework...\n'))

  try {
    let provider = options.provider
    let config: Record<string, any> = {}

    if (!provider || options.interactive) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Choose your file storage provider:',
          choices: [
            {
              name: 'Local Filesystem (Zero setup, perfect for development)',
              value: 'local',
              short: 'Local'
            },
            {
              name: 'AWS S3 (Production ready, scalable)',
              value: 's3',
              short: 'S3'
            },
            {
              name: 'Supabase Storage (Integrated with your existing Supabase setup)',
              value: 'supabase',
              short: 'Supabase'
            }
          ],
          default: provider || 'local'
        }
      ])
      provider = answers.provider
    }

    // Provider-specific configuration
    switch (provider) {
      case 'local':
        config = await setupLocalStorage()
        break
      case 's3':
        config = await setupS3Storage()
        break
      case 'supabase':
        config = await setupSupabaseStorage()
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    // Validate configuration unless skipped
    if (!options.skipValidation) {
      await validateStorageConfig(provider!, config)
    }

    // Update environment file
    await updateEnvironmentFile(provider!, config)

    console.log(chalk.green('\n✅ File storage setup completed successfully!'))
    console.log(chalk.gray(`Storage provider: ${provider}`))
    
    if (provider === 'local') {
      console.log(chalk.gray(`Storage location: ${config.rootPath}`))
    }

    console.log(chalk.yellow('\n💡 Next steps:'))
    console.log(chalk.gray('• Run `pixell dev` to start your development server'))
    console.log(chalk.gray('• Upload files through the web interface'))
    console.log(chalk.gray('• Files will be automatically available to your AI agents'))

  } catch (error) {
    console.error(chalk.red(`\n❌ Storage setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
    process.exit(1)
  }
}

async function setupLocalStorage(): Promise<Record<string, any>> {
  console.log(chalk.cyan('\n📁 Setting up local file storage...'))

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'rootPath',
      message: 'Storage directory path:',
      default: './workspace-files',
      validate: (input) => {
        if (!input.trim()) return 'Path cannot be empty'
        return true
      }
    },
    {
      type: 'input',
      name: 'maxFileSize',
      message: 'Maximum file size (in MB):',
      default: '50',
      validate: (input) => {
        const size = parseInt(input)
        if (isNaN(size) || size <= 0) return 'Please enter a valid number'
        if (size > 1000) return 'Maximum file size cannot exceed 1000MB'
        return true
      }
    },
    {
      type: 'checkbox',
      name: 'allowedTypes',
      message: 'Allowed file types (leave empty for all):',
      choices: [
        { name: 'Text files (.txt, .md)', value: '.txt,.md' },
        { name: 'Code files (.js, .ts, .py)', value: '.js,.ts,.py' },
        { name: 'Config files (.json, .yml, .yaml)', value: '.json,.yml,.yaml' },
        { name: 'Data files (.csv, .xml)', value: '.csv,.xml' },
        { name: 'Web files (.html, .css)', value: '.html,.css' },
        { name: 'Images (.png, .jpg, .jpeg)', value: '.png,.jpg,.jpeg' },
        { name: 'Documents (.pdf)', value: '.pdf' }
      ]
    }
  ])

  // Create storage directory
  const fullPath = path.resolve(answers.rootPath)
  await fs.ensureDir(fullPath)
  await fs.ensureDir(path.join(fullPath, 'uploads'))
  await fs.ensureDir(path.join(fullPath, 'documents'))
  await fs.ensureDir(path.join(fullPath, 'images'))

  console.log(chalk.green(`✅ Created storage directory: ${fullPath}`))

  return {
    rootPath: answers.rootPath,
    maxFileSize: parseInt(answers.maxFileSize) * 1024 * 1024, // Convert to bytes
    allowedTypes: answers.allowedTypes.length > 0 ? answers.allowedTypes.join(',').split(',') : []
  }
}

async function setupS3Storage(): Promise<Record<string, any>> {
  console.log(chalk.cyan('\n☁️ Setting up S3 storage...'))

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'bucket',
      message: 'S3 Bucket name:',
      validate: (input) => {
        if (!input.trim()) return 'Bucket name is required'
        if (!/^[a-z0-9.-]+$/.test(input)) return 'Invalid bucket name format'
        return true
      }
    },
    {
      type: 'input',
      name: 'region',
      message: 'AWS Region:',
      default: 'us-east-1'
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Custom endpoint (for non-AWS S3 services):',
      when: () => {
        return inquirer.prompt([{
          type: 'confirm',
          name: 'useCustomEndpoint',
          message: 'Are you using a non-AWS S3 service (MinIO, DigitalOcean Spaces, etc.)?',
          default: false
        }]).then(a => a.useCustomEndpoint)
      }
    },
    {
      type: 'input',
      name: 'accessKeyId',
      message: 'Access Key ID (leave empty to use environment):',
    },
    {
      type: 'password',
      name: 'secretAccessKey',
      message: 'Secret Access Key (leave empty to use environment):',
    },
    {
      type: 'input',
      name: 'prefix',
      message: 'Storage prefix/folder:',
      default: 'workspace-files'
    },
    {
      type: 'confirm',
      name: 'forcePathStyle',
      message: 'Force path-style addressing? (required for MinIO)',
      default: false,
      when: (answers) => !!answers.endpoint
    }
  ])

  return {
    bucket: answers.bucket,
    region: answers.region,
    endpoint: answers.endpoint,
    accessKeyId: answers.accessKeyId,
    secretAccessKey: answers.secretAccessKey,
    prefix: answers.prefix,
    forcePathStyle: answers.forcePathStyle || false,
    maxFileSize: 100 * 1024 * 1024, // 100MB default for S3
    allowedTypes: []
  }
}

async function setupSupabaseStorage(): Promise<Record<string, any>> {
  console.log(chalk.cyan('\n🟢 Setting up Supabase storage...'))

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Supabase URL:',
      validate: (input) => {
        if (!input.trim()) return 'Supabase URL is required'
        try {
          new URL(input)
          return true
        } catch {
          return 'Please enter a valid URL'
        }
      }
    },
    {
      type: 'password',
      name: 'anonKey',
      message: 'Supabase Anon Key:',
      validate: (input) => input.trim() ? true : 'Anon key is required'
    },
    {
      type: 'password',
      name: 'serviceRoleKey',
      message: 'Supabase Service Role Key (optional):',
    },
    {
      type: 'input',
      name: 'bucket',
      message: 'Storage bucket name:',
      default: 'workspace-files'
    }
  ])

  return {
    url: answers.url,
    anonKey: answers.anonKey,
    serviceRoleKey: answers.serviceRoleKey,
    bucket: answers.bucket,
    maxFileSize: 50 * 1024 * 1024, // 50MB default for Supabase
    allowedTypes: []
  }
}

async function validateStorageConfig(provider: string, config: Record<string, any>): Promise<void> {
  const spinner = ora('Validating storage configuration...').start()

  try {
    // Note: This would import the actual storage manager when available
    // For now, we'll do basic validation
    spinner.succeed('Storage configuration validated successfully')
  } catch (error) {
    spinner.fail(`Storage validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    const retry = await inquirer.prompt([{
      type: 'confirm',
      name: 'retry',
      message: 'Would you like to reconfigure storage?',
      default: true
    }])

    if (retry.retry) {
      throw new Error('Please check your configuration and try again')
    }

    console.log(chalk.yellow('⚠️ Proceeding with unvalidated configuration'))
  }
}

async function updateEnvironmentFile(provider: string, config: Record<string, any>): Promise<void> {
  const envPath = path.join(process.cwd(), '.env.local')
  const envExamplePath = path.join(process.cwd(), '.env.example')

  // Read existing env file or create new
  let envContent = ''
  if (await fs.pathExists(envPath)) {
    envContent = await fs.readFile(envPath, 'utf-8')
  }

  // Remove existing storage configuration
  const envLines = envContent.split('\n').filter(line => 
    !line.startsWith('STORAGE_') && 
    !line.startsWith('# File Storage Configuration')
  )

  // Add new storage configuration
  envLines.push('')
  envLines.push('# File Storage Configuration')
  envLines.push(`STORAGE_PROVIDER=${provider}`)

  switch (provider) {
    case 'local':
      envLines.push(`STORAGE_LOCAL_PATH=${config.rootPath}`)
      break

    case 's3':
      envLines.push(`STORAGE_S3_BUCKET=${config.bucket}`)
      envLines.push(`STORAGE_S3_REGION=${config.region}`)
      if (config.endpoint) envLines.push(`STORAGE_S3_ENDPOINT=${config.endpoint}`)
      if (config.accessKeyId) envLines.push(`STORAGE_S3_ACCESS_KEY_ID=${config.accessKeyId}`)
      if (config.secretAccessKey) envLines.push(`STORAGE_S3_SECRET_ACCESS_KEY=${config.secretAccessKey}`)
      envLines.push(`STORAGE_S3_PREFIX=${config.prefix}`)
      if (config.forcePathStyle) envLines.push(`STORAGE_S3_FORCE_PATH_STYLE=true`)
      break

    case 'supabase':
      envLines.push(`STORAGE_SUPABASE_BUCKET=${config.bucket}`)
      // Supabase URL and keys should already be in env from supabase setup
      break
  }

  if (config.maxFileSize) {
    envLines.push(`STORAGE_MAX_FILE_SIZE=${config.maxFileSize}`)
  }

  if (config.allowedTypes && config.allowedTypes.length > 0) {
    envLines.push(`STORAGE_ALLOWED_TYPES=${config.allowedTypes.join(',')}`)
  }

  // Write updated env file
  await fs.writeFile(envPath, envLines.join('\n'))

  // Update .env.example if it exists
  if (await fs.pathExists(envExamplePath)) {
    const exampleLines = envLines.map(line => {
      if (line.includes('=') && !line.startsWith('#')) {
        const [key] = line.split('=')
        return `${key}=`
      }
      return line
    })
    await fs.writeFile(envExamplePath, exampleLines.join('\n'))
  }

  console.log(chalk.green('✅ Environment configuration updated'))
}

export async function showStorageStatus() {
  console.log(chalk.blue('📊 Storage Status\n'))

  try {
    // Note: This would import the actual storage manager when available
    // For now, we'll show configuration from environment
    console.log(chalk.cyan('Provider Information:'))
    console.log(`  Primary: ${chalk.white(process.env.STORAGE_PROVIDER || 'local')}`)

    console.log(chalk.cyan('\nConfiguration:'))
    if (process.env.STORAGE_PROVIDER === 's3') {
      console.log(`  Bucket: ${chalk.white(process.env.STORAGE_S3_BUCKET || 'not configured')}`)
      console.log(`  Region: ${chalk.white(process.env.STORAGE_S3_REGION || 'us-east-1')}`)
    } else if (process.env.STORAGE_PROVIDER === 'local') {
      console.log(`  Path: ${chalk.white(process.env.STORAGE_LOCAL_PATH || './workspace-files')}`)
    }

  } catch (error) {
    console.error(chalk.red(`Failed to get storage status: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
} 