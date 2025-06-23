import React, { useMemo, useEffect, useState } from 'react';
import { ContentParser } from '../utils/ContentParser';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SimpleStreamingRenderer } from './SimpleStreamingRenderer';

interface HybridStreamingRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const HybridStreamingRenderer: React.FC<HybridStreamingRendererProps> = ({
  content,
  isStreaming = false,
  className = ''
}) => {
  // Check if content has rich formatting that would benefit from markdown rendering
  const hasRichContent = useMemo(() => {
    return ContentParser.hasRichContent(content);
  }, [content]);

  // During streaming, always use simple renderer for performance
  if (isStreaming) {
    return (
      <SimpleStreamingRenderer 
        content={content} 
        isStreaming={true}
        className={className}
      />
    );
  }

  // After streaming, use markdown renderer if we have rich content
  if (hasRichContent) {
    return (
      <MarkdownRenderer
        content={content}
        isStreaming={false}
        enableMath={true}
        enableCodeHighlight={true}
        className={className}
      />
    );
  }

  // For plain text content, use simple renderer
  return (
    <SimpleStreamingRenderer 
      content={content} 
      isStreaming={false}
      className={className}
    />
  );
}; 