import React, { useEffect, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StreamingRendererProps } from '../types';

export const StreamingRenderer: React.FC<StreamingRendererProps> = ({
  messageId,
  initialContent = '',
  onStreamingComplete,
  className = ''
}) => {
  const [content, setContent] = useState(initialContent);
  const [isStreaming, setIsStreaming] = useState(false);

  // Update content when initialContent prop changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, messageId]);

  useEffect(() => {
    // Listen for streaming events
    const handleStreamingToken = (event: CustomEvent) => {
      if (event.detail.messageId === messageId) {
        setContent(event.detail.content);
        setIsStreaming(!event.detail.isComplete);
        
        if (event.detail.isComplete && onStreamingComplete) {
          onStreamingComplete();
        }
      }
    };

    window.addEventListener('pixell:streaming-token', handleStreamingToken as EventListener);
    
    return () => {
      window.removeEventListener('pixell:streaming-token', handleStreamingToken as EventListener);
    };
  }, [messageId, onStreamingComplete]);

  return (
    <div className={className}>
      <MarkdownRenderer
        content={content}
        isStreaming={isStreaming}
        enableMath={false}
        enableCodeHighlight={true}
      />
    </div>
  );
}; 