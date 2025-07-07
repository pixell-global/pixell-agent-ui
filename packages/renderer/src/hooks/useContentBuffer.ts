import { useState, useCallback, useRef, useEffect } from 'react';
import { ContentBuffer } from '../types';

interface UseContentBufferOptions {
  debounceMs?: number;
  onContentChange?: (buffer: ContentBuffer) => void;
}

export function useContentBuffer(
  initialContent: string = '',
  messageId: string,
  isStreaming: boolean = false,
  options: UseContentBufferOptions = {}
) {
  const { debounceMs = 16, onContentChange } = options;
  
  const [buffer, setBuffer] = useState<ContentBuffer>({
    content: initialContent,
    lastParsedIndex: 0,
    isStreaming,
    messageId
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string>(initialContent);
  const onContentChangeRef = useRef(onContentChange);

  // Keep onContentChange ref up to date
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  // Debounced update function - stable dependencies
  const flushPendingContent = useCallback(() => {
    setBuffer(prev => {
      const newBuffer: ContentBuffer = {
        content: pendingContentRef.current,
        lastParsedIndex: prev.lastParsedIndex,
        isStreaming,
        messageId
      };
      
      // Call onChange callback if provided
      if (onContentChangeRef.current) {
        onContentChangeRef.current(newBuffer);
      }
      
      return newBuffer;
    });
  }, [isStreaming, messageId]);

  // Append content with debouncing
  const appendContent = useCallback((newContent: string) => {
    pendingContentRef.current += newContent;
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new debounced update
    debounceTimeoutRef.current = setTimeout(flushPendingContent, debounceMs);
  }, [flushPendingContent, debounceMs]);

  // Set complete content (for non-streaming updates)
  const setContent = useCallback((content: string) => {
    pendingContentRef.current = content;
    
    // Clear any pending debounced updates
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    setBuffer(prev => {
      const newBuffer: ContentBuffer = {
        content,
        lastParsedIndex: 0, // Reset parsing when content is set
        isStreaming,
        messageId
      };
      
      // Call onChange callback if provided
      if (onContentChangeRef.current) {
        onContentChangeRef.current(newBuffer);
      }
      
      return newBuffer;
    });
  }, [isStreaming, messageId]);

  // Update parsed index
  const updateParsedIndex = useCallback((index: number) => {
    setBuffer(prev => ({
      ...prev,
      lastParsedIndex: index
    }));
  }, []);

  // Force flush any pending content
  const flush = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      flushPendingContent();
    }
  }, [flushPendingContent]);

  // Effect to handle initial content changes - avoid circular dependency
  useEffect(() => {
    // Only update if content actually changed
    if (buffer.content !== initialContent) {
      pendingContentRef.current = initialContent;
      
      setBuffer(prev => ({
        ...prev,
        content: initialContent,
        lastParsedIndex: 0,
        isStreaming,
        messageId
      }));
    }
  }, [initialContent, isStreaming, messageId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    buffer,
    appendContent,
    setContent,
    updateParsedIndex,
    flush
  };
} 