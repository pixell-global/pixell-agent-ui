'use client'

import React, { useState } from 'react'
import { EnhancedMessageBubble } from './EnhancedMessageBubble'
import { ChatMessage } from '@/types'
import { Button } from '@/components/ui/button'

export function RendererDemo() {
  const [demoMessages, setDemoMessages] = useState<ChatMessage[]>([
    {
      id: 'demo-user-1',
      role: 'user',
      content: 'Can you show me some examples of markdown rendering with code blocks?',
      messageType: 'text',
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-assistant-1',
      role: 'assistant',
      content: `# Markdown Rendering Demo

Here are some examples of enhanced markdown rendering:

## Code Blocks with Syntax Highlighting

Here's a JavaScript function with syntax highlighting:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // Output: 55
\`\`\`

And here's a Python example:

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

# Example usage
numbers = [3, 6, 8, 10, 1, 2, 1]
print(quicksort(numbers))
\`\`\`

## Lists and Formatting

- **Bold text** and *italic text*
- \`Inline code\` with proper styling
- Links like [this one](https://example.com)

### Numbered Lists
1. First item
2. Second item with **bold**
3. Third item with \`code\`

## Blockquotes

> This is a blockquote that demonstrates
> how quoted text is rendered with proper
> styling and indentation.

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Syntax Highlighting | ✅ | Prism.js integration |
| Math Rendering | ✅ | KaTeX support |
| Copy Buttons | ✅ | One-click copying |
| Dark Mode | ✅ | Automatic detection |

## Math Equations (KaTeX)

Inline math: $E = mc^2$

Block math:
$$\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n$$

The quadratic formula:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$`,
      messageType: 'text',
      createdAt: new Date().toISOString()
    }
  ])

  const addStreamingDemo = () => {
    const streamingMessage: ChatMessage = {
      id: `demo-streaming-${Date.now()}`,
      role: 'assistant',
      content: '',
      messageType: 'text',
      streaming: true,
      createdAt: new Date().toISOString()
    }

    setDemoMessages(prev => [...prev, streamingMessage])

    // Simulate streaming
    const fullContent = `## Streaming Demo

This message is being "streamed" to demonstrate real-time rendering:

\`\`\`typescript
interface StreamingToken {
  content: string;
  isComplete: boolean;
  messageId: string;
  tokenIndex: number;
}
\`\`\`

- Token 1: Initial content
- Token 2: More content appears
- Token 3: Final content with **formatting**

The streaming cursor should be visible during this process!`

    let currentContent = ''
    const words = fullContent.split(' ')
    let wordIndex = 0

    const streamInterval = setInterval(() => {
      if (wordIndex < words.length) {
        currentContent += (wordIndex > 0 ? ' ' : '') + words[wordIndex]
        
        // Dispatch streaming event
        window.dispatchEvent(new CustomEvent('pixell:streaming-token', {
          detail: {
            messageId: streamingMessage.id,
            content: currentContent,
            isComplete: false,
            tokenIndex: wordIndex
          }
        }))

        wordIndex++
      } else {
        // Complete the stream
        window.dispatchEvent(new CustomEvent('pixell:streaming-token', {
          detail: {
            messageId: streamingMessage.id,
            content: currentContent,
            isComplete: true,
            tokenIndex: wordIndex
          }
        }))

        // Update the message to not be streaming
        setDemoMessages(prev => prev.map(msg => 
          msg.id === streamingMessage.id 
            ? { ...msg, content: currentContent, streaming: false }
            : msg
        ))

        clearInterval(streamInterval)
      }
    }, 100) // Stream every 100ms
  }

  const addMathDemo = () => {
    const mathMessage: ChatMessage = {
      id: `demo-math-${Date.now()}`,
      role: 'assistant',
      content: `## Advanced Math Rendering

### Linear Algebra
Matrix multiplication:
$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} \\begin{bmatrix} e & f \\\\ g & h \\end{bmatrix} = \\begin{bmatrix} ae+bg & af+bh \\\\ ce+dg & cf+dh \\end{bmatrix}$$

### Calculus
The fundamental theorem of calculus:
$$\\int_a^b f'(x) dx = f(b) - f(a)$$

### Statistics
Normal distribution probability density function:
$$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}$$

### Physics
Schrödinger equation:
$$i\\hbar\\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat{H}\\Psi(\\mathbf{r},t)$$`,
      messageType: 'text',
      createdAt: new Date().toISOString()
    }

    setDemoMessages(prev => [...prev, mathMessage])
  }

  return (
    <div className="renderer-demo space-y-4">
      <div className="flex gap-2 mb-6">
        <Button onClick={addStreamingDemo} variant="outline">
          Demo Streaming
        </Button>
        <Button onClick={addMathDemo} variant="outline">
          Demo Math
        </Button>
        <Button 
          onClick={() => setDemoMessages([])} 
          variant="outline"
        >
          Clear Demo
        </Button>
      </div>

      <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
        {demoMessages.map((message) => (
          <EnhancedMessageBubble
            key={message.id}
            message={message}
            isStreaming={message.streaming}
          />
        ))}
      </div>
    </div>
  )
} 