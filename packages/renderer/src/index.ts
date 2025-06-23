// Core components
export { MarkdownRenderer } from './components/MarkdownRenderer';
export { SimpleStreamingRenderer } from './components/SimpleStreamingRenderer';
export { HybridStreamingRenderer } from './components/HybridStreamingRenderer';
export { CodeBlock } from './components/CodeBlock';
export { BlockRenderer } from './components/BlockRenderer';
export { TableRenderer } from './components/TableRenderer';
export { 
  ChartRenderer,
  createBarChart,
  createLineChart,
  createScatterPlot,
  createPieChart
} from './components/ChartRenderer';

// Utilities
export { ContentParser } from './utils/ContentParser';

// Types
export * from './types';

// Security utilities
export * from './security/Sanitizer';

// Components (Phase 2 - Complete)
export * from './components/StreamingRenderer';

// Utils
export * from './utils/ContentParser';

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