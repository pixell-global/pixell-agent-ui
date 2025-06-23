import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  maxHeight?: number;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  theme = 'dark',
  showLineNumbers = false,
  maxHeight = 400,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const getLanguageDisplayName = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'jsx': 'JSX',
      'ts': 'TypeScript',
      'tsx': 'TSX',
      'py': 'Python',
      'python': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'sh': 'Shell',
      'bash': 'Bash',
      'sql': 'SQL',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'md': 'Markdown',
      'dockerfile': 'Dockerfile'
    };
    return languageMap[lang.toLowerCase()] || lang.toUpperCase();
  };

  const style = theme === 'dark' ? oneDark : oneLight;

  return (
    <div className={`relative group my-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg">
        <span className="text-sm text-gray-300 font-mono">
          {getLanguageDisplayName(language || 'text')}
        </span>
        <button
          onClick={handleCopy}
          className="opacity-70 hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-700 text-gray-300"
          aria-label="Copy code"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check size={16} className="text-green-400" />
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>
      
      {/* Code content */}
      <div style={{ maxHeight }} className="overflow-auto">
        <SyntaxHighlighter
          language={language || 'text'}
          style={style}
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            fontSize: '14px',
            lineHeight: '1.5',
            background: theme === 'dark' ? '#1e1e1e' : '#f8f9fa'
          }}
          wrapLines={true}
          wrapLongLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}; 