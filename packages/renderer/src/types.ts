import React from 'react';

export interface RenderBlock {
  type: 'chart' | 'table' | 'button' | 'custom' | 'code' | 'markdown';
  payload: any;
  metadata?: {
    id?: string;
    timestamp?: string;
    security?: SecurityLevel;
  };
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