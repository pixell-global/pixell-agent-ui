# File Mention Feature Implementation Plan

## Overview
Implement a file mention system that allows users to type `@filename` in the chat input, select files from a dropdown autocomplete, and automatically send the file content to the PAF Core Agent.

## Current State Analysis
- ✅ Basic chat input with mention detection exists (`ChatInput.tsx`)
- ✅ FileMentionAutocomplete component exists but needs enhancement
- ✅ File APIs exist for reading from workspace-files directory
- ✅ Core agent service handles file content via base64 encoding
- ✅ Workspace store manages file tree state
- ❌ File mention selection doesn't load actual file content
- ❌ Autocomplete doesn't properly filter workspace-files
- ❌ No integration between mentions and file loading

## Implementation Steps

### Step 1: Create New Git Branch
```bash
git checkout -b feature/file-mentions-workspace-integration
```

### Step 2: Enhance FileMentionAutocomplete Component
**File**: `apps/web/src/components/chat/FileMentionAutocomplete.tsx`

**Changes needed**:
- Ensure it reads from workspace store's `fileTree` which is populated from workspace-files
- Add proper filtering logic for files and directories
- Show file paths relative to workspace-files root
- Add file type icons and size information
- Improve keyboard navigation and selection

**Key improvements**:
- Use `useWorkspaceStore(state => state.fileTree)` for data source
- Filter both files and folders based on search term
- Show nested file paths clearly
- Add loading states while file tree is being populated

### Step 3: Modify ChatInput Component
**File**: `apps/web/src/components/chat/ChatInput.tsx`

**Changes needed**:
- Update `handleMentionSelect` to load actual file content when a file is selected
- Add file content loading logic for mentioned files
- Update `parseMentions` to resolve file paths and load content
- Handle both text and binary files appropriately
- Add error handling for missing or unreadable files

**Key improvements**:
- Load file content via `/api/files/content` endpoint when mention is selected
- Store file content in mention objects for sending to core agent
- Add file size limits and type validation
- Show loading indicators while files are being loaded

### Step 4: Create File Content Loader Utility
**File**: `apps/web/src/lib/file-mention-loader.ts` (new file)

**Purpose**: Centralized logic for loading file content from workspace-files

**Functions needed**:
```typescript
interface FileMentionContent {
  name: string
  path: string
  content: string
  fileType: string
  fileSize: number
  isBase64: boolean
}

export async function loadFileContent(filePath: string): Promise<FileMentionContent>
export function isFileSupported(fileName: string): boolean
export function shouldEncodeAsBase64(fileType: string): boolean
```

### Step 5: Update Core Agent Service Integration
**File**: `apps/web/src/services/coreAgentService.ts`

**Changes needed**:
- Update `sendMessage` method to handle file mentions with content
- Add mention files to the `files` array sent to core agent
- Ensure proper base64 encoding for binary files mentioned via @
- Add file metadata (path, type, size) to the request

**Key improvements**:
- Process `FileMention[]` objects with loaded content
- Convert mentions to PAF Core Agent's `FileContent` format
- Handle both text and binary file mentions
- Add proper error handling for invalid mentions

### Step 6: Enhance File Mention Types
**File**: `apps/web/src/types/index.ts`

**Changes needed**:
- Update `FileMention` interface to include file content and metadata
- Add proper typing for file content loading states
- Ensure compatibility with PAF Core Agent API spec

**New/Updated interfaces**:
```typescript
interface FileMention {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  startIndex: number
  endIndex: number
  displayText: string
  content?: string          // File content (text or base64)
  fileType?: string         // MIME type
  fileSize?: number         // File size in bytes
  isBase64?: boolean        // Whether content is base64 encoded
  loadingState?: 'loading' | 'loaded' | 'error'
  error?: string           // Error message if loading failed
}
```

### Step 7: Add File Loading UI States
**File**: `apps/web/src/components/chat/MessageContent.tsx`

**Changes needed**:
- Show loading indicators for files being loaded
- Display file information (size, type) in mention tooltips
- Add error states for failed file loads
- Show file preview information

### Step 8: Update Workspace Store
**File**: `apps/web/src/stores/workspace-store.ts`

**Changes needed** (if any):
- Ensure file tree loading works correctly
- Add any needed actions for file mention management
- Consider caching file content for performance

### Step 9: Add File Mention Processing Logic
**File**: `apps/web/src/lib/mention-processor.ts` (new file)

**Purpose**: Handle the conversion from text mentions to loaded file content

**Functions needed**:
```typescript
export async function processMentions(
  messageText: string, 
  fileTree: FileNode[]
): Promise<{
  processedText: string
  mentions: FileMention[]
  errors: string[]
}>

export function findFileInTree(fileName: string, fileTree: FileNode[]): FileNode | null
export function resolveMentionPath(mention: string, fileTree: FileNode[]): string | null
```

### Step 10: Error Handling and User Feedback
**Enhancements needed**:
- Toast notifications for file loading errors
- Clear error messages for unsupported file types
- Warnings for large files
- Helpful suggestions for ambiguous file names

### Step 11: Performance Optimizations
**Optimizations to implement**:
- File content caching to avoid re-loading same files
- Debounced file tree search
- Lazy loading of large files
- Progress indicators for large file operations

### Step 12: Testing and Integration
**Testing areas**:
- File mention autocomplete functionality
- File content loading for various file types
- Core agent integration with file content
- Error handling for missing/invalid files
- Performance with large files and many mentions

## File Type Support Matrix

| File Type | Extension | Encoding | Max Size | Notes |
|-----------|-----------|----------|----------|-------|
| Text | .txt, .md, .json, .csv | Plain text | 10MB | Direct text content |
| Code | .js, .ts, .py, .java | Plain text | 10MB | Syntax highlighting |
| Excel | .xlsx, .xls, .xlsm | Base64 | 100MB | PAF Core Agent handles parsing |
| PDF | .pdf | Base64 | 50MB | For document analysis |
| Images | .png, .jpg, .gif | Base64 | 10MB | For visual analysis |
| Other | * | Base64 | 10MB | Generic binary handling |

## API Integration Requirements

### File Content Loading
- Use existing `/api/files/content` endpoint
- Add `format=base64` parameter for binary files
- Handle file size limits appropriately
- Add proper error responses

### Core Agent Integration
- Follow PAF Core Agent FileContent schema:
```json
{
  "file_name": "report.xlsx",
  "content": "<BASE64_OR_TEXT>",
  "file_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "file_size": 8742,
  "file_path": "/business/reports/report.xlsx"
}
```

## Security Considerations
- Validate file paths to prevent directory traversal
- Enforce file size limits
- Sanitize file content for display
- Validate file types against allowed list
- Rate limiting for file operations

## User Experience Enhancements
- Show file preview in autocomplete
- Display file size and type information
- Provide helpful error messages
- Auto-complete with fuzzy matching
- Keyboard shortcuts for mention insertion
- Visual indicators for file loading states

## Success Criteria
1. ✅ Users can type `@` and see workspace files in dropdown
2. ✅ Selecting a file loads its content automatically
3. ✅ File content is properly sent to PAF Core Agent
4. ✅ Both text and binary files work correctly
5. ✅ Error handling works for invalid/missing files
6. ✅ Performance is acceptable for large files
7. ✅ UI provides clear feedback on file operations
8. ✅ Integration maintains existing chat functionality

## Implementation Priority
1. **High Priority**: Basic mention autocomplete and file loading
2. **Medium Priority**: Error handling and user feedback
3. **Low Priority**: Performance optimizations and advanced features

## Estimated Timeline
- Step 1-4: File loading core functionality (1-2 days)
- Step 5-7: Integration and UI enhancements (1 day)  
- Step 8-12: Polish, testing, and optimization (1 day)

**Total Estimated Time**: 3-4 days 