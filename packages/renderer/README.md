# @pixell/renderer

Pixell AI Response Rendering Engine - A ChatGPT-style rendering system for AI agent outputs.

## Phase 1 Complete ✅

### Core Infrastructure Setup

- ✅ **Dependencies Installed**: All core rendering dependencies including react-markdown, syntax highlighting, math rendering, charts, and security sanitization
- ✅ **Package Structure Created**: Organized into components, registry, security, and utils directories
- ✅ **TypeScript Configuration**: Full TypeScript support with declaration files
- ✅ **Type Definitions**: Complete interface definitions for rendering blocks, streaming, and plugins
- ✅ **Security Module**: Content sanitization with multiple security levels (safe, trusted, sandbox)
- ✅ **Build System**: Working TypeScript compilation and module exports

## Phase 2 Complete ✅

### Core Rendering Components

- ✅ **MarkdownRenderer**: Full markdown rendering with GFM, math, and enhanced typography
- ✅ **CodeBlock**: ChatGPT-style code blocks with syntax highlighting and copy functionality
- ✅ **StreamingRenderer**: Real-time token streaming with 60fps updates
- ✅ **BlockRenderer**: Foundation for custom block rendering (enhanced in Phase 3)
- ✅ **EnhancedMessageBubble**: ChatGPT-style message layout and design
- ✅ **KaTeX Integration**: Math equation rendering with proper CSS
- ✅ **Demo Components**: Interactive demo showcasing all features

### Dependencies

- **Core Rendering**: react-markdown, remark-gfm, remark-math, rehype-katex, rehype-highlight
- **Syntax Highlighting**: react-syntax-highlighter, prismjs
- **Security**: dompurify, isomorphic-dompurify
- **Visualizations**: react-vega, vega, vega-lite
- **Math**: katex
- **Icons**: lucide-react

### Security Features

- Multiple sanitization levels: `safe`, `trusted`, `sandbox`
- XSS protection through DOMPurify
- Payload size validation (default 1MB limit)
- URL sanitization to prevent malicious redirects
- HTML entity escaping utilities

### Type System

- `RenderBlock`: Core interface for extensible block rendering
- `StreamingToken`: Real-time token streaming support
- `RendererPlugin`: Plugin architecture for custom renderers
- `SecurityLevel`: Granular security control

## Next Steps (Phase 3)

- [ ] Create RendererRegistry with plugin system
- [ ] Build default block renderers (charts, tables, buttons)
- [ ] Implement block validation and security
- [ ] Add CLI tools for creating custom renderers

## Usage

### Basic Rendering

```typescript
import { MarkdownRenderer, StreamingRenderer } from '@pixell/renderer';

// Static markdown rendering
<MarkdownRenderer 
  content="# Hello World\n\nThis is **bold** text with `code`"
  enableMath={true}
  enableCodeHighlight={true}
/>

// Streaming renderer for real-time updates
<StreamingRenderer
  messageId="msg-123"
  initialContent=""
  onStreamingComplete={() => console.log('Done!')}
/>
```

### Security

```typescript
import { sanitizeContent, validateBlockPayload } from '@pixell/renderer';

// Sanitize content with different security levels
const safeContent = sanitizeContent(userInput, 'safe');
const trustedContent = sanitizeContent(adminInput, 'trusted');

// Validate block payloads
const isValid = validateBlockPayload(blockData);
```

### Demo

Visit `/renderer-demo` in your Next.js app to see all features in action!

## Development

```bash
# Build the package
npm run build

# Watch for changes
npm run dev

# Clean build artifacts
npm run clean
```

## License

Apache 2.0 