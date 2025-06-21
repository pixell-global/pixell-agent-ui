# Pixell CLI - Filesystem Commands

The Pixell CLI includes comprehensive filesystem management commands that work within your agent workspace. These commands provide Unix-like functionality for file operations, making it easy to manage files and directories directly from the command line.

## Overview

All filesystem commands operate within the **workspace directory** (typically `workspace-files/` or as configured in your environment). This ensures security and keeps all agent-related files organized in one location.

## Quick Reference

| Command | Description | Common Options |
|---------|-------------|----------------|
| `pixell ls [path]` | List directory contents | `-l` (long), `-a` (all), `-h` (human) |
| `pixell cp <src> <dst>` | Copy files/directories | `-r` (recursive), `-v` (verbose) |
| `pixell mv <src> <dst>` | Move/rename files | `-f` (force), `-v` (verbose) |
| `pixell rm <files...>` | Remove files/directories | `-r` (recursive), `-i` (interactive) |
| `pixell mkdir <dir>` | Create directory | `-p` (parents) |
| `pixell touch <file>` | Create file/update timestamp | `-v` (verbose) |
| `pixell cat <files...>` | Display file contents | `-n` (number lines) |
| `pixell head <file>` | Show first lines | `-n <num>` (line count) |
| `pixell tail <file>` | Show last lines | `-f` (follow) |
| `pixell find <pattern>` | Search for files | `-type f/d`, `-name` |
| `pixell grep <pattern>` | Search within files | `-i` (ignore case), `-r` (recursive) |
| `pixell tree [path]` | Display directory tree | `-L <depth>`, `-a` (all files) |
| `pixell stat <file>` | Show file statistics | |
| `pixell du [path]` | Display disk usage | `-h` (human), `-s` (summarize) |
| `pixell chmod <mode>` | Change permissions | `-R` (recursive) |

## Detailed Command Reference

### File Listing: `pixell ls [path]`

```bash
# Basic listing
pixell ls

# Long format with details
pixell ls -l

# Show hidden files  
pixell ls -a

# Human-readable sizes
pixell ls -lh

# Sort by time/size
pixell ls -lt  # by time
pixell ls -lS  # by size

# Recursive listing
pixell ls -R documents/
```

### File Operations

#### Copy: `pixell cp <source> <destination>`

```bash
# Copy file
pixell cp document.txt backup.txt

# Copy directory recursively
pixell cp -r project/ project-backup/

# Preserve timestamps and permissions
pixell cp -p important.log archive/

# Verbose output
pixell cp -rv src/ backup/
```

#### Move/Rename: `pixell mv <source> <destination>`

```bash
# Rename file
pixell mv oldname.txt newname.txt

# Move to directory
pixell mv file.txt documents/

# Force overwrite
pixell mv -f source.txt destination.txt
```

#### Remove: `pixell rm <files...>`

```bash
# Remove file
pixell rm document.txt

# Remove directory
pixell rm -r old-project/

# Interactive removal
pixell rm -i *.tmp

# Force removal
pixell rm -rf temp/
```

### Directory Operations

#### Create: `pixell mkdir <directory>`

```bash
# Create directory
pixell mkdir new-project

# Create nested paths
pixell mkdir -p project/src/components
```

#### Tree View: `pixell tree [path]`

```bash
# Show directory tree
pixell tree

# Limit depth
pixell tree -L 2

# Include files
pixell tree -a
```

### File Content Commands

#### Display: `pixell cat <files...>`

```bash
# Show file content
pixell cat README.md

# Multiple files
pixell cat file1.txt file2.txt

# Number lines
pixell cat -n script.js
```

#### Head/Tail: View Parts of Files

```bash
# First 10 lines
pixell head logfile.txt

# First 20 lines
pixell head -n 20 data.csv

# Last 10 lines
pixell tail access.log

# Follow file (like tail -f)
pixell tail -f application.log
```

### Search Operations

#### Find Files: `pixell find <pattern> [path]`

```bash
# Find by name pattern
pixell find "*.js"

# Find in specific directory
pixell find "config" src/

# Files only
pixell find "*.txt" -type f

# Directories only
pixell find "test" -type d
```

#### Search Content: `pixell grep <pattern> <files...>`

```bash
# Search in file
pixell grep "function" script.js

# Case-insensitive
pixell grep -i "error" logs/*.txt

# Show line numbers
pixell grep -n "TODO" src/*.js

# Recursive search
pixell grep -r "config" project/
```

### File Information

#### Statistics: `pixell stat <file>`

```bash
# Show detailed file info
pixell stat document.txt
```

Output includes:
- File size (bytes and human-readable)
- File type and permissions
- Timestamps (created, modified, accessed)
- Inode and link information

#### Disk Usage: `pixell du [path]`

```bash
# Current directory usage
pixell du

# Human-readable format
pixell du -h

# Summarize directories
pixell du -sh project/ documents/
```

### File Permissions

#### Change Mode: `pixell chmod <mode> <files...>`

```bash
# Set permissions (octal)
pixell chmod 755 script.sh

# Recursive change
pixell chmod -R 644 documents/

# Common modes:
pixell chmod 755 executable  # rwxr-xr-x
pixell chmod 644 file.txt    # rw-r--r--
pixell chmod 600 private.key # rw-------
```

### Utility Commands

#### Touch: `pixell touch <file>`

```bash
# Create empty file
pixell touch newfile.txt

# Update timestamp
pixell touch existing-file.txt
```

## Practical Examples

### Project Setup

```bash
# Create project structure
pixell mkdir -p myapp/{src,docs,tests,config}
pixell touch myapp/README.md
pixell touch myapp/src/index.js
pixell touch myapp/config/app.json

# View structure
pixell tree myapp/
```

### Development Workflow

```bash
# Find all TypeScript files
pixell find "*.ts" src/

# Search for TODOs
pixell grep -rn "TODO" src/

# Check large files
pixell du -h src/ | sort -rh | head -10

# Monitor log file
pixell tail -f logs/debug.log
```

### File Management

```bash
# Backup important files
pixell cp -r src/ backup/src-$(date +%Y%m%d)/

# Clean temporary files
pixell find "*.tmp" -type f
pixell rm *.tmp *.log

# Organize by date
pixell mkdir -p archive/$(date +%Y/%m)
pixell mv old-files/ archive/$(date +%Y/%m)/
```

### Code Analysis

```bash
# Find configuration files
pixell find "*config*" -type f

# Search for specific patterns
pixell grep -i "password\|secret\|key" config/

# Check file permissions
pixell ls -la scripts/
pixell chmod +x scripts/*.sh
```

## Advanced Usage Tips

### Combining Commands

```bash
# Find and examine files
pixell find "*.log" -type f | head -5
pixell stat $(pixell find "*.json" -type f | head -1)

# Search and count
pixell grep -r "function" src/ | wc -l

# Size analysis
pixell du -sh */ | sort -rh
```

### Useful Aliases

Consider creating shell aliases for common operations:

```bash
# Add to your shell profile (.bashrc, .zshrc)
alias pls='pixell ls -la'
alias ptree='pixell tree -L 3'
alias pfind='pixell find'
alias pgrep='pixell grep -rn'
```

### Safety Practices

1. **Preview before action**: Use `ls` or `find` to see what files match before `rm`
2. **Use interactive mode**: Add `-i` flag for destructive operations
3. **Test with small sets**: Try commands on a few files before bulk operations
4. **Check paths**: Verify you're in the right directory with `pixell ls`
5. **Backup important data**: Copy critical files before major changes

### Performance Tips

1. **Limit search scope**: Specify directories in `find` and `grep`
2. **Use appropriate tools**: `head`/`tail` for large files instead of `cat`
3. **Filter early**: Combine options to reduce output volume
4. **Monitor resources**: Use `du` to check disk usage regularly

## Error Handling

Common error scenarios and solutions:

- **Permission denied**: Check file permissions with `stat`, fix with `chmod`
- **File not found**: Use `find` to locate files, check spelling
- **Directory not empty**: Use `rm -r` for recursive removal
- **Path too long**: Use relative paths or navigate closer to target

All filesystem commands include proper error handling with clear, helpful error messages to guide you toward the correct usage.

This comprehensive filesystem toolkit makes the Pixell CLI a powerful environment for managing your agent workspace files efficiently and safely. 