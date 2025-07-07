import { createLineChart, createBarChart } from '../components/ChartRenderer';

interface GraphHint {
  type: 'fibonacci' | 'sequence' | 'comparison' | 'generic';
  data?: any[];
  title?: string;
  xField?: string;
  yField?: string;
}

export class ContentPostProcessor {
  // Detect if content mentions graphing/plotting and extract hints
  static detectGraphingIntent(content: string): GraphHint | null {
    const lowerContent = content.toLowerCase();
    
    // Check for Fibonacci sequence graphing
    if (lowerContent.includes('fibonacci') && 
        (lowerContent.includes('graph') || lowerContent.includes('plot') || lowerContent.includes('chart'))) {
      
      // Extract range if mentioned (e.g., "n=0 to n=10")
      const rangeMatch = content.match(/n\s*=\s*(\d+)\s*to\s*n\s*=\s*(\d+)/i);
      const start = rangeMatch ? parseInt(rangeMatch[1]) : 0;
      const end = rangeMatch ? parseInt(rangeMatch[2]) : 10;
      
      const fibData = this.generateFibonacciData(start, end);
      
      return {
        type: 'fibonacci',
        data: fibData,
        title: `Fibonacci Sequence from n=${start} to n=${end}`,
        xField: 'n',
        yField: 'value'
      };
    }
    
    // Check for performance comparison
    if (lowerContent.includes('performance') && lowerContent.includes('comparison') &&
        (lowerContent.includes('graph') || lowerContent.includes('plot') || lowerContent.includes('chart'))) {
      
      const perfData = [
        { method: 'Recursive', time: 89.2 },
        { method: 'Iterative', time: 0.001 },
        { method: 'Memoized', time: 0.01 },
        { method: 'Matrix', time: 0.005 }
      ];
      
      return {
        type: 'comparison',
        data: perfData,
        title: 'Algorithm Performance Comparison',
        xField: 'method',
        yField: 'time'
      };
    }
    
    return null;
  }
  
  // Generate Fibonacci sequence data
  static generateFibonacciData(start: number = 0, end: number = 10): Array<{n: number, value: number}> {
    const data: Array<{n: number, value: number}> = [];
    let prev = 0, curr = 1;
    
    for (let i = start; i <= end; i++) {
      if (i === 0) {
        data.push({ n: i, value: 0 });
      } else if (i === 1) {
        data.push({ n: i, value: 1 });
      } else {
        const next = prev + curr;
        data.push({ n: i, value: next });
        prev = curr;
        curr = next;
      }
    }
    
    return data;
  }
  
  // Auto-enhance content with chart blocks
  static enhanceContentWithCharts(content: string): string {
    const graphHint = this.detectGraphingIntent(content);
    
    if (!graphHint) return content;
    
    let chartSpec;
    
    switch (graphHint.type) {
      case 'fibonacci':
        chartSpec = createLineChart(
          graphHint.data!,
          graphHint.xField!,
          graphHint.yField!,
          graphHint.title
        );
        break;
        
      case 'comparison':
        chartSpec = createBarChart(
          graphHint.data!,
          graphHint.xField!,
          graphHint.yField!,
          graphHint.title
        );
        break;
        
      default:
        return content;
    }
    
    // Insert chart block after the content
    const chartBlock = `\n\n<!--pixell:block:chart-->${JSON.stringify(chartSpec)}<!--/pixell:block-->\n\n`;
    
    // Find a good place to insert the chart (after explaining the code, before conclusion)
    const insertionPoints = [
      /(\n\s*Make sure you have.*?installed.*?\n)/i,
      /(\n\s*You can install it using.*?\n)/i,
      /(\n\s*The script uses.*?\n)/i,
      /(\n\s*Explanation:\s*\n)/i,
      /(\n\s*Output:\s*\n)/i
    ];
    
    for (const pattern of insertionPoints) {
      if (pattern.test(content)) {
        return content.replace(pattern, `$1${chartBlock}`);
      }
    }
    
    // If no good insertion point found, append at the end
    return content + chartBlock;
  }
  
  // Enhance mathematical expressions in content
  static enhanceMathExpressions(content: string): string {
    // Simple and robust approach: square brackets first, then careful parentheses handling
    let processed = content;
    
    // First: Square bracket math expressions - most common LaTeX pattern  
    processed = processed.replace(/\[\s*([^\[\]]*)\s*\]/g, (match, group1) => `$$${group1} $$`);
    
    // Second: Only process parentheses that are NOT already inside $...$ delimiters
    // Split by $ to avoid processing content that's already LaTeX
    const parts = processed.split('$');
    for (let i = 0; i < parts.length; i += 2) { // Only process non-LaTeX parts (even indices)
      parts[i] = parts[i]
        .replace(/\(\s*(n\s*=\s*[0-9]+)\s*\)/g, (match, group1) => `$${group1}$`)
        .replace(/\(\s*(n\s*>\s*[0-9]+)\s*\)/g, (match, group1) => `$${group1}$`)
        .replace(/\(\s*([a-zA-Z]\s*[=><]\s*[0-9]+)\s*\)/g, (match, group1) => `$${group1}$`);
    }
    
    return parts.join('$');
  }
  
  // Main processing function
  static processContent(content: string): string {
    let processed = content;
    
    // First enhance math expressions
    processed = this.enhanceMathExpressions(processed);
    
    // Then add charts if needed
    processed = this.enhanceContentWithCharts(processed);
    
    return processed;
  }
} 