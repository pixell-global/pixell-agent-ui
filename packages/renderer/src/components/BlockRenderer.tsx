import React from 'react';
import { BlockRendererProps, RenderBlock } from '../types';
import { ChartRenderer } from './ChartRenderer';
import { TableRenderer } from './TableRenderer';

export const BlockRenderer: React.FC<BlockRendererProps> = ({ node, ...props }) => {
  const blockData = extractBlockData(node);
  
  if (!blockData) {
    return <div {...props} />;
  }

  // Render different block types
  switch (blockData.type) {
    case 'chart':
      return (
        <ChartRenderer
          spec={blockData.payload}
          className="pixell-block-chart"
        />
      );
      
    case 'table':
      return (
        <TableRenderer
          data={blockData.payload}
          className="pixell-block-table"
        />
      );
      
    case 'button':
      return (
        <div className="my-4 pixell-block-button">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            onClick={() => blockData.payload.action && blockData.payload.action()}
          >
            {blockData.payload.label || 'Click me'}
          </button>
        </div>
      );
      
    default:
      // Fallback renderer for unknown block types
      return (
        <div className="my-4 pixell-block-container">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-2 font-mono">
              Block type: {blockData.type}
            </div>
            <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded">
              {JSON.stringify(blockData.payload, null, 2)}
            </pre>
          </div>
        </div>
      );
  }
};

function extractBlockData(node: any): RenderBlock | null {
  try {
    // Extract from HTML comments: <!--pixell:block:chart-->{"spec": {...}}<!--/pixell:block-->
    const content = node?.data || '';
    const match = content.match(/<!--pixell:block:(\w+)-->([\s\S]*?)<!--\/pixell:block-->/);
    
    if (match) {
      const [, type, payload] = match;
      return {
        type: type as any,
        payload: JSON.parse(payload),
        metadata: {}
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to extract block data:', error);
    return null;
  }
} 