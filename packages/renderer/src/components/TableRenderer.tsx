import React from 'react';

interface TableData {
  headers?: string[];
  rows: (string | number | boolean | null)[][];
  caption?: string;
  className?: string;
}

interface TableRendererProps {
  data: TableData;
  striped?: boolean;
  bordered?: boolean;
  hover?: boolean;
  compact?: boolean;
  className?: string;
}

export const TableRenderer: React.FC<TableRendererProps> = ({
  data,
  striped = true,
  bordered = true,
  hover = true,
  compact = false,
  className = ''
}) => {
  const { headers, rows, caption } = data;

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 my-4">
        <div className="text-white/50 text-sm">No table data available</div>
      </div>
    );
  }

  const cellPadding = compact ? 'px-3 py-2' : 'px-6 py-4';

  return (
    <div className={`overflow-x-auto my-4 ${className}`}>
      {caption && (
        <div className="text-sm text-white/70 mb-2 font-medium">{caption}</div>
      )}
      <table className={`min-w-full divide-y divide-white/10 ${
        bordered ? 'border border-white/10 rounded-lg' : ''
      }`}>
        {headers && headers.length > 0 && (
          <thead className="bg-white/5">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className={`${cellPadding} text-left text-xs font-medium text-white/70 uppercase tracking-wider`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className={`bg-transparent ${striped ? 'divide-y divide-white/10' : ''}`}>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${hover ? 'hover:bg-white/5' : ''} ${
                striped && rowIndex % 2 === 1 ? 'bg-white/[0.02]' : ''
              } transition-colors`}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`${cellPadding} whitespace-nowrap text-sm text-white/90`}
                >
                  {cell !== null && cell !== undefined ? String(cell) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 