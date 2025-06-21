/*
 * Filesystem CLI Commands for Pixell Agent Framework
 * 
 * Provides comprehensive file system operations within the workspace:
 * - ls: List directory contents
 * - cp: Copy files and directories
 * - mv: Move/rename files and directories
 * - rm: Remove files and directories
 * - mkdir: Create directories
 * - touch: Create empty files
 * - cat: Display file contents
 * - find: Search for files and directories
 * - tree: Display directory structure
 * - du: Show disk usage
 * - stat: Display file information
 * - chmod: Change file permissions (Unix-like systems)
 * - head/tail: Display first/last lines of files
 * - grep: Search within files
 * - zip/unzip: Archive operations (placeholder)
 */

import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import ora from 'ora'
import inquirer from 'inquirer'
import { execSync } from 'child_process'
import { promisify } from 'util'
import { pipeline } from 'stream'
import { createReadStream, createWriteStream } from 'fs'
import * as glob from 'glob'

// Utility types
interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  modified: Date
  permissions: string
  owner?: string
  group?: string
}

interface ListOptions {
  all?: boolean      // Show hidden files
  long?: boolean     // Long format
  human?: boolean    // Human readable sizes
  sort?: 'name' | 'size' | 'date'
  reverse?: boolean  // Reverse sort order
  recursive?: boolean // Recursive listing
}

interface CopyOptions {
  recursive?: boolean
  force?: boolean
  preserve?: boolean
  verbose?: boolean
}

interface RemoveOptions {
  recursive?: boolean
  force?: boolean
  interactive?: boolean
  verbose?: boolean
}

// Get workspace root path
function getWorkspacePath(): string {
  return process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'workspace-files')
}

// Resolve relative paths within workspace
function resolvePath(inputPath: string): string {
  const workspacePath = getWorkspacePath()
  
  if (path.isAbsolute(inputPath)) {
    // Ensure absolute paths are within workspace
    if (!inputPath.startsWith(workspacePath)) {
      throw new Error(`Path must be within workspace: ${workspacePath}`)
    }
    return inputPath
  }
  
  return path.resolve(workspacePath, inputPath)
}

// Format file size in human readable format
function formatSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

// Format file permissions
function formatPermissions(stats: fs.Stats): string {
  const mode = stats.mode
  let perms = ''
  
  // File type
  if (stats.isDirectory()) perms += 'd'
  else if (stats.isSymbolicLink()) perms += 'l'
  else perms += '-'
  
  // Owner permissions
  perms += (mode & 0o400) ? 'r' : '-'
  perms += (mode & 0o200) ? 'w' : '-'
  perms += (mode & 0o100) ? 'x' : '-'
  
  // Group permissions
  perms += (mode & 0o040) ? 'r' : '-'
  perms += (mode & 0o020) ? 'w' : '-'
  perms += (mode & 0o010) ? 'x' : '-'
  
  // Other permissions
  perms += (mode & 0o004) ? 'r' : '-'
  perms += (mode & 0o002) ? 'w' : '-'
  perms += (mode & 0o001) ? 'x' : '-'
  
  return perms
}

// Get file information
async function getFileInfo(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath)
  const name = path.basename(filePath)
  
  return {
    name,
    path: filePath,
    type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
    size: stats.size,
    modified: stats.mtime,
    permissions: formatPermissions(stats)
  }
}

// List directory contents
export async function listFiles(targetPath: string = '.', options: ListOptions = {}) {
  try {
    const fullPath = resolvePath(targetPath)
    
    if (!(await fs.pathExists(fullPath))) {
      console.error(chalk.red(`❌ Path does not exist: ${targetPath}`))
      return
    }
    
    const stats = await fs.stat(fullPath)
    
    if (!stats.isDirectory()) {
      // Show single file info
      const fileInfo = await getFileInfo(fullPath)
      displayFileInfo([fileInfo], options)
      return
    }
    
    let entries = await fs.readdir(fullPath)
    
    // Filter hidden files unless --all
    if (!options.all) {
      entries = entries.filter(entry => !entry.startsWith('.'))
    }
    
    // Get file info for all entries
    const fileInfos: FileInfo[] = []
    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry)
      const info = await getFileInfo(entryPath)
      fileInfos.push(info)
      
      // Recursive listing
      if (options.recursive && info.type === 'directory') {
        console.log(chalk.cyan(`\n${entryPath}:`))
        await listFiles(entryPath, { ...options, recursive: false })
      }
    }
    
    // Sort entries
    sortFileInfos(fileInfos, options)
    
    // Display results
    displayFileInfo(fileInfos, options)
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

function sortFileInfos(fileInfos: FileInfo[], options: ListOptions) {
  const sortFn = {
    name: (a: FileInfo, b: FileInfo) => a.name.localeCompare(b.name),
    size: (a: FileInfo, b: FileInfo) => a.size - b.size,
    date: (a: FileInfo, b: FileInfo) => a.modified.getTime() - b.modified.getTime()
  }[options.sort || 'name']
  
  fileInfos.sort(sortFn)
  
  if (options.reverse) {
    fileInfos.reverse()
  }
}

function displayFileInfo(fileInfos: FileInfo[], options: ListOptions) {
  if (options.long) {
    // Long format display
    const maxSize = Math.max(...fileInfos.map(f => f.size.toString().length))
    
    for (const info of fileInfos) {
      const size = options.human ? formatSize(info.size) : info.size.toString().padStart(maxSize)
      const date = info.modified.toLocaleDateString()
      const time = info.modified.toLocaleTimeString()
      
      let color = chalk.white
      if (info.type === 'directory') color = chalk.blue.bold
      else if (info.type === 'symlink') color = chalk.cyan
      else if (info.permissions.includes('x')) color = chalk.green
      
      console.log(`${info.permissions} ${size} ${date} ${time} ${color(info.name)}`)
    }
  } else {
    // Simple format display
    const columns = process.stdout.columns || 80
    let line = ''
    
    for (const info of fileInfos) {
      let displayName = info.name
      
      // Apply colors
      if (info.type === 'directory') displayName = chalk.blue.bold(displayName)
      else if (info.type === 'symlink') displayName = chalk.cyan(displayName)
      else if (info.permissions.includes('x')) displayName = chalk.green(displayName)
      
      if (line.length + displayName.length + 2 > columns) {
        console.log(line)
        line = displayName + '  '
      } else {
        line += displayName + '  '
      }
    }
    
    if (line.trim()) {
      console.log(line)
    }
  }
}

// Copy files and directories
export async function copyFiles(source: string, destination: string, options: CopyOptions = {}) {
  const spinner = ora('Copying files...').start()
  
  try {
    const sourcePath = resolvePath(source)
    const destPath = resolvePath(destination)
    
    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`Source does not exist: ${source}`)
    }
    
    const sourceStats = await fs.stat(sourcePath)
    
    if (sourceStats.isDirectory() && !options.recursive) {
      throw new Error(`${source} is a directory (use -r for recursive copy)`)
    }
    
    if (await fs.pathExists(destPath) && !options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `Destination exists. Overwrite ${destination}?`,
        default: false
      }])
      
      if (!overwrite) {
        spinner.stop()
        console.log(chalk.yellow('Copy cancelled'))
        return
      }
    }
    
    // Perform copy
    if (sourceStats.isDirectory()) {
      await fs.copy(sourcePath, destPath, {
        overwrite: options.force,
        preserveTimestamps: options.preserve,
        filter: (src, dest) => {
          if (options.verbose) {
            console.log(chalk.gray(`Copying: ${path.relative(sourcePath, src)}`))
          }
          return true
        }
      })
    } else {
      await fs.copy(sourcePath, destPath, {
        overwrite: options.force,
        preserveTimestamps: options.preserve
      })
    }
    
    spinner.succeed(chalk.green(`✅ Copied ${source} to ${destination}`))
    
    if (options.verbose) {
      const copiedStats = await fs.stat(destPath)
      console.log(chalk.gray(`Size: ${formatSize(copiedStats.size)}`))
    }
    
  } catch (error) {
    spinner.fail(chalk.red(`❌ Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Move/rename files and directories
export async function moveFiles(source: string, destination: string, options: { force?: boolean, verbose?: boolean } = {}) {
  const spinner = ora('Moving files...').start()
  
  try {
    const sourcePath = resolvePath(source)
    const destPath = resolvePath(destination)
    
    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`Source does not exist: ${source}`)
    }
    
    if (await fs.pathExists(destPath) && !options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `Destination exists. Overwrite ${destination}?`,
        default: false
      }])
      
      if (!overwrite) {
        spinner.stop()
        console.log(chalk.yellow('Move cancelled'))
        return
      }
    }
    
    await fs.move(sourcePath, destPath, { overwrite: options.force })
    
    spinner.succeed(chalk.green(`✅ Moved ${source} to ${destination}`))
    
    if (options.verbose) {
      const stats = await fs.stat(destPath)
      console.log(chalk.gray(`Size: ${formatSize(stats.size)}`))
    }
    
  } catch (error) {
    spinner.fail(chalk.red(`❌ Move failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Remove files and directories
export async function removeFiles(targets: string[], options: RemoveOptions = {}) {
  if (targets.length === 0) {
    console.error(chalk.red('❌ No files specified'))
    return
  }
  
  const spinner = ora('Removing files...').start()
  
  try {
    for (const target of targets) {
      const targetPath = resolvePath(target)
      
      if (!(await fs.pathExists(targetPath))) {
        console.warn(chalk.yellow(`⚠️ File does not exist: ${target}`))
        continue
      }
      
      const stats = await fs.stat(targetPath)
      
      if (stats.isDirectory() && !options.recursive) {
        throw new Error(`${target} is a directory (use -r for recursive removal)`)
      }
      
      if (options.interactive) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Remove ${target}?`,
          default: false
        }])
        
        if (!confirm) {
          console.log(chalk.yellow(`Skipped: ${target}`))
          continue
        }
      }
      
      await fs.remove(targetPath)
      
      if (options.verbose) {
        console.log(chalk.gray(`Removed: ${target}`))
      }
    }
    
    spinner.succeed(chalk.green(`✅ Removed ${targets.length} item(s)`))
    
  } catch (error) {
    spinner.fail(chalk.red(`❌ Remove failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Create directory
export async function makeDirectory(dirPath: string, options: { parents?: boolean, verbose?: boolean } = {}) {
  try {
    const fullPath = resolvePath(dirPath)
    
    if (await fs.pathExists(fullPath)) {
      console.warn(chalk.yellow(`⚠️ Directory already exists: ${dirPath}`))
      return
    }
    
    if (options.parents) {
      await fs.ensureDir(fullPath)
    } else {
      await fs.mkdir(fullPath)
    }
    
    console.log(chalk.green(`✅ Created directory: ${dirPath}`))
    
    if (options.verbose) {
      const stats = await fs.stat(fullPath)
      console.log(chalk.gray(`Permissions: ${formatPermissions(stats)}`))
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Create empty file (touch)
export async function touchFile(filePath: string, options: { verbose?: boolean } = {}) {
  try {
    const fullPath = resolvePath(filePath)
    
    if (await fs.pathExists(fullPath)) {
      // Update timestamp
      const now = new Date()
      await fs.utimes(fullPath, now, now)
      console.log(chalk.blue(`📅 Updated timestamp: ${filePath}`))
    } else {
      // Create empty file
      await fs.ensureFile(fullPath)
      console.log(chalk.green(`✅ Created file: ${filePath}`))
    }
    
    if (options.verbose) {
      const stats = await fs.stat(fullPath)
      console.log(chalk.gray(`Size: ${formatSize(stats.size)}`))
      console.log(chalk.gray(`Modified: ${stats.mtime.toLocaleString()}`))
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to touch file: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Display file contents
export async function catFile(filePaths: string[], options: { numbered?: boolean, showEnds?: boolean } = {}) {
  try {
    for (const filePath of filePaths) {
      const fullPath = resolvePath(filePath)
      
      if (!(await fs.pathExists(fullPath))) {
        console.error(chalk.red(`❌ File does not exist: ${filePath}`))
        continue
      }
      
      const stats = await fs.stat(fullPath)
      
      if (stats.isDirectory()) {
        console.error(chalk.red(`❌ ${filePath} is a directory`))
        continue
      }
      
      if (filePaths.length > 1) {
        console.log(chalk.cyan(`\n==> ${filePath} <==`))
      }
      
      const content = await fs.readFile(fullPath, 'utf-8')
      const lines = content.split('\n')
      
      lines.forEach((line, index) => {
        let output = line
        
        if (options.showEnds) {
          output = line + '$'
        }
        
        if (options.numbered) {
          const lineNumber = (index + 1).toString().padStart(6)
          output = `${chalk.gray(lineNumber)}  ${output}`
        }
        
        console.log(output)
      })
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Display first lines of file
export async function headFile(filePath: string, options: { lines?: number } = {}) {
  try {
    const fullPath = resolvePath(filePath)
    
    if (!(await fs.pathExists(fullPath))) {
      console.error(chalk.red(`❌ File does not exist: ${filePath}`))
      return
    }
    
    const content = await fs.readFile(fullPath, 'utf-8')
    const lines = content.split('\n')
    const numLines = options.lines || 10
    
    lines.slice(0, numLines).forEach(line => console.log(line))
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Display last lines of file
export async function tailFile(filePath: string, options: { lines?: number, follow?: boolean } = {}) {
  try {
    const fullPath = resolvePath(filePath)
    
    if (!(await fs.pathExists(fullPath))) {
      console.error(chalk.red(`❌ File does not exist: ${filePath}`))
      return
    }
    
    const content = await fs.readFile(fullPath, 'utf-8')
    const lines = content.split('\n')
    const numLines = options.lines || 10
    
    lines.slice(-numLines).forEach(line => console.log(line))
    
    if (options.follow) {
      console.log(chalk.gray('Following file... (Ctrl+C to exit)'))
      // Note: In a real implementation, you'd use fs.watchFile or similar
      // to continuously monitor the file for changes
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Search for files
export async function findFiles(pattern: string, searchPath: string = '.', options: { type?: 'f' | 'd', name?: boolean } = {}) {
  try {
    const fullSearchPath = resolvePath(searchPath)
    
    let globPattern: string
    if (options.name) {
      globPattern = `**/*${pattern}*`
    } else {
      globPattern = pattern
    }
    
    const matches = glob.sync(globPattern, {
      cwd: fullSearchPath,
      absolute: false,
      dot: false
    })
    
    for (const match of matches) {
      const matchPath = path.join(fullSearchPath, match)
      const stats = await fs.stat(matchPath)
      
      // Filter by type if specified
      if (options.type === 'f' && !stats.isFile()) continue
      if (options.type === 'd' && !stats.isDirectory()) continue
      
      let displayPath = path.relative(getWorkspacePath(), matchPath)
      if (displayPath.startsWith('..')) {
        displayPath = matchPath
      }
      
      if (stats.isDirectory()) {
        console.log(chalk.blue(displayPath))
      } else {
        console.log(displayPath)
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Find failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Search within files
export async function grepFiles(pattern: string, filePaths: string[], options: { ignoreCase?: boolean, lineNumbers?: boolean, recursive?: boolean } = {}) {
  try {
    const results: Array<{ file: string, line: number, content: string }> = []
    
    for (const filePath of filePaths) {
      const fullPath = resolvePath(filePath)
      
      if (!(await fs.pathExists(fullPath))) {
        console.error(chalk.red(`❌ File does not exist: ${filePath}`))
        continue
      }
      
      const stats = await fs.stat(fullPath)
      
      if (stats.isDirectory() && options.recursive) {
        const dirFiles = await fs.readdir(fullPath)
        const subFiles = dirFiles.map(f => path.join(filePath, f))
        await grepFiles(pattern, subFiles, options)
        continue
      }
      
      if (!stats.isFile()) continue
      
      const content = await fs.readFile(fullPath, 'utf-8')
      const lines = content.split('\n')
      
      const regex = new RegExp(pattern, options.ignoreCase ? 'gi' : 'g')
      
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          results.push({
            file: filePath,
            line: index + 1,
            content: line.trim()
          })
        }
      })
    }
    
    // Display results
    for (const result of results) {
      let output = `${chalk.cyan(result.file)}`
      
      if (options.lineNumbers) {
        output += `:${chalk.yellow(result.line)}`
      }
      
      output += `: ${result.content}`
      console.log(output)
    }
    
    if (results.length === 0) {
      console.log(chalk.gray('No matches found'))
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Grep failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Show disk usage
export async function diskUsage(targetPath: string = '.', options: { human?: boolean, summarize?: boolean } = {}) {
  try {
    const fullPath = resolvePath(targetPath)
    
    if (!(await fs.pathExists(fullPath))) {
      console.error(chalk.red(`❌ Path does not exist: ${targetPath}`))
      return
    }
    
    const calculateSize = async (dirPath: string): Promise<number> => {
      const stats = await fs.stat(dirPath)
      
      if (stats.isFile()) {
        return stats.size
      }
      
      if (stats.isDirectory()) {
        const entries = await fs.readdir(dirPath)
        let totalSize = 0
        
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry)
          totalSize += await calculateSize(entryPath)
        }
        
        return totalSize
      }
      
      return 0
    }
    
    const totalSize = await calculateSize(fullPath)
    const formattedSize = options.human ? formatSize(totalSize) : totalSize.toString()
    
    if (options.summarize) {
      console.log(`${formattedSize}\t${targetPath}`)
    } else {
      console.log(chalk.green(`Total size of ${targetPath}: ${formattedSize}`))
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Disk usage calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Show file statistics
export async function statFile(filePath: string) {
  try {
    const fullPath = resolvePath(filePath)
    
    if (!(await fs.pathExists(fullPath))) {
      console.error(chalk.red(`❌ File does not exist: ${filePath}`))
      return
    }
    
    const stats = await fs.stat(fullPath)
    
    console.log(chalk.cyan(`File: ${filePath}`))
    console.log(`Size: ${chalk.white(formatSize(stats.size))} (${stats.size} bytes)`)
    console.log(`Type: ${chalk.white(stats.isDirectory() ? 'directory' : stats.isFile() ? 'regular file' : 'other')}`)
    console.log(`Permissions: ${chalk.white(formatPermissions(stats))}`)
    console.log(`Modified: ${chalk.white(stats.mtime.toLocaleString())}`)
    console.log(`Accessed: ${chalk.white(stats.atime.toLocaleString())}`)
    console.log(`Created: ${chalk.white(stats.birthtime.toLocaleString())}`)
    
    if (stats.isFile()) {
      console.log(`Inode: ${chalk.white(stats.ino)}`)
      console.log(`Links: ${chalk.white(stats.nlink)}`)
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Display directory tree
export async function showTree(targetPath: string = '.', options: { maxDepth?: number, showFiles?: boolean } = {}) {
  try {
    const fullPath = resolvePath(targetPath)
    
    if (!(await fs.pathExists(fullPath))) {
      console.error(chalk.red(`❌ Path does not exist: ${targetPath}`))
      return
    }
    
    const displayTree = async (dirPath: string, prefix: string = '', depth: number = 0): Promise<void> => {
      if (options.maxDepth && depth > options.maxDepth) return
      
      const entries = await fs.readdir(dirPath)
      const sorted = entries.sort()
      
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i]
        const entryPath = path.join(dirPath, entry)
        const isLast = i === sorted.length - 1
        const stats = await fs.stat(entryPath)
        
        if (!options.showFiles && stats.isFile()) continue
        
        const connector = isLast ? '└── ' : '├── '
        const newPrefix = isLast ? '    ' : '│   '
        
        let displayName = entry
        if (stats.isDirectory()) {
          displayName = chalk.blue.bold(displayName)
        } else if (stats.isSymbolicLink()) {
          displayName = chalk.cyan(displayName)
        }
        
        console.log(prefix + connector + displayName)
        
        if (stats.isDirectory()) {
          await displayTree(entryPath, prefix + newPrefix, depth + 1)
        }
      }
    }
    
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      console.log(chalk.blue.bold(path.basename(fullPath)))
      await displayTree(fullPath)
    } else {
      console.log(path.basename(fullPath))
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Tree display failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
}

// Create zip archive (placeholder - requires archiver dependency)
export async function zipFiles(archiveName: string, filePaths: string[], options: { compression?: number, verbose?: boolean } = {}) {
  console.log(chalk.yellow('⚠️ Zip functionality not yet implemented'))
  console.log(chalk.gray('This feature requires additional dependencies (archiver)'))
  console.log(chalk.gray('Use system zip command for now: zip -r archive.zip files/'))
}

// Extract zip archive (placeholder - requires unzipper dependency)
export async function unzipFiles(archivePath: string, extractPath: string = '.', options: { verbose?: boolean } = {}) {
  console.log(chalk.yellow('⚠️ Unzip functionality not yet implemented'))
  console.log(chalk.gray('This feature requires additional dependencies (unzipper)'))
  console.log(chalk.gray('Use system unzip command for now: unzip archive.zip'))
}

// Change file permissions (Unix-like systems only)
export async function changeMode(mode: string, filePaths: string[], options: { recursive?: boolean, verbose?: boolean } = {}) {
  try {
    const octalMode = parseInt(mode, 8)
    
    if (isNaN(octalMode)) {
      throw new Error(`Invalid mode: ${mode}`)
    }
    
    for (const filePath of filePaths) {
      const fullPath = resolvePath(filePath)
      
      if (!(await fs.pathExists(fullPath))) {
        console.error(chalk.red(`❌ File does not exist: ${filePath}`))
        continue
      }
      
      const changeModeRecursive = async (targetPath: string) => {
        await fs.chmod(targetPath, octalMode)
        
        if (options.verbose) {
          console.log(chalk.gray(`Changed mode: ${targetPath}`))
        }
        
        if (options.recursive) {
          const stats = await fs.stat(targetPath)
          if (stats.isDirectory()) {
            const entries = await fs.readdir(targetPath)
            for (const entry of entries) {
              await changeModeRecursive(path.join(targetPath, entry))
            }
          }
        }
      }
      
      await changeModeRecursive(fullPath)
    }
    
    console.log(chalk.green(`✅ Changed permissions for ${filePaths.length} item(s)`))
    
  } catch (error) {
    console.error(chalk.red(`❌ Chmod failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
  }
} 