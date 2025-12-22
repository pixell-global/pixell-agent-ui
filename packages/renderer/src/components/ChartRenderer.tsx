import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ChartRendererProps {
  spec: any; // Chart spec object (adapted for Recharts)
  width?: number;
  height?: number;
  className?: string;
  title?: string;
  actions?: boolean;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'
];

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  spec,
  width = 600,
  height = 400,
  className = '',
  title,
  actions = false
}) => {
  const chartConfig = useMemo(() => {
    // Determine chart type from spec
    const chartType = spec.mark?.type || spec.mark || 'bar';
    const data = spec.data?.values || [];
    
    return {
      type: chartType,
      data,
      width,
      height,
      title: title || spec.title
    };
  }, [spec, width, height, title]);

  const renderChart = () => {
    const { type, data } = chartConfig;

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey={spec.encoding?.x?.field}
                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
              />
              <Tooltip contentStyle={{ backgroundColor: '#272323', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.9)' }} />
              <Bar
                dataKey={spec.encoding?.y?.field}
                fill={spec.encoding?.color?.value || '#DCFB24'}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey={spec.encoding?.x?.field}
                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
              />
              <Tooltip contentStyle={{ backgroundColor: '#272323', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.9)' }} />
              <Line
                type="monotone"
                dataKey={spec.encoding?.y?.field}
                stroke={spec.encoding?.color?.value || '#DCFB24'}
                strokeWidth={2}
                dot={{ r: 4, fill: '#DCFB24' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'circle':
      case 'point':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey={spec.encoding?.x?.field}
                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
              />
              <YAxis
                dataKey={spec.encoding?.y?.field}
                tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
              />
              <Tooltip contentStyle={{ backgroundColor: '#272323', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.9)' }} />
              <Scatter
                dataKey={spec.encoding?.y?.field}
                fill={spec.encoding?.color?.value || '#DCFB24'}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'arc':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(width, height) / 4}
                dataKey={spec.encoding?.theta?.field || 'value'}
                nameKey={spec.encoding?.color?.field || 'category'}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#272323', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.9)' }} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-32 text-white/50">
            Unsupported chart type: {type}
          </div>
        );
    }
  };

  return (
    <div className={`my-4 ${className}`}>
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        {chartConfig.title && (
          <h3 className="text-lg font-semibold text-white/90 mb-4 text-center">
            {chartConfig.title}
          </h3>
        )}
        {renderChart()}
      </div>
    </div>
  );
};

// Utility functions for creating common chart types (adapted for Recharts)
export const createBarChart = (
  data: Array<{ [key: string]: any }>,
  xField: string,
  yField: string,
  title?: string
) => ({
  mark: 'bar',
  data: { values: data },
  encoding: {
    x: { field: xField },
    y: { field: yField },
    color: { value: '#3b82f6' }
  },
  title
});

export const createLineChart = (
  data: Array<{ [key: string]: any }>,
  xField: string,
  yField: string,
  title?: string
) => ({
  mark: 'line',
  data: { values: data },
  encoding: {
    x: { field: xField },
    y: { field: yField },
    color: { value: '#3b82f6' }
  },
  title
});

export const createScatterPlot = (
  data: Array<{ [key: string]: any }>,
  xField: string,
  yField: string,
  colorField?: string,
  title?: string
) => ({
  mark: 'circle',
  data: { values: data },
  encoding: {
    x: { field: xField },
    y: { field: yField },
    color: colorField ? { field: colorField } : { value: '#3b82f6' }
  },
  title
});

export const createPieChart = (
  data: Array<{ category: string; value: number }>,
  title?: string
) => ({
  mark: 'arc',
  data: { values: data },
  encoding: {
    theta: { field: 'value' },
    color: { field: 'category' }
  },
  title
}); 