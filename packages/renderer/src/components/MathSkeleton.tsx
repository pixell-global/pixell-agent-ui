import React from 'react';

interface MathSkeletonProps {
  isInline?: boolean;
  width?: string;
}

export const MathSkeleton: React.FC<MathSkeletonProps> = ({
  isInline = false,
  width = '6rem'
}) => {
  const baseClasses = 'math-skeleton';
  const containerClasses = isInline ? 'math-inline' : 'math-block';
  
  return (
    <div className={containerClasses} style={{ width: width }}>
      <div className={baseClasses} style={{ height: isInline ? '1.2rem' : '2rem' }}>
        {/* Optional: Add a subtle loading indicator */}
        <span className="sr-only">Loading math expression...</span>
      </div>
    </div>
  );
}; 