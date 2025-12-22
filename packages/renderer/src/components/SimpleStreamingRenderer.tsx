import React from 'react';

interface SimpleStreamingRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const SimpleStreamingRenderer: React.FC<SimpleStreamingRendererProps> = ({
  content,
  isStreaming = false,
  className = ''
}) => {
  // Debug logging to track content
  React.useEffect(() => {
    console.log('🎨 SimpleStreamingRenderer render:', {
      contentLength: content.length,
      isStreaming,
      contentPreview: content.slice(0, 100) + (content.length > 100 ? '...' : '')
    });
  }, [content, isStreaming]);

  if (!content && !isStreaming) {
    console.warn('⚠️ SimpleStreamingRenderer: No content and not streaming');
    return <div className={`text-white/40 italic ${className}`}>No content</div>;
  }

  return (
    <div className={`whitespace-pre-wrap text-white/90 ${className}`}>
      {content}
      {isStreaming && (
        <span className="animate-pulse text-pixell-yellow ml-1">|</span>
      )}
    </div>
  );
}; 