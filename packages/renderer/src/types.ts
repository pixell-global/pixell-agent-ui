import React from 'react';

export interface RenderBlock {
  id: string;
  type: 'markdown' | 'math' | 'code' | 'chart' | 'table' | 'text';
  payload: any;
  complete: boolean;
  startIndex: number;
  endIndex: number;
}

// New types for improved rendering architecture
export interface ContentBuffer {
  content: string;
  lastParsedIndex: number;
  isStreaming: boolean;
  messageId: string;
}

export interface DelimiterState {
  type: 'math' | 'code' | 'chart';
  startIndex: number;
  delimiter: string;
  language?: string;
}

export interface ParserState {
  delimiterStack: DelimiterState[];
  blocks: RenderBlock[];
  lastProcessedIndex: number;
}

export type RendererComponent = React.FC<{
  block: RenderBlock;
  isStreaming?: boolean;
}>;

export interface RendererRegistry {
  [type: string]: RendererComponent;
}

export interface StreamingToken {
  content: string;
  isComplete: boolean;
  messageId: string;
  tokenIndex: number;
}

export interface RendererPlugin {
  name: string;
  version: string;
  blockTypes: string[];
  render: (block: RenderBlock) => React.ReactNode;
  validate?: (payload: any) => boolean;
}

export type SecurityLevel = 'safe' | 'trusted' | 'sandbox';

// Additional types for renderer components
export interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  enableMath?: boolean;
  enableCodeHighlight?: boolean;
  securityLevel?: SecurityLevel;
  className?: string;
}

export interface CodeBlockProps {
  code: string;
  language: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  maxHeight?: number;
  className?: string;
}

export interface StreamingRendererProps {
  messageId: string;
  initialContent?: string;
  onStreamingComplete?: () => void;
  className?: string;
}

export interface BlockRendererProps {
  node: any;
  [key: string]: any;
}

// Chart-specific types
export interface ChartBlock {
  type: 'chart';
  payload: {
    spec: any; // Vega-Lite spec
    data?: any;
    actions?: boolean;
  };
}

// Table-specific types
export interface TableBlock {
  type: 'table';
  payload: {
    headers: string[];
    rows: any[][];
    caption?: string;
  };
}

// Button-specific types
export interface ButtonBlock {
  type: 'button';
  payload: {
    label: string;
    action?: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  };
} 