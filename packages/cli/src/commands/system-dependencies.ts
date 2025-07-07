import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync } from 'child_process'
import execa from 'execa'
import os from 'os'

/**
 * System Dependencies Checker and Installer
 * Comprehensive checking and installation of all required system dependencies
 */

interface DependencyStatus {
  name: string
  installed: boolean
  version?: string
  required: boolean
  installCommand?: string
  checkCommand: string
  description: string
}

interface SystemRequirements {
  docker: DependencyStatus
  python3: DependencyStatus
  git: DependencyStatus
  node: DependencyStatus
  npm: DependencyStatus
  curl: DependencyStatus
}

/**
 * Check all system dependencies
 */
export async function checkSystemDependencies(): Promise<SystemRequirements> {
  console.log(chalk.blue.bold('\n🔍 CHECKING SYSTEM DEPENDENCIES'))
  console.log(chalk.blue('='.repeat(50)))
  
  const requirements: SystemRequirements = {
    docker: {
      name: 'Docker',
      installed: false,
      required: true,
      checkCommand: 'docker --version',
      description: 'Required for running Supabase and PAF Core Agent services'
    },
    python3: {
      name: 'Python 3.11+',
      installed: false,
      required: true,
      checkCommand: 'python3 --version',
      description: 'Required for PAF Core Agent development and virtual environments'
    },
    git: {
      name: 'Git',
      installed: false,
      required: true,
      checkCommand: 'git --version',
      description: 'Required for cloning PAF Core Agent repository'
    },
    node: {
      name: 'Node.js 18.18.0+',
      installed: false,
      required: true,
      checkCommand: 'node --version',
      description: 'Required for the Pixell framework'
    },
    npm: {
      name: 'npm 10.5.0+',
      installed: false,
      required: true,
      checkCommand: 'npm --version',
      description: 'Required for package management'
    },
    curl: {
      name: 'curl',
      installed: false,
      required: false,
      checkCommand: 'curl --version',
      description: 'Required for health checks and downloading dependencies'
    }
  }
  
  // Check each dependency
  for (const [key, dep] of Object.entries(requirements)) {
    const result = await checkSingleDependency(dep)
    requirements[key as keyof SystemRequirements] = result
  }
  
  // Display results
  displayDependencyResults(requirements)
  
  return requirements
}

/**
 * Ensure all required dependencies are installed
 */
export async function ensureSystemDependencies(): Promise<void> {
  const requirements = await checkSystemDependencies()
  
  // Check if any required dependencies are missing
  const missing = Object.values(requirements).filter(dep => dep.required && !dep.installed)
  
  if (missing.length === 0) {
    console.log(chalk.green('\n✅ All required dependencies are installed!'))
    return
  }
  
  console.log(chalk.yellow(`\n⚠️ Missing ${missing.length} required dependencies:`))
  missing.forEach(dep => {
    console.log(chalk.red(`   ❌ ${dep.name}: ${dep.description}`))
  })
  
  // Ask user if they want to install missing dependencies
  const shouldInstall = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'install',
      message: 'Would you like to install missing dependencies automatically?',
      default: true
    }
  ])
  
  if (!shouldInstall.install) {
    console.log(chalk.yellow('\n⚠️ Setup cannot continue without required dependencies.'))
    console.log(chalk.blue('\n📋 Manual installation instructions:'))
    missing.forEach(dep => {
      console.log(chalk.white(`\n${dep.name}:`))
      console.log(chalk.gray(`   ${dep.description}`))
      if (dep.installCommand) {
        console.log(chalk.cyan(`   Install: ${dep.installCommand}`))
      } else {
        showManualInstallInstructions(dep.name)
      }
    })
    throw new Error('Required dependencies missing')
  }
  
  // Install missing dependencies
  for (const dep of missing) {
    await installDependency(dep)
  }
  
  // Re-check after installation
  console.log(chalk.blue('\n🔄 Re-checking dependencies after installation...'))
  const recheckResults = await checkSystemDependencies()
  
  const stillMissing = Object.values(recheckResults).filter(dep => dep.required && !dep.installed)
  if (stillMissing.length > 0) {
    console.log(chalk.red('\n❌ Some dependencies could not be installed automatically:'))
    stillMissing.forEach(dep => {
      console.log(chalk.red(`   ❌ ${dep.name}`))
    })
    throw new Error('Failed to install all required dependencies')
  }
  
  console.log(chalk.green('\n🎉 All dependencies successfully installed!'))
}

/**
 * Check if Docker is installed and running
 */
export async function checkDockerStatus(): Promise<{
  installed: boolean
  running: boolean
  version?: string
}> {
  const spinner = ora('🐳 Checking Docker status...').start()
  
  try {
    // Check if Docker is installed
    const versionResult = await execa('docker', ['--version'])
    const installed = true
    const version = versionResult.stdout.trim()
    
    // Check if Docker is running
    try {
      await execa('docker', ['ps'])
      spinner.succeed('✅ Docker is installed and running')
      return { installed, running: true, version }
    } catch {
      spinner.warn('⚠️ Docker is installed but not running')
      return { installed, running: false, version }
    }
    
  } catch {
    spinner.fail('❌ Docker is not installed')
    return { installed: false, running: false }
  }
}

/**
 * Ensure Docker is installed and running
 */
export async function ensureDockerRunning(): Promise<void> {
  const status = await checkDockerStatus()
  
  if (!status.installed) {
    console.log(chalk.yellow('\n🐳 Docker is required but not installed'))
    
    const shouldInstall = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'Install Docker automatically?',
        default: true
      }
    ])
    
    if (shouldInstall.install) {
      await installDocker()
      // Re-check status after installation
      const newStatus = await checkDockerStatus()
      if (!newStatus.installed) {
        throw new Error('Docker installation failed')
      }
    } else {
      showManualInstallInstructions('Docker')
      throw new Error('Docker is required for setup')
    }
  }
  
  if (!status.running) {
    console.log(chalk.yellow('\n🐳 Docker is installed but not running'))
    
    const shouldStart = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'start',
        message: 'Start Docker now?',
        default: true
      }
    ])
    
    if (shouldStart.start) {
      await startDocker()
      
      // Wait and re-check
      console.log(chalk.gray('⏳ Waiting for Docker to start...'))
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      const newStatus = await checkDockerStatus()
      if (!newStatus.running) {
        console.log(chalk.yellow('⚠️ Docker may still be starting. Please wait and try again.'))
        throw new Error('Docker failed to start')
      }
    } else {
      console.log(chalk.yellow('\n💡 Please start Docker manually and try again'))
      showDockerStartInstructions()
      throw new Error('Docker is not running')
    }
  }
  
  console.log(chalk.green('✅ Docker is ready!'))
}

/**
 * Check Python installation and venv support
 */
export async function checkPythonEnvironment(): Promise<{
  python3Available: boolean
  venvSupported: boolean
  version?: string
}> {
  const spinner = ora('🐍 Checking Python environment...').start()
  
  try {
    // Check Python 3 installation
    const versionResult = await execa('python3', ['--version'])
    const version = versionResult.stdout.trim()
    
    // Extract version number and check if it's 3.11+
    const versionMatch = version.match(/Python (\d+)\.(\d+)\.(\d+)/)
    if (!versionMatch) {
      spinner.fail('❌ Could not determine Python version')
      return { python3Available: false, venvSupported: false }
    }
    
    const [, major, minor] = versionMatch
    const majorVersion = parseInt(major)
    const minorVersion = parseInt(minor)
    
    if (majorVersion < 3 || (majorVersion === 3 && minorVersion < 11)) {
      spinner.fail(`❌ Python ${majorVersion}.${minorVersion} found, but 3.11+ is required`)
      return { python3Available: false, venvSupported: false, version }
    }
    
    // Check venv support
    try {
      await execa('python3', ['-m', 'venv', '--help'])
      spinner.succeed(`✅ Python ${version} with venv support`)
      return { python3Available: true, venvSupported: true, version }
    } catch {
      spinner.fail('❌ Python venv module not available')
      return { python3Available: true, venvSupported: false, version }
    }
    
  } catch {
    spinner.fail('❌ Python 3 not found')
    return { python3Available: false, venvSupported: false }
  }
}

/**
 * Helper functions
 */

async function checkSingleDependency(dep: DependencyStatus): Promise<DependencyStatus> {
  try {
    const result = await execa.command(dep.checkCommand)
    return {
      ...dep,
      installed: true,
      version: result.stdout.split('\n')[0].trim()
    }
  } catch {
    return {
      ...dep,
      installed: false
    }
  }
}

function displayDependencyResults(requirements: SystemRequirements): void {
  console.log(chalk.blue('\n📋 Dependency Check Results:'))
  
  Object.values(requirements).forEach(dep => {
    const icon = dep.installed ? '✅' : (dep.required ? '❌' : '⚠️')
    const status = dep.installed ? chalk.green('Installed') : chalk.red('Missing')
    const required = dep.required ? chalk.red('(Required)') : chalk.gray('(Optional)')
    
    console.log(`   ${icon} ${dep.name}: ${status} ${required}`)
    if (dep.installed && dep.version) {
      console.log(chalk.gray(`      Version: ${dep.version}`))
    }
    if (!dep.installed && dep.required) {
      console.log(chalk.gray(`      ${dep.description}`))
    }
  })
}

async function installDependency(dep: DependencyStatus): Promise<void> {
  const spinner = ora(`📦 Installing ${dep.name}...`).start()
  
  try {
    switch (dep.name) {
      case 'Docker':
        await installDocker()
        break
      case 'Python 3.11+':
        await installPython()
        break
      case 'Git':
        await installGit()
        break
      case 'curl':
        await installCurl()
        break
      default:
        spinner.fail(`❌ Automatic installation not supported for ${dep.name}`)
        return
    }
    
    spinner.succeed(`✅ ${dep.name} installed successfully`)
    
  } catch (error) {
    spinner.fail(`❌ Failed to install ${dep.name}`)
    console.log(chalk.yellow(`💡 Please install ${dep.name} manually`))
    showManualInstallInstructions(dep.name)
  }
}

async function installDocker(): Promise<void> {
  const platform = os.platform()
  
  switch (platform) {
    case 'darwin':
      await installDockerMac()
      break
    case 'win32':
      await installDockerWindows()
      break
    case 'linux':
      await installDockerLinux()
      break
    default:
      throw new Error(`Docker auto-installation not supported on ${platform}`)
  }
}

async function installDockerMac(): Promise<void> {
  try {
    // Try Homebrew first
    await execa('brew', ['--version'])
    await execa('brew', ['install', '--cask', 'docker'])
  } catch {
    // Fallback to direct download
    console.log(chalk.blue('📥 Downloading Docker Desktop for macOS...'))
    const arch = os.arch()
    const downloadUrl = arch === 'arm64' 
      ? 'https://desktop.docker.com/mac/main/arm64/Docker.dmg'
      : 'https://desktop.docker.com/mac/main/amd64/Docker.dmg'
    
    await execa('curl', ['-L', '-o', '/tmp/Docker.dmg', downloadUrl])
    console.log(chalk.yellow('⚠️ Please complete installation manually:'))
    console.log(chalk.gray('   1. Open /tmp/Docker.dmg'))
    console.log(chalk.gray('   2. Drag Docker to Applications'))
    console.log(chalk.gray('   3. Start Docker Desktop'))
  }
}

async function installDockerWindows(): Promise<void> {
  try {
    // Try Chocolatey first
    await execa('choco', ['--version'])
    await execa('choco', ['install', 'docker-desktop', '-y'])
  } catch {
    console.log(chalk.blue('📥 Please download Docker Desktop for Windows:'))
    console.log(chalk.cyan('https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'))
    throw new Error('Manual installation required')
  }
}

async function installDockerLinux(): Promise<void> {
  // Use Docker's convenience script
  await execa('curl', ['-fsSL', 'https://get.docker.com', '-o', '/tmp/get-docker.sh'])
  await execa('sudo', ['sh', '/tmp/get-docker.sh'])
  
  // Post-installation setup
  await execa('sudo', ['systemctl', 'start', 'docker'])
  await execa('sudo', ['systemctl', 'enable', 'docker'])
  
  try {
    const user = process.env.USER || 'user'
    await execa('sudo', ['usermod', '-aG', 'docker', user])
    console.log(chalk.yellow('⚠️ Please log out and log back in for Docker permissions to take effect'))
  } catch {
    // Non-critical
  }
}

async function installPython(): Promise<void> {
  const platform = os.platform()
  
  switch (platform) {
    case 'darwin':
      try {
        await execa('brew', ['--version'])
        await execa('brew', ['install', 'python@3.11'])
      } catch {
        console.log(chalk.yellow('💡 Please install Python 3.11+ manually:'))
        console.log(chalk.cyan('https://www.python.org/downloads/'))
        throw new Error('Manual installation required')
      }
      break
    case 'linux':
      await installPythonLinux()
      break
    default:
      console.log(chalk.yellow('💡 Please install Python 3.11+ manually:'))
      console.log(chalk.cyan('https://www.python.org/downloads/'))
      throw new Error('Manual installation required')
  }
}

async function installPythonLinux(): Promise<void> {
  try {
    // Try to detect Linux distribution
    const releaseInfo = execSync('cat /etc/os-release', { encoding: 'utf-8' })
    
    if (releaseInfo.includes('Ubuntu') || releaseInfo.includes('Debian')) {
      await execa('sudo', ['apt', 'update'])
      await execa('sudo', ['apt', 'install', '-y', 'python3.11', 'python3.11-venv', 'python3-pip'])
    } else if (releaseInfo.includes('CentOS') || releaseInfo.includes('RHEL') || releaseInfo.includes('Fedora')) {
      await execa('sudo', ['yum', 'install', '-y', 'python311', 'python311-pip'])
    } else {
      throw new Error('Unsupported Linux distribution')
    }
  } catch {
    console.log(chalk.yellow('💡 Please install Python 3.11+ using your distribution\'s package manager'))
    throw new Error('Manual installation required')
  }
}

async function installGit(): Promise<void> {
  const platform = os.platform()
  
  switch (platform) {
    case 'darwin':
      await execa('xcode-select', ['--install'])
      break
    case 'linux':
      await installGitLinux()
      break
    case 'win32':
      console.log(chalk.blue('📥 Please download Git for Windows:'))
      console.log(chalk.cyan('https://git-scm.com/download/win'))
      throw new Error('Manual installation required')
      break
    default:
      throw new Error(`Git auto-installation not supported on ${platform}`)
  }
}

async function installGitLinux(): Promise<void> {
  try {
    const releaseInfo = execSync('cat /etc/os-release', { encoding: 'utf-8' })
    
    if (releaseInfo.includes('Ubuntu') || releaseInfo.includes('Debian')) {
      await execa('sudo', ['apt', 'update'])
      await execa('sudo', ['apt', 'install', '-y', 'git'])
    } else if (releaseInfo.includes('CentOS') || releaseInfo.includes('RHEL') || releaseInfo.includes('Fedora')) {
      await execa('sudo', ['yum', 'install', '-y', 'git'])
    } else {
      throw new Error('Unsupported Linux distribution')
    }
  } catch {
    throw new Error('Failed to install Git')
  }
}

async function installCurl(): Promise<void> {
  const platform = os.platform()
  
  switch (platform) {
    case 'darwin':
      // curl is usually pre-installed on macOS
      console.log(chalk.yellow('curl should be pre-installed on macOS'))
      break
    case 'linux':
      const releaseInfo = execSync('cat /etc/os-release', { encoding: 'utf-8' })
      
      if (releaseInfo.includes('Ubuntu') || releaseInfo.includes('Debian')) {
        await execa('sudo', ['apt', 'update'])
        await execa('sudo', ['apt', 'install', '-y', 'curl'])
      } else if (releaseInfo.includes('CentOS') || releaseInfo.includes('RHEL') || releaseInfo.includes('Fedora')) {
        await execa('sudo', ['yum', 'install', '-y', 'curl'])
      }
      break
    default:
      console.log(chalk.yellow('curl should be available on most systems'))
  }
}

async function startDocker(): Promise<void> {
  const platform = os.platform()
  
  if (platform === 'darwin') {
    await execa('open', ['-a', 'Docker'])
  } else if (platform === 'win32') {
    await execa('powershell', ['-Command', 'Start-Process "Docker Desktop"'])
  } else {
    // Linux
    try {
      await execa('sudo', ['systemctl', 'start', 'docker'])
    } catch {
      await execa('sudo', ['service', 'docker', 'start'])
    }
  }
}

function showManualInstallInstructions(depName: string): void {
  const platform = os.platform()
  
  console.log(chalk.blue(`\n📋 Manual ${depName} Installation:`))
  
  switch (depName) {
    case 'Docker':
      if (platform === 'darwin') {
        console.log(chalk.cyan('• Download: https://desktop.docker.com/mac/main/arm64/Docker.dmg (Apple Silicon)'))
        console.log(chalk.cyan('• Download: https://desktop.docker.com/mac/main/amd64/Docker.dmg (Intel)'))
        console.log(chalk.gray('• Or: brew install --cask docker'))
      } else if (platform === 'win32') {
        console.log(chalk.cyan('• Download: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'))
        console.log(chalk.gray('• Or: choco install docker-desktop'))
      } else {
        console.log(chalk.cyan('• curl -fsSL https://get.docker.com | sh'))
        console.log(chalk.gray('• sudo systemctl start docker'))
      }
      break
    case 'Python 3.11+':
      console.log(chalk.cyan('• Download: https://www.python.org/downloads/'))
      console.log(chalk.gray('• Make sure to install Python 3.11 or higher'))
      console.log(chalk.gray('• Ensure venv module is included'))
      break
    case 'Git':
      console.log(chalk.cyan('• Download: https://git-scm.com/downloads'))
      break
    default:
      console.log(chalk.gray(`• Please install ${depName} using your system's package manager`))
  }
}

function showDockerStartInstructions(): void {
  const platform = os.platform()
  
  console.log(chalk.blue('\n🐳 Start Docker manually:'))
  
  if (platform === 'darwin' || platform === 'win32') {
    console.log(chalk.white('• Open Docker Desktop from Applications/Start menu'))
    console.log(chalk.white('• Wait for the whale icon to appear in the system tray'))
  } else {
    console.log(chalk.white('• sudo systemctl start docker'))
    console.log(chalk.white('• sudo service docker start'))
  }
}