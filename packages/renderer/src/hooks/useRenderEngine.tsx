import React, { useMemo, useCallback } from 'react';
import { RenderBlock, RendererRegistry, RendererComponent } from '../types';

// Import original renderers
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { CodeBlock } from '../components/CodeBlock';
import { ChartRenderer } from '../components/ChartRenderer';
import { TableRenderer } from '../components/TableRenderer';

// Wrapper components that adapt to the new RendererComponent interface
const MarkdownWrapper: RendererComponent = ({ block, isStreaming }) => {
  return (
    <MarkdownRenderer
      content={block.payload.content}
      isStreaming={isStreaming && !block.complete}
    />
  );
};

const CodeWrapper: RendererComponent = ({ block, isStreaming }) => {
  return (
    <CodeBlock
      code={block.payload.content}
      language={block.payload.language}
    />
  );
};

const ChartWrapper: RendererComponent = ({ block, isStreaming }) => {
  return (
    <ChartRenderer
      spec={block.payload}
    />
  );
};

const TableWrapper: RendererComponent = ({ block, isStreaming }) => {
  return (
    <TableRenderer
      data={block.payload}
    />
  );
};

const MathWrapper: RendererComponent = ({ block, isStreaming }) => {
  const content = block.payload.displayMode 
    ? `$$${block.payload.content}$$`
    : `$${block.payload.content}$`;
  
  return (
    <MarkdownRenderer
      content={content}
      isStreaming={isStreaming && !block.complete}
    />
  );
};

const TextWrapper: RendererComponent = ({ block, isStreaming }) => {
  const content = typeof block.payload === 'string' ? block.payload : block.payload.content;
  
  return (
    <MarkdownRenderer
      content={content}
      isStreaming={isStreaming && !block.complete}
    />
  );
};

// Default renderer registry with wrapped components
const DEFAULT_RENDERERS: RendererRegistry = {
  markdown: MarkdownWrapper,
  code: CodeWrapper,
  chart: ChartWrapper,
  table: TableWrapper,
  math: MathWrapper,
  text: TextWrapper,
};

interface UseRenderEngineOptions {
  customRenderers?: Partial<RendererRegistry>;
  fallbackRenderer?: RendererComponent;
}

export function useRenderEngine(options: UseRenderEngineOptions = {}) {
  const { customRenderers = {}, fallbackRenderer } = options;

  // Merge default and custom renderers
  const registry = useMemo<RendererRegistry>(() => {
    const merged: RendererRegistry = { ...DEFAULT_RENDERERS };
    Object.entries(customRenderers).forEach(([key, value]) => {
      if (value) {
        merged[key] = value;
      }
    });
    return merged;
  }, [customRenderers]);

  // Get renderer for block type
  const getRenderer = useCallback((blockType: string): RendererComponent => {
    return registry[blockType] || fallbackRenderer || registry.text;
  }, [registry, fallbackRenderer]);

  // Register a new renderer
  const registerRenderer = useCallback((type: string, renderer: RendererComponent) => {
    // This would typically update a state, but for simplicity we'll return a new registry
    return {
      ...registry,
      [type]: renderer
    };
  }, [registry]);

  // Render a single block
  const renderBlock = useCallback((block: RenderBlock, isStreaming?: boolean) => {
    const Renderer = getRenderer(block.type);
    return {
      id: block.id,
      component: Renderer,
      props: { block, isStreaming }
    };
  }, [getRenderer]);

  // Render multiple blocks
  const renderBlocks = useCallback((blocks: RenderBlock[], isStreaming?: boolean) => {
    return blocks.map(block => renderBlock(block, isStreaming));
  }, [renderBlock]);

  return {
    registry,
    getRenderer,
    registerRenderer,
    renderBlock,
    renderBlocks
  };
} 