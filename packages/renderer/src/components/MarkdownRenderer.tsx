import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { sanitizeContent } from '../security/Sanitizer';
import { MarkdownRendererProps, SecurityLevel } from '../types';
import { CodeBlock } from './CodeBlock';
import { BlockRenderer } from './BlockRenderer';
import { EnhancedTableWrapper } from './EnhancedTableWrapper';

// Wrap @filename patterns with styled spans for highlighting
const highlightFileMentions = (text: string): string => {
  // Match @filename patterns (alphanumeric, dots, dashes, underscores)
  // Don't match inside code blocks or URLs
  const fileMentionPattern = /(?<![\w\/])@([\w\-\.]+\.\w+)(?![\w])/g;
  return text.replace(fileMentionPattern, '<span class="file-mention">@$1</span>');
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
  enableMath = false,
  enableCodeHighlight = true,
  securityLevel = 'safe',
  className = ''
}) => {
  // ChatGPT-style content processing with memoization for performance
  const processedContent = useMemo(() => {
    // First, highlight file mentions (before sanitization)
    let processed = highlightFileMentions(content);

    // Check if content looks like HTML (contains HTML tags)
    const htmlTagRegex = /<[^>]*>/;
    const isHtmlContent = htmlTagRegex.test(processed);

    if (isHtmlContent) {
      // Only sanitize if it's HTML content
      return sanitizeContent(processed, securityLevel);
    } else {
      // For markdown content, pass through without sanitization
      return processed;
    }
  }, [content, securityLevel]);

  // Memoize sanitized content to avoid re-processing
  const memoizedContent = useMemo(() => {
    return processedContent;
  }, [processedContent]);

  const remarkPlugins = useMemo(() => [
    remarkGfm,
    ...(enableMath ? [remarkMath] : [])
  ], [enableMath]);

  const rehypePlugins = useMemo(() => [
    ...(enableMath ? [rehypeKatex] : []),
    ...(enableCodeHighlight ? [rehypeHighlight] : []),
    rehypeRaw
  ], [enableMath, enableCodeHighlight]);

  const components = useMemo(() => ({
    // Enhanced code block component with raw content preservation for copy
    code: ({ node, inline, className, children, ...props }: any) => {
      if (!inline && children) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';
        const codeString = String(children).replace(/\n$/, '');
        
        return (
          <CodeBlock
            code={codeString}
            language={language}
            showLineNumbers={codeString.split('\n').length > 10}
            {...props}
          />
        );
      }
      
      // Inline code with copy capability
      return (
        <code
          className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono cursor-pointer hover:bg-white/20 transition-colors text-pixell-yellow/90"
          onClick={() => navigator.clipboard?.writeText(String(children))}
          title="Click to copy"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Enhanced math rendering with layout stability
    span: ({ node, className, children, ...props }: any) => {
      // Handle KaTeX inline math spans
      if (className?.includes('katex')) {
        return (
          <span 
            className={`math-container ${className}`} 
            data-latex={children}
            {...props}
          >
            <span className="math-inline">
              {children}
            </span>
            <button 
              className="math-copy-button"
              onClick={() => navigator.clipboard?.writeText(props['data-latex'] || String(children))}
              title="Copy LaTeX"
            >
              📋
            </button>
          </span>
        );
      }
      return <span className={className} {...props}>{children}</span>;
    },

    // Enhanced div handling for math display blocks
    div: ({ node, className, children, ...props }: any) => {
      // Handle KaTeX display math
      if (className?.includes('katex-display')) {
        return (
          <div className={`math-block ${className}`} {...props}>
            {children}
          </div>
        );
      }
      
      if (className?.includes('pixell-block')) {
        return <BlockRenderer node={node} {...props} />;
      }
      return <div className={className} {...props}>{children}</div>;
    },

    // Fix paragraph nesting - don't wrap block elements in paragraphs
    p: ({ node, children, ...props }: any) => {
      // Simple check: if any child contains code blocks or block elements, use div
      const childrenString = React.Children.toArray(children).join('');
      const hasBlockContent = /```|<div|<pre|<table|<ul|<ol|<blockquote|<h[1-6]/.test(childrenString);
      
      // Also check if we have CodeBlock components
      const hasCodeBlock = React.Children.toArray(children).some((child: any) => {
        if (React.isValidElement(child)) {
          const type = child.type;
          if (typeof type === 'function' && type.name === 'CodeBlock') {
            return true;
          }
          // Check for divs that look like block components
          if (type === 'div') {
            const className = (child.props as any)?.className || '';
            if (className.includes('relative') || className.includes('overflow-') || className.includes('bg-')) {
              return true;
            }
          }
        }
        return false;
      });

      // If it has block content or CodeBlock components, use div
      if (hasBlockContent || hasCodeBlock) {
        return <div className="my-2" {...props}>{children}</div>;
      }

      // Normal paragraph - using high contrast white for dark theme
      return (
        <p className="text-white/90 leading-relaxed my-2" {...props}>
          {children}
        </p>
      );
    },
    
    // Enhanced table styling with scroll and CSV download - dark theme
    table: ({ children, ...props }: any) => (
      <EnhancedTableWrapper className="my-4">
        <table className="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg" {...props}>
          {children}
        </table>
      </EnhancedTableWrapper>
    ),

    thead: ({ children, ...props }: any) => (
      <thead className="bg-white/5" {...props}>
        {children}
      </thead>
    ),

    th: ({ children, ...props }: any) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider" {...props}>
        {children}
      </th>
    ),

    tbody: ({ children, ...props }: any) => (
      <tbody className="bg-transparent divide-y divide-white/10" {...props}>
        {children}
      </tbody>
    ),

    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-white/5 transition-colors" {...props}>
        {children}
      </tr>
    ),

    td: ({ children, ...props }: any) => (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90" {...props}>
        {children}
      </td>
    ),


    
    // Enhanced list styling - dark theme with accent markers
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside space-y-1.5 my-3 text-white/90 marker:text-pixell-yellow/60" {...props}>
        {children}
      </ul>
    ),

    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside space-y-1.5 my-3 text-white/90 marker:text-pixell-yellow/60" {...props}>
        {children}
      </ol>
    ),

    li: ({ children, ...props }: any) => (
      <li className="text-white/90 leading-relaxed" {...props}>
        {children}
      </li>
    ),

    // Enhanced quote styling - dark theme with accent
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-pixell-yellow/60 pl-4 my-4 italic text-white/70 bg-white/5 py-2 rounded-r-lg" {...props}>
        {children}
      </blockquote>
    ),

    // Enhanced heading styles - dark theme
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-bold text-white mt-6 mb-4 border-b border-white/10 pb-2" {...props}>
        {children}
      </h1>
    ),

    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-semibold text-white/95 mt-5 mb-3" {...props}>
        {children}
      </h2>
    ),

    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-medium text-white/90 mt-4 mb-2" {...props}>
        {children}
      </h3>
    ),

    // Link styling - PRIMARY FIX for raw URL display
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-400/50 hover:decoration-blue-300 transition-colors"
        {...props}
      >
        {children}
      </a>
    ),

    // Strong/bold text styling
    strong: ({ children, ...props }: any) => (
      <strong className="font-semibold text-white" {...props}>
        {children}
      </strong>
    ),

    // Emphasized/italic text styling
    em: ({ children, ...props }: any) => (
      <em className="italic text-white/90" {...props}>
        {children}
      </em>
    ),

    // Horizontal rule styling
    hr: ({ ...props }: any) => (
      <hr className="border-white/10 my-6" {...props} />
    )
  }), []);

  if (!content && !isStreaming) {
    return <div className={`text-white/40 italic ${className}`}>No content</div>;
  }

  return (
    <div className={`prose prose-sm max-w-none prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {memoizedContent}
      </ReactMarkdown>

      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-pixell-yellow animate-pulse rounded-sm" />
      )}
    </div>
  );
}; 