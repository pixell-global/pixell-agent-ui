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

## Next Steps (Phase 2)

- [ ] Create MarkdownRenderer component with ChatGPT-style UI
- [ ] Build CodeBlock component with copy functionality
- [ ] Implement streaming renderer for real-time updates
- [ ] Add block detection and rendering system

## Usage

```typescript
import { sanitizeContent, validateBlockPayload } from '@pixell/renderer';

// Sanitize content with different security levels
const safeContent = sanitizeContent(userInput, 'safe');
const trustedContent = sanitizeContent(adminInput, 'trusted');

// Validate block payloads
const isValid = validateBlockPayload(blockData);
```

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