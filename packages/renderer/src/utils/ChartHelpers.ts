import { createLineChart, createBarChart } from '../components/ChartRenderer';

export class ChartHelpers {
  // Generate Fibonacci sequence data
  static generateFibonacciData(start: number = 0, end: number = 10): Array<{n: number, value: number}> {
    const data: Array<{n: number, value: number}> = [];
    let a = 0, b = 1;
    
    for (let i = start; i <= end; i++) {
      if (i === 0) {
        data.push({ n: i, value: 0 });
      } else if (i === 1) {
        data.push({ n: i, value: 1 });
      } else {
        const next = a + b;
        data.push({ n: i, value: next });
        a = b;
        b = next;
      }
    }
    
    return data;
  }
  
  // Create Fibonacci chart block
  static createFibonacciChart(start: number = 0, end: number = 10): string {
    const data = this.generateFibonacciData(start, end);
    const chartSpec = createLineChart(data, 'n', 'value', `Fibonacci Sequence from n=${start} to n=${end}`);
    return `<!--pixell:block:chart-->${JSON.stringify(chartSpec)}<!--/pixell:block-->`;
  }
  
  // Create performance comparison chart
  static createPerformanceChart(): string {
    const data = [
      { method: 'Recursive', time: 89.2 },
      { method: 'Iterative', time: 0.001 },
      { method: 'Memoized', time: 0.01 },
      { method: 'Matrix', time: 0.005 }
    ];
    const chartSpec = createBarChart(data, 'method', 'time', 'Algorithm Performance Comparison');
    return `<!--pixell:block:chart-->${JSON.stringify(chartSpec)}<!--/pixell:block-->`;
  }
  
  // Create generic line chart
  static createLineChartBlock(
    data: Array<{[key: string]: any}>, 
    xField: string, 
    yField: string, 
    title?: string
  ): string {
    const chartSpec = createLineChart(data, xField, yField, title);
    return `<!--pixell:block:chart-->${JSON.stringify(chartSpec)}<!--/pixell:block-->`;
  }
  
  // Create generic bar chart
  static createBarChartBlock(
    data: Array<{[key: string]: any}>, 
    xField: string, 
    yField: string, 
    title?: string
  ): string {
    const chartSpec = createBarChart(data, xField, yField, title);
    return `<!--pixell:block:chart-->${JSON.stringify(chartSpec)}<!--/pixell:block-->`;
  }
} 