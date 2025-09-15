import React, { memo, useMemo, useState, useCallback, useRef } from 'react';

interface VirtualizedTextProps {
  content: string;
  height?: number;
  readOnly?: boolean;
  className?: string;
}

interface LineProps {
  line: string;
  readOnly: boolean;
}

const Line = memo(({ line, readOnly }: LineProps) => {
  return (
    <div
      style={{
        height: '20px',
        padding: '0 15px',
        fontFamily: "'Courier New', monospace",
        fontSize: '14px',
        lineHeight: '20px',
        color: readOnly ? '#ffffff' : '#000000',
        backgroundColor: 'transparent',
        whiteSpace: 'pre',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {line}
    </div>
  );
});

Line.displayName = 'Line';

export function VirtualizedText({ content, className, height, readOnly = false }: VirtualizedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // Ensure content is always a string and handle undefined/null cases
  const safeContent = content || '';
  
  const lines = useMemo(() => {
    if (!safeContent || typeof safeContent !== 'string') return [];
    return safeContent.split('\n');
  }, [safeContent]);
  
  const lineHeight = 20;
  const bufferSize = 10;
  
  // Get container height dynamically or use provided height
  const containerHeight = useMemo(() => {
    if (height && height > 0) return height;
    if (containerRef.current) {
      return containerRef.current.clientHeight;
    }
    return 400; // fallback
  }, [height, containerRef.current]);
  
  const visibleCount = Math.ceil(containerHeight / lineHeight);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferSize);
  const endIndex = Math.min(lines.length, startIndex + visibleCount + bufferSize * 2);
  
  const visibleLines = useMemo(() => {
    return lines.slice(startIndex, endIndex);
  }, [lines, startIndex, endIndex]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
  }, []);
  
  const offsetY = startIndex * lineHeight;

  const containerStyle: React.CSSProperties = {
    width: '100%',
    overflow: 'auto',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: readOnly ? '#1e1e1e' : '#ffffff',
    position: 'relative',
    boxSizing: 'border-box',
    flex: '1',
    minHeight: '200px'
  };

  // Only set fixed height if explicitly provided, otherwise use flex
  if (height && height > 0) {
    containerStyle.height = `${height}px`;
    containerStyle.minHeight = `${height}px`;
    containerStyle.maxHeight = `${height}px`;
    containerStyle.flex = 'none';
  }

  return (
    <div 
      ref={containerRef}
      className={className}
      style={containerStyle}
      onScroll={handleScroll}
    >
      {/* Virtual spacer for total content height */}
      <div style={{ 
        height: `${lines.length * lineHeight}px`, 
        position: 'relative',
        minHeight: '100%'
      }}>
        {/* Visible content container */}
        <div 
          style={{
            position: 'absolute',
            top: `${offsetY}px`,
            left: 0,
            right: 0,
            width: '100%'
          }}
        >
          {visibleLines.map((line, index) => (
            <Line
              key={startIndex + index}
              line={line || ' '}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </div>
  );
};