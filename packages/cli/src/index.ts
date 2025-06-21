#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { createApp } from './commands/create'
import { generateWorker } from './commands/generate'
import { deployApp } from './commands/deploy'
import { swapRuntime } from './commands/runtime'
import { installExtension, listExtensions, uninstallExtension } from './commands/extensions'
import { initConfig, showConfig } from './commands/config'
import { initStorage, showStorageStatus } from './commands/storage'
import { initSupabase, stopSupabase, statusSupabase, resetSupabase, migrationsSupabase, manageEnvironments, editSupabaseSettings } from './commands/supabase'
import { installDocker, dockerStatus, dockerStart, ensureDockerForSupabase } from './commands/docker'
import { 
  listFiles, 
  copyFiles, 
  moveFiles, 
  removeFiles, 
  makeDirectory, 
  touchFile, 
  catFile, 
  headFile, 
  tailFile, 
  findFiles, 
  grepFiles, 
  diskUsage, 
  statFile, 
  showTree, 
  zipFiles, 
  unzipFiles, 
  changeMode 
} from './commands/filesystem'

const program = new Command()

// CLI Header
console.log(chalk.blue.bold(`
╔═══════════════════════════════════════╗
║        🤖 Pixell CLI v0.3.0           ║
║   Agent Framework Developer Tools     ║
╚═══════════════════════════════════════╝
`))

program
  .name('pixell')
  .description('CLI tools for Pixell Agent Framework development')
  .version('0.3.0')

// Create new agent app
program
  .command('create <app-name>')
  .description('Create a new Pixell agent application')
  .option('-t, --template <template>', 'App template to use', 'multi-agent')
  .option('-r, --runtime <runtime>', 'Agent runtime to use', 'aws-strand')
  .option('--no-install', 'Skip npm install')
  .option('--no-git', 'Skip git initialization')
  .action(createApp)

// Generate worker agent
program
  .command('generate-worker <n>')
  .description('Generate a new worker agent')
  .option('-d, --domain <domain>', 'Agent domain (e.g., social-media, analytics)', 'custom')
  .option('-t, --tools <tools>', 'Comma-separated list of tools', 'api')
  .option('-p, --protocol <protocol>', 'Communication protocol', 'a2a')
  .action(generateWorker)

// Deploy commands
program
  .command('deploy')
  .description('Deploy your agent application')
  .option('-p, --platform <platform>', 'Deployment platform', 'docker')
  .option('-e, --env <env>', 'Environment to deploy to', 'production')
  .option('--dry-run', 'Show deployment plan without executing')
  .action(deployApp)

// Runtime management
program
  .command('runtime-swap')
  .description('Swap the agent runtime')
  .option('--from <from>', 'Current runtime')
  .option('--to <to>', 'Target runtime')
  .option('--backup', 'Create backup before swapping')
  .action(swapRuntime)

// Extension management
program
  .command('extensions-list')
  .description('List available and installed extensions')
  .option('--type <type>', 'Filter by extension type')
  .option('--installed', 'Show only installed extensions')
  .action(listExtensions)

program
  .command('extensions-install <extension>')
  .description('Install an extension')
  .option('--version <version>', 'Specific version to install')
  .action(installExtension)

program
  .command('extensions-uninstall <extension>')
  .description('Uninstall an extension')
  .action(uninstallExtension)

// Configuration
program
  .command('config-init')
  .description('Initialize CLI configuration')
  .action(initConfig)

program
  .command('config-show')
  .description('Show current configuration')
  .action(showConfig)

// Storage setup
program
  .command('storage-init')
  .description('Set up file storage (local, Supabase, S3, or database)')
  .option('--force', 'Force reconfiguration of existing storage')
  .action(initStorage)

program
  .command('storage-status')
  .description('Show current storage configuration')
  .action(showStorageStatus)

// Environment Management
program
  .command('environments')
  .description('Manage development environments (local, staging, production)')
  .action(manageEnvironments)

// Environment Management (short alias)
program
  .command('env')
  .description('Manage development environments (short alias for environments)')
  .action(manageEnvironments)

// Supabase complete setup
program
  .command('supabase-init')
  .description('Complete Supabase setup (database, auth, storage)')
  .option('--env <environment>', 'Configure Supabase for specific environment')
  .option('--local', 'Use local Supabase only')
  .option('--skip-migrations', 'Skip running migrations')
  .option('--skip-auth', 'Skip authentication setup')
  .option('--skip-storage', 'Skip storage setup')
  .action((options) => initSupabase(options.env))

program
  .command('supabase-status')
  .description('Check Supabase service status')
  .option('--env <environment>', 'Check status for specific environment')
  .action((options) => statusSupabase(options.env))

program
  .command('supabase-stop')
  .description('Stop local Supabase services')
  .option('--env <environment>', 'Target specific environment (local only)')
  .action((options) => stopSupabase(options.env))

program
  .command('supabase-reset')
  .description('Reset local Supabase database')
  .option('--env <environment>', 'Target specific environment (local only)')
  .action((options) => resetSupabase(options.env))

program
  .command('supabase-migrations')
  .description('Manage database migrations (status, apply, create)')
  .option('--env <environment>', 'Use specific environment for migrations')
  .action((options) => migrationsSupabase(options.env))

program
  .command('supabase-edit')
  .description('Edit Supabase settings for managed environments')
  .option('--env <environment>', 'Edit settings for specific environment')
  .action((options) => editSupabaseSettings(options.env))

// Docker management
program
  .command('docker-install')
  .description('Install Docker (required for Supabase local development)')
  .action(installDocker)

program
  .command('docker-status')
  .description('Check Docker installation and running status (with option to start)')
  .action(dockerStatus)

program
  .command('docker-start')
  .description('Start Docker if installed (quick start without status check)')
  .action(dockerStart)

// ============================================
// FILESYSTEM COMMANDS
// ============================================

// List files and directories (ls)
program
  .command('ls [path]')
  .description('List directory contents')
  .option('-a, --all', 'Show hidden files')
  .option('-l, --long', 'Use long listing format')
  .option('-h, --human-readable', 'Human readable file sizes')
  .option('-r, --reverse', 'Reverse sort order')
  .option('-R, --recursive', 'List subdirectories recursively')
  .option('-t', 'Sort by modification time')
  .option('-S', 'Sort by file size')
  .action((path, options) => {
    const sortOption = options.t ? 'date' : options.S ? 'size' : 'name'
    listFiles(path, {
      all: options.all,
      long: options.long,
      human: options.humanReadable,
      reverse: options.reverse,
      recursive: options.recursive,
      sort: sortOption
    })
  })

// Copy files and directories (cp)
program
  .command('cp <source> <destination>')
  .description('Copy files or directories')
  .option('-r, --recursive', 'Copy directories recursively')
  .option('-f, --force', 'Force overwrite of destination files')
  .option('-p, --preserve', 'Preserve file timestamps')
  .option('-v, --verbose', 'Verbose output')
  .action((source, destination, options) => {
    copyFiles(source, destination, {
      recursive: options.recursive,
      force: options.force,
      preserve: options.preserve,
      verbose: options.verbose
    })
  })

// Move/rename files and directories (mv)
program
  .command('mv <source> <destination>')
  .description('Move or rename files and directories')
  .option('-f, --force', 'Force overwrite of destination files')
  .option('-v, --verbose', 'Verbose output')
  .action((source, destination, options) => {
    moveFiles(source, destination, {
      force: options.force,
      verbose: options.verbose
    })
  })

// Remove files and directories (rm)
program
  .command('rm <files...>')
  .description('Remove files and directories')
  .option('-r, --recursive', 'Remove directories recursively')
  .option('-f, --force', 'Force removal without confirmation')
  .option('-i, --interactive', 'Prompt before each removal')
  .option('-v, --verbose', 'Verbose output')
  .action((files, options) => {
    removeFiles(files, {
      recursive: options.recursive,
      force: options.force,
      interactive: options.interactive,
      verbose: options.verbose
    })
  })

// Create directory (mkdir)
program
  .command('mkdir <directory>')
  .description('Create directories')
  .option('-p, --parents', 'Create parent directories as needed')
  .option('-v, --verbose', 'Verbose output')
  .action((directory, options) => {
    makeDirectory(directory, {
      parents: options.parents,
      verbose: options.verbose
    })
  })

// Create empty file or update timestamp (touch)
program
  .command('touch <file>')
  .description('Create empty file or update timestamp')
  .option('-v, --verbose', 'Verbose output')
  .action((file, options) => {
    touchFile(file, {
      verbose: options.verbose
    })
  })

// Display file contents (cat)
program
  .command('cat <files...>')
  .description('Display file contents')
  .option('-n, --number', 'Number all output lines')
  .option('-E, --show-ends', 'Display $ at end of each line')
  .action((files, options) => {
    catFile(files, {
      numbered: options.number,
      showEnds: options.showEnds
    })
  })

// Display first lines of file (head)
program
  .command('head <file>')
  .description('Display first lines of a file')
  .option('-n, --lines <number>', 'Number of lines to display', '10')
  .action((file, options) => {
    headFile(file, {
      lines: parseInt(options.lines)
    })
  })

// Display last lines of file (tail)
program
  .command('tail <file>')
  .description('Display last lines of a file')
  .option('-n, --lines <number>', 'Number of lines to display', '10')
  .option('-f, --follow', 'Follow file changes (output appended data)')
  .action((file, options) => {
    tailFile(file, {
      lines: parseInt(options.lines),
      follow: options.follow
    })
  })

// Find files (find)
program
  .command('find <pattern> [path]')
  .description('Search for files and directories')
  .option('-type <type>', 'File type filter (f=file, d=directory)')
  .option('-name', 'Search by filename pattern')
  .action((pattern, path, options) => {
    findFiles(pattern, path, {
      type: options.type as 'f' | 'd',
      name: options.name
    })
  })

// Search within files (grep)
program
  .command('grep <pattern> <files...>')
  .description('Search for patterns within files')
  .option('-i, --ignore-case', 'Ignore case distinctions')
  .option('-n, --line-number', 'Show line numbers')
  .option('-r, --recursive', 'Search directories recursively')
  .action((pattern, files, options) => {
    grepFiles(pattern, files, {
      ignoreCase: options.ignoreCase,
      lineNumbers: options.lineNumber,
      recursive: options.recursive
    })
  })

// Show disk usage (du)
program
  .command('du [path]')
  .description('Display disk usage statistics')
  .option('-h, --human-readable', 'Human readable format')
  .option('-s, --summarize', 'Display only a total for each argument')
  .action((path, options) => {
    diskUsage(path, {
      human: options.humanReadable,
      summarize: options.summarize
    })
  })

// Show file statistics (stat)
program
  .command('stat <file>')
  .description('Display file or directory status')
  .action((file) => {
    statFile(file)
  })

// Display directory tree
program
  .command('tree [path]')
  .description('Display directory structure as a tree')
  .option('-L, --level <depth>', 'Maximum display depth')
  .option('-a, --all', 'Show all files including hidden')
  .action((path, options) => {
    showTree(path, {
      maxDepth: options.level ? parseInt(options.level) : undefined,
      showFiles: options.all
    })
  })

// Create zip archive
program
  .command('zip <archive> <files...>')
  .description('Create zip archive')
  .option('-v, --verbose', 'Verbose output')
  .option('-<number>', 'Compression level (0-9)', '6')
  .action((archive, files, options) => {
    zipFiles(archive, files, {
      verbose: options.verbose,
      compression: parseInt(options.number || '6')
    })
  })

// Extract zip archive
program
  .command('unzip <archive> [path]')
  .description('Extract zip archive')
  .option('-v, --verbose', 'Verbose output')
  .action((archive, path, options) => {
    unzipFiles(archive, path, {
      verbose: options.verbose
    })
  })

// Change file permissions (chmod)
program
  .command('chmod <mode> <files...>')
  .description('Change file permissions')
  .option('-R, --recursive', 'Change permissions recursively')
  .option('-v, --verbose', 'Verbose output')
  .action((mode, files, options) => {
    changeMode(mode, files, {
      recursive: options.recursive,
      verbose: options.verbose
    })
  })

// Global error handling - FIXED
program.exitOverride((err) => {
  if (err.code === 'commander.unknownCommand') {
    console.log(chalk.red(`Unknown command: ${err.message}`))
    console.log(chalk.yellow('Run `pixell --help` to see available commands'))
    process.exit(1)
  }
  if (err.code === 'commander.help') {
    // Allow help to display normally
    process.exit(0)
  }
  throw err
})

// Parse arguments - FIXED
try {
  program.parse()
  
  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp()
    process.exit(0)
  }
} catch (error) {
  // Handle any parsing errors gracefully
  console.error(chalk.red('CLI Error:'), error)
  process.exit(1)
} 