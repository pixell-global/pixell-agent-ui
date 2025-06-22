// Core types
export * from './types';

// Security utilities
export * from './security/Sanitizer';

// Components (to be implemented in Phase 2)
// export * from './components/MarkdownRenderer';
// export * from './components/CodeBlock';
// export * from './components/StreamingRenderer';
// export * from './components/BlockRenderer';

// Registry (to be implemented in Phase 3)
// export * from './registry/RendererRegistry';

// Utilities (to be implemented in Phase 4)
// export * from './utils/StreamProcessor';
// export * from './utils/TokenHandler';

// Version info
export const VERSION = '0.1.0';

// Default export for convenience
export { sanitizeContent, validateBlockPayload } from './security/Sanitizer';
export type { 
  RenderBlock, 
  StreamingToken, 
  RendererPlugin, 
  SecurityLevel,
  MarkdownRendererProps,
  CodeBlockProps,
  StreamingRendererProps
} from './types'; 