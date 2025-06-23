import React, { useMemo } from 'react';
import { VegaLite } from 'react-vega';

interface ChartRendererProps {
  spec: any; // Vega-Lite spec object
  width?: number;
  height?: number;
  className?: string;
  title?: string;
  actions?: boolean;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  spec,
  width = 600,
  height = 400,
  className = '',
  title,
  actions = false
}) => {
  const enhancedSpec = useMemo(() => {
    const baseSpec = {
      ...spec,
      width: spec.width || width,
      height: spec.height || height,
      config: {
        ...spec.config,
        // Apply consistent styling
        axis: {
          ...spec.config?.axis,
          labelFontSize: 12,
          titleFontSize: 14,
          grid: true,
          gridColor: '#e5e7eb',
          domainColor: '#6b7280'
        },
        legend: {
          ...spec.config?.legend,
          labelFontSize: 12,
          titleFontSize: 14
        },
        title: {
          ...spec.config?.title,
          fontSize: 16,
          fontWeight: 600,
          color: '#1f2937'
        }
      }
    };

    // Add title if provided
    if (title && !baseSpec.title) {
      baseSpec.title = title;
    }

    return baseSpec;
  }, [spec, width, height, title]);

  const handleError = (error: Error) => {
    console.error('Chart rendering error:', error);
  };

  return (
    <div className={`my-4 ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <VegaLite
          spec={enhancedSpec}
          actions={actions}
          onError={handleError}
          renderer="svg"
        />
      </div>
    </div>
  );
};

// Utility functions for creating common chart types
export const createBarChart = (
  data: Array<{ [key: string]: any }>,
  xField: string,
  yField: string,
  title?: string
) => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  title,
  mark: 'bar',
  data: { values: data },
  encoding: {
    x: {
      field: xField,
      type: 'nominal',
      axis: { title: xField }
    },
    y: {
      field: yField,
      type: 'quantitative',
      axis: { title: yField }
    },
    color: {
      value: '#3b82f6'
    }
  }
});

export const createLineChart = (
  data: Array<{ [key: string]: any }>,
  xField: string,
  yField: string,
  title?: string
) => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  title,
  mark: {
    type: 'line',
    point: true,
    strokeWidth: 2
  },
  data: { values: data },
  encoding: {
    x: {
      field: xField,
      type: 'temporal',
      axis: { title: xField }
    },
    y: {
      field: yField,
      type: 'quantitative',
      axis: { title: yField }
    },
    color: {
      value: '#3b82f6'
    }
  }
});

export const createScatterPlot = (
  data: Array<{ [key: string]: any }>,
  xField: string,
  yField: string,
  colorField?: string,
  title?: string
) => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  title,
  mark: {
    type: 'circle',
    size: 60
  },
  data: { values: data },
  encoding: {
    x: {
      field: xField,
      type: 'quantitative',
      axis: { title: xField }
    },
    y: {
      field: yField,
      type: 'quantitative',
      axis: { title: yField }
    },
    color: colorField ? {
      field: colorField,
      type: 'nominal',
      legend: { title: colorField }
    } : {
      value: '#3b82f6'
    }
  }
});

export const createPieChart = (
  data: Array<{ category: string; value: number }>,
  title?: string
) => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  title,
  mark: 'arc',
  data: { values: data },
  encoding: {
    theta: {
      field: 'value',
      type: 'quantitative'
    },
    color: {
      field: 'category',
      type: 'nominal',
      legend: { title: 'Category' }
    }
  },
  view: { stroke: null }
}); 