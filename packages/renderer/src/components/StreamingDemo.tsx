import React, { useState, useEffect } from 'react';
import { HybridStreamingRenderer } from './HybridStreamingRenderer';
import { createBarChart, createLineChart } from './ChartRenderer';

interface StreamingDemoProps {
  className?: string;
}

export const StreamingDemo: React.FC<StreamingDemoProps> = ({ className = '' }) => {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messageId = 'demo-message';

  // Demo content with math, code, and explicit charts only
  const demoContent = `# Fibonacci Sequence Analysis

The Fibonacci sequence is a mathematical series where each number is the sum of the two preceding ones:

$$F(n) = F(n-1) + F(n-2)$$

Where $F(0) = 0$ and $F(1) = 1$.

## Python Implementation

\`\`\`python
def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        fib = [0, 1]
        for i in range(2, n + 1):
            fib.append(fib[i - 1] + fib[i - 2])
        return fib

# Generate first 10 Fibonacci numbers
fib_sequence = fibonacci(10)
print("Fibonacci sequence:", fib_sequence)
\`\`\`

## Exponential Growth

The Fibonacci sequence exhibits exponential growth, which can be visualized with this chart:

<!--pixell:block:chart-->${JSON.stringify(createLineChart([
    { n: 0, value: 0 },
    { n: 1, value: 1 },
    { n: 2, value: 1 },
    { n: 3, value: 2 },
    { n: 4, value: 3 },
    { n: 5, value: 5 },
    { n: 6, value: 8 },
    { n: 7, value: 13 },
    { n: 8, value: 21 },
    { n: 9, value: 34 }
  ], 'n', 'value', 'Fibonacci Growth'))}<!--/pixell:block-->

For larger values of $n$, the sequence grows rapidly. Each term is approximately $\\phi^n / \\sqrt{5}$ where $\\phi$ is the golden ratio.

## Performance Comparison

Here's how different implementations compare:

<!--pixell:block:chart-->${JSON.stringify(createBarChart([
    { method: 'Recursive', time: 89.2 },
    { method: 'Iterative', time: 0.001 },
    { method: 'Memoized', time: 0.01 },
    { method: 'Matrix', time: 0.005 }
  ], 'method', 'time', 'Execution Time (ms)'))}<!--/pixell:block-->

The recursive approach becomes impractical for large values of $n$ due to its $O(2^n)$ complexity.

## Mathematical Properties

The Fibonacci sequence has many interesting properties:

1. **Golden ratio**: $\\lim_{n \\to \\infty} \\frac{F(n+1)}{F(n)} = \\phi = \\frac{1 + \\sqrt{5}}{2}$
2. **Binet's formula**: $F(n) = \\frac{\\phi^n - (-\\phi)^{-n}}{\\sqrt{5}}$
3. **Sum property**: $\\sum_{i=0}^{n} F(i) = F(n+2) - 1$

> The Fibonacci sequence appears frequently in nature, from flower petals to spiral galaxies!

This demonstrates the power of mathematical modeling in understanding natural phenomena.`;

  // Simulate streaming
  const startStreaming = () => {
    setContent('');
    setIsStreaming(true);
    
    let currentIndex = 0;
    const streamInterval = setInterval(() => {
      if (currentIndex < demoContent.length) {
        setContent(demoContent.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsStreaming(false);
        clearInterval(streamInterval);
      }
    }, 20); // Stream at 50 chars per second
  };

  // Auto-start on mount
  useEffect(() => {
    startStreaming();
  }, []);

  const reset = () => {
    setContent('');
    setIsStreaming(false);
  };

  return (
    <div className={`streaming-demo ${className}`}>
      <div className="mb-4 flex gap-2">
        <button
          onClick={startStreaming}
          disabled={isStreaming}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isStreaming ? 'Streaming...' : 'Start Demo'}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Reset
        </button>
      </div>
      
      <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-[400px]">
        <HybridStreamingRenderer
          content={content}
          isStreaming={isStreaming}
          messageId={messageId}
          className="max-w-none"
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>This demo showcases:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Real-time markdown streaming with math equations (KaTeX)</li>
          <li>Syntax-highlighted Python code blocks</li>
          <li>Interactive charts (Recharts)</li>
          <li>Incremental parsing and block-based rendering</li>
        </ul>
      </div>
    </div>
  );
}; 