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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
  enableMath = true,
  enableCodeHighlight = true,
  securityLevel = 'safe',
  className = ''
}) => {
  // For markdown content, we don't sanitize the input - ReactMarkdown handles this safely
  // We only sanitize if we're dealing with raw HTML content
  const processedContent = useMemo(() => {
    // Check if content looks like HTML (contains HTML tags)
    const htmlTagRegex = /<[^>]*>/;
    const isHtmlContent = htmlTagRegex.test(content);
    
    if (isHtmlContent) {
      // Only sanitize if it's HTML content
      return sanitizeContent(content, securityLevel);
    } else {
      // For markdown content, pass through without sanitization
      return content;
    }
  }, [content, securityLevel]);

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
    // Enhanced code block component
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
      
      // Inline code
      return (
        <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    },
    
    // Enhanced table styling
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props}>
          {children}
        </table>
      </div>
    ),
    
    thead: ({ children, ...props }: any) => (
      <thead className="bg-gray-50" {...props}>
        {children}
      </thead>
    ),
    
    th: ({ children, ...props }: any) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props}>
        {children}
      </th>
    ),
    
    tbody: ({ children, ...props }: any) => (
      <tbody className="bg-white divide-y divide-gray-200" {...props}>
        {children}
      </tbody>
    ),
    
    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-gray-50" {...props}>
        {children}
      </tr>
    ),
    
    td: ({ children, ...props }: any) => (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" {...props}>
        {children}
      </td>
    ),

    // Block detection for custom renderers
    div: ({ node, className, children, ...props }: any) => {
      if (className?.includes('pixell-block')) {
        return <BlockRenderer node={node} {...props} />;
      }
      return <div className={className} {...props}>{children}</div>;
    },
    
    // Enhanced list styling
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside space-y-1 my-2" {...props}>
        {children}
      </ul>
    ),
    
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
        {children}
      </ol>
    ),
    
    li: ({ children, ...props }: any) => (
      <li className="text-gray-700" {...props}>
        {children}
      </li>
    ),
    
    // Enhanced quote styling
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-gray-600 bg-blue-50 py-2" {...props}>
        {children}
      </blockquote>
    ),
    
    // Enhanced heading styles
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4 border-b border-gray-200 pb-2" {...props}>
        {children}
      </h1>
    ),
    
    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-semibold text-gray-900 mt-5 mb-3" {...props}>
        {children}
      </h2>
    ),
    
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-medium text-gray-900 mt-4 mb-2" {...props}>
        {children}
      </h3>
    ),
    
    // Enhanced paragraph spacing
    p: ({ children, ...props }: any) => (
      <p className="text-gray-700 leading-relaxed my-2" {...props}>
        {children}
      </p>
    )
  }), []);

  if (!content && !isStreaming) {
    return <div className={`text-gray-400 italic ${className}`}>No content</div>;
  }

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
      
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
      )}
    </div>
  );
}; 