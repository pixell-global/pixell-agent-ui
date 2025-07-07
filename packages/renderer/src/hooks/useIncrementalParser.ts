import { useState, useCallback, useMemo, useRef } from 'react';
import { ContentBuffer, RenderBlock, DelimiterState, ParserState } from '../types';

interface UseIncrementalParserOptions {
  stallTimeoutMs?: number;
  hardTimeoutMs?: number;
}

export function useIncrementalParser(
  buffer: ContentBuffer,
  options: UseIncrementalParserOptions = {}
) {
  const { stallTimeoutMs = 200, hardTimeoutMs = 3000 } = options;

  const [parserState, setParserState] = useState<ParserState>({
    delimiterStack: [],
    blocks: [],
    lastProcessedIndex: 0
  });

  const lastContentRef = useRef<string>('');
  const lastBlocksRef = useRef<RenderBlock[]>([]);

  // Generate unique block ID
  const generateBlockId = useCallback(() => {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // ChatGPT-style balanced delimiter checking for math
  const isMathBalanced = useCallback((content: string, startIndex: number, endIndex: number): boolean => {
    const mathContent = content.slice(startIndex, endIndex);
    
    // Count unescaped $ characters
    let dollarCount = 0;
    let backslashCount = 0;
    
    for (let i = 0; i < mathContent.length; i++) {
      if (mathContent[i] === '\\') {
        backslashCount++;
      } else if (mathContent[i] === '$') {
        // Only count $ if it's not escaped (even number of preceding backslashes)
        if (backslashCount % 2 === 0) {
          dollarCount++;
        }
        backslashCount = 0;
      } else {
        backslashCount = 0;
      }
    }
    
    return dollarCount % 2 === 0;
  }, []);

  // Parse block math ($$...$$) with balanced delimiter checking
  const parseBlockMath = useCallback((content: string, startIndex: number): RenderBlock | null => {
    const mathStart = content.indexOf('$$', startIndex);
    if (mathStart === -1) return null;

    const mathEnd = content.indexOf('$$', mathStart + 2);
    const isComplete = mathEnd !== -1;
    
    // Only mark as complete if delimiters are balanced
    const endIndex = isComplete ? mathEnd + 2 : content.length;
    const isBalanced = isComplete && isMathBalanced(content, mathStart, endIndex);
    
    const payload = content.slice(mathStart + 2, isComplete ? mathEnd : content.length);

    return {
      id: generateBlockId(),
      type: 'math',
      payload: { content: payload, displayMode: true },
      complete: isBalanced,
      startIndex: mathStart,
      endIndex
    };
  }, [generateBlockId, isMathBalanced]);

  // Note: Removed parenthetical math parsing - let remark-math handle all math parsing
  // This keeps the parser clean and avoids regex complexity

  // Parse inline math ($...$) with balanced delimiter checking
  const parseInlineMath = useCallback((content: string, startIndex: number): RenderBlock | null => {
    const mathStart = content.indexOf('$', startIndex);
    if (mathStart === -1) return null;

    // Skip if this is part of block math
    if (mathStart > 0 && content[mathStart - 1] === '$') return null;
    if (mathStart < content.length - 1 && content[mathStart + 1] === '$') return null;

    const mathEnd = content.indexOf('$', mathStart + 1);
    const isComplete = mathEnd !== -1;
    
    // Only mark as complete if delimiters are balanced and content is non-empty
    const endIndex = isComplete ? mathEnd + 1 : content.length;
    const payload = content.slice(mathStart + 1, isComplete ? mathEnd : content.length);
    const isBalanced = isComplete && payload.trim().length > 0 && 
      isMathBalanced(content, mathStart, endIndex);

    return {
      id: generateBlockId(),
      type: 'math',
      payload: { content: payload, displayMode: false },
      complete: isBalanced,
      startIndex: mathStart,
      endIndex
    };
  }, [generateBlockId, isMathBalanced]);

  // Parse code blocks (```lang...```)
  const parseCodeBlock = useCallback((content: string, startIndex: number): RenderBlock | null => {
    const codeStart = content.indexOf('```', startIndex);
    if (codeStart === -1) return null;

    const lineEnd = content.indexOf('\n', codeStart);
    const language = lineEnd !== -1 ? content.slice(codeStart + 3, lineEnd).trim() : '';
    
    const codeEnd = content.indexOf('```', lineEnd !== -1 ? lineEnd : codeStart + 3);
    const isComplete = codeEnd !== -1;
    const endIndex = isComplete ? codeEnd + 3 : content.length;
    
    const codeContent = content.slice(
      lineEnd !== -1 ? lineEnd + 1 : codeStart + 3,
      isComplete ? codeEnd : content.length
    );

    return {
      id: generateBlockId(),
      type: 'code',
      payload: { content: codeContent, language: language || 'text' },
      complete: isComplete,
      startIndex: codeStart,
      endIndex
    };
  }, [generateBlockId]);

  // Parse chart blocks (<!--pixell:block:chart-->...<!--/pixell:block-->)
  const parseChartBlock = useCallback((content: string, startIndex: number): RenderBlock | null => {
    const chartStart = content.indexOf('<!--pixell:block:chart-->', startIndex);
    if (chartStart === -1) return null;

    const chartEnd = content.indexOf('<!--/pixell:block-->', chartStart);
    const isComplete = chartEnd !== -1;
    const endIndex = isComplete ? chartEnd + 20 : content.length;
    
    const jsonContent = content.slice(
      chartStart + 25,
      isComplete ? chartEnd : content.length
    );

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(jsonContent);
    } catch (e) {
      // Invalid JSON, treat as incomplete
      parsedPayload = { rawContent: jsonContent };
    }

    return {
      id: generateBlockId(),
      type: 'chart',
      payload: parsedPayload,
      complete: isComplete && !!parsedPayload.data,
      startIndex: chartStart,
      endIndex
    };
  }, [generateBlockId]);

  // Main parsing function
  const parseContent = useCallback((content: string, fromIndex: number = 0): RenderBlock[] => {
    const blocks: RenderBlock[] = [];
    let currentIndex = fromIndex;

    while (currentIndex < content.length) {
      let nextBlock: RenderBlock | null = null;
      let nextBlockStart = content.length;

      // Check for block math first (has precedence)
      const blockMath = parseBlockMath(content, currentIndex);
      if (blockMath && blockMath.startIndex < nextBlockStart) {
        nextBlock = blockMath;
        nextBlockStart = blockMath.startIndex;
      }

      // Check for code blocks
      const codeBlock = parseCodeBlock(content, currentIndex);
      if (codeBlock && codeBlock.startIndex < nextBlockStart) {
        nextBlock = codeBlock;
        nextBlockStart = codeBlock.startIndex;
      }

      // Check for chart blocks
      const chartBlock = parseChartBlock(content, currentIndex);
      if (chartBlock && chartBlock.startIndex < nextBlockStart) {
        nextBlock = chartBlock;
        nextBlockStart = chartBlock.startIndex;
      }

      // Check for inline math (only if no other blocks found at current position)
      if (!nextBlock) {
        const inlineMath = parseInlineMath(content, currentIndex);
        if (inlineMath && inlineMath.startIndex < nextBlockStart) {
          nextBlock = inlineMath;
          nextBlockStart = inlineMath.startIndex;
        }
      }

      // Note: Removed parenthetical math parsing - using clean approach

      if (nextBlock) {
        // Add markdown block before this special block if there's content
        if (nextBlock.startIndex > currentIndex) {
          const markdownContent = content.slice(currentIndex, nextBlock.startIndex);
          if (markdownContent.trim()) {
            blocks.push({
              id: generateBlockId(),
              type: 'markdown',
              payload: { content: markdownContent },
              complete: true,
              startIndex: currentIndex,
              endIndex: nextBlock.startIndex
            });
          }
        }

        blocks.push(nextBlock);
        currentIndex = nextBlock.endIndex;
      } else {
        // No more special blocks, add remaining content as markdown
        const remainingContent = content.slice(currentIndex);
        if (remainingContent.trim()) {
          blocks.push({
            id: generateBlockId(),
            type: 'markdown',
            payload: { content: remainingContent },
            complete: !buffer.isStreaming, // Only complete if not streaming
            startIndex: currentIndex,
            endIndex: content.length
          });
        }
        break;
      }
    }

    return blocks;
  }, [buffer.isStreaming, generateBlockId, parseBlockMath, parseCodeBlock, parseChartBlock, parseInlineMath]);

  // Parse new content incrementally - avoid circular dependency
  const blocks = useMemo(() => {
    // Only reparse if content actually changed
    if (buffer.content === lastContentRef.current) {
      return lastBlocksRef.current;
    }

    const newBlocks = parseContent(buffer.content, 0);
    
    // Update refs to track changes
    lastContentRef.current = buffer.content;
    lastBlocksRef.current = newBlocks;
    
    // Update parser state asynchronously to avoid circular dependency
    setTimeout(() => {
      setParserState(prev => ({
        ...prev,
        blocks: newBlocks,
        lastProcessedIndex: buffer.content.length
      }));
    }, 0);

    return newBlocks;
  }, [buffer.content, parseContent]);

  // Force complete all incomplete blocks (for timeouts)
  const forceComplete = useCallback(() => {
    setParserState(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => ({ ...block, complete: true }))
    }));
  }, []);

  // Reset parser state (for new messages)
  const reset = useCallback(() => {
    setParserState({
      delimiterStack: [],
      blocks: [],
      lastProcessedIndex: 0
    });
    lastContentRef.current = '';
    lastBlocksRef.current = [];
  }, []);

  return {
    blocks,
    parserState,
    forceComplete,
    reset
  };
} 