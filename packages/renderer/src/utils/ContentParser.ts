export interface ContentBlock {
  id: string;
  type: 'text' | 'math-inline' | 'math-block' | 'code-inline' | 'code-block' | 'table';
  content: string;
  raw: string;
  metadata?: {
    language?: string;
    startIndex: number;
    endIndex: number;
  };
}

export class ContentParser {
  private static patterns = {
    mathInline: [
      /\$([^$\n]+)\$/g,           // $x^2$
      /\\\(([^)]+)\\\)/g          // \(x^2\)
    ],
    mathBlock: [
      /\$\$([^$]+)\$\$/g,         // $$x^2$$
      /\\\[([^\]]+)\\\]/g         // \[x^2\]
    ],
    codeBlock: /```(\w+)?\n([\s\S]*?)```/g,
    codeInline: /`([^`]+)`/g,
    table: /^\|(.+)\|$/gm
  };

  static hasRichContent(content: string): boolean {
    // Quick check for any rich content patterns
    const patterns = [
      ...this.patterns.mathInline,
      ...this.patterns.mathBlock,
      this.patterns.codeBlock,
      this.patterns.codeInline,
      this.patterns.table
    ];

    const results = patterns.map((pattern) => {
      pattern.lastIndex = 0; // Reset regex state
      return pattern.test(content);
    });

    return results.some(result => result);
  }

  static parse(content: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    let currentIndex = 0;
    let blockId = 0;

    // Create a list of all matches with their positions
    const matches: Array<{
      type: ContentBlock['type'];
      match: RegExpExecArray;
      content: string;
      raw: string;
      metadata?: any;
    }> = [];

    // Find all math inline patterns
    this.patterns.mathInline.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        matches.push({
          type: 'math-inline',
          match,
          content: match[1],
          raw: match[0]
        });
      }
    });

    // Find all math block patterns  
    this.patterns.mathBlock.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        matches.push({
          type: 'math-block',
          match,
          content: match[1],
          raw: match[0]
        });
      }
    });

    // Find code blocks
    this.patterns.codeBlock.lastIndex = 0;
    let match;
    while ((match = this.patterns.codeBlock.exec(content)) !== null) {
      matches.push({
        type: 'code-block',
        match,
        content: match[2],
        raw: match[0],
        metadata: { language: match[1] || 'text' }
      });
    }

    // Find inline code
    this.patterns.codeInline.lastIndex = 0;
    while ((match = this.patterns.codeInline.exec(content)) !== null) {
      matches.push({
        type: 'code-inline',
        match,
        content: match[1],
        raw: match[0]
      });
    }

    // Sort matches by their position in the text
    matches.sort((a, b) => a.match.index - b.match.index);

    // Build blocks from matches
    matches.forEach(matchItem => {
      const matchStart = matchItem.match.index;
      const matchEnd = matchStart + matchItem.raw.length;

      // Add text before this match if any
      if (currentIndex < matchStart) {
        const textContent = content.slice(currentIndex, matchStart);
        if (textContent.trim()) {
          blocks.push({
            id: `block-${blockId++}`,
            type: 'text',
            content: textContent,
            raw: textContent,
            metadata: {
              startIndex: currentIndex,
              endIndex: matchStart
            }
          });
        }
      }

      // Add the matched block
      blocks.push({
        id: `block-${blockId++}`,
        type: matchItem.type,
        content: matchItem.content,
        raw: matchItem.raw,
        metadata: {
          ...matchItem.metadata,
          startIndex: matchStart,
          endIndex: matchEnd
        }
      });

      currentIndex = matchEnd;
    });

    // Add remaining text after all matches
    if (currentIndex < content.length) {
      const textContent = content.slice(currentIndex);
      if (textContent.trim()) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'text',
          content: textContent,
          raw: textContent,
          metadata: {
            startIndex: currentIndex,
            endIndex: content.length
          }
        });
      }
    }

    // If no rich content found, return the entire content as a text block
    if (blocks.length === 0) {
      blocks.push({
        id: `block-${blockId++}`,
        type: 'text',
        content,
        raw: content,
        metadata: {
          startIndex: 0,
          endIndex: content.length
        }
      });
    }

    return blocks;
  }
} 