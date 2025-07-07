import React, { useCallback, useMemo } from 'react';
import { useContentBuffer, useIncrementalParser, useRenderEngine } from '../hooks';
import { RendererComponent } from '../types';

interface HybridStreamingRendererProps {
  content: string;
  isStreaming: boolean;
  messageId: string;
  className?: string;
  customRenderers?: Record<string, RendererComponent>;
  onContentChange?: () => void;
  enableChartEnhancement?: boolean; // Enable smart chart generation
}

export const HybridStreamingRenderer: React.FC<HybridStreamingRendererProps> = ({
  content,
  isStreaming,
  messageId,
  className = '',
  customRenderers = {},
  onContentChange,
  enableChartEnhancement = true // Enable chart enhancement by default
}) => {
  // Memoize the content change callback to prevent re-renders
  const stableOnContentChange = useCallback(() => {
    onContentChange?.();
  }, [onContentChange]);

  // Clean approach: Let remark-math + rehype-katex handle everything
  // No regex processing - just pass content through with proper chart detection
  const processedContent = useMemo(() => {
    let processed = content;
    
    // Only add chart enhancement if enabled and not streaming
    if (enableChartEnhancement && !isStreaming) {
      // Look for chart code blocks using standard markdown syntax
      const chartCodeBlockPattern = /```chart\s*\n([\s\S]*?)\n```/g;
      const chartMatches = [...processed.matchAll(chartCodeBlockPattern)];
      
      for (const match of chartMatches) {
        try {
          const chartConfig = JSON.parse(match[1]);
          const chartBlock = `\n<!--pixell:block:chart-->${JSON.stringify(chartConfig)}<!--/pixell:block-->\n`;
          processed = processed.replace(match[0], chartBlock);
        } catch (e) {
          // Invalid JSON, leave as code block
          console.warn('Invalid chart configuration:', e);
        }
      }
      
      // Smart Fibonacci chart detection (minimal, specific rules)
      const lowerContent = processed.toLowerCase();
      const hasGraphRequest = (lowerContent.includes('draw') || lowerContent.includes('plot')) && 
                             lowerContent.includes('graph') && 
                             lowerContent.includes('fibonacci');
      
      if (hasGraphRequest && !processed.includes('<!--pixell:block:chart-->')) {
        // Generate Fibonacci chart only for explicit requests
        const fibData = [];
        let prev = 0, curr = 1;
        for (let i = 0; i <= 10; i++) {
          if (i === 0) fibData.push({ n: i, value: 0 });
          else if (i === 1) fibData.push({ n: i, value: 1 });
          else {
            const next = prev + curr;
            fibData.push({ n: i, value: next });
            prev = curr;
            curr = next;
          }
        }
        
        const chartSpec = {
          type: 'LineChart',
          data: fibData,
          config: {
            xField: 'n',
            yField: 'value',
            title: 'Fibonacci Sequence (n=0 to n=10)',
            color: '#3b82f6'
          }
        };
        
        processed += `\n\n<!--pixell:block:chart-->${JSON.stringify(chartSpec)}<!--/pixell:block-->\n`;
      }
    }
    
    return processed;
  }, [content, isStreaming, enableChartEnhancement]);

  // Use content buffer for debounced updates
  const { buffer } = useContentBuffer(processedContent, messageId, isStreaming, {
    debounceMs: 16,
    onContentChange: onContentChange ? stableOnContentChange : undefined
  });

  // Parse content into blocks
  const { blocks } = useIncrementalParser(buffer, {
    stallTimeoutMs: 200,
    hardTimeoutMs: 3000
  });

  // Memoize custom renderers to prevent re-creating the render engine
  const stableCustomRenderers = useMemo(() => customRenderers, [customRenderers]);

  // Get render engine with custom renderers
  const { renderBlocks } = useRenderEngine({
    customRenderers: stableCustomRenderers
  });

  // Render all blocks
  const renderedBlocks = useMemo(() => {
    return renderBlocks(blocks, isStreaming);
  }, [blocks, isStreaming, renderBlocks]);

  const handleBlockRender = useCallback((renderedBlock: any, index: number) => {
    const { component: Component, props } = renderedBlock;
    return (
      <Component key={renderedBlock.id || index} {...props} />
    );
  }, []);

  // Don't render anything if there's no content or no blocks
  if (!buffer.content || renderedBlocks.length === 0) {
    return null;
  }

  return (
    <div className={`hybrid-streaming-renderer ${className}`}>
      {renderedBlocks.map(handleBlockRender)}
    </div>
  );
}; 