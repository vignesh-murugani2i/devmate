import React, { useState, useRef, useCallback, useMemo } from 'react';
import { VirtualizedText } from './VirtualizedText';

interface EnhancedTextAreaProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  height?: number;
}

export function EnhancedTextArea({
  value,
  onChange,
  onBlur,
  placeholder,
  readOnly = false,
  className = '',
  height
}: EnhancedTextAreaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const isLargeContent = useMemo(() => {
    return value.length > 50000 || value.split('\n').length > 1000;
  }, [value]);

  const handleClick = useCallback(() => {
    if (!readOnly && isLargeContent) {
      setIsEditing(true);
    }
  }, [readOnly, isLargeContent]);

  const handleBlur = useCallback(() => {
    if (isEditing) {
      setIsEditing(false);
    }
  }, [isEditing]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  }, [onChange]);

  // For small content or when editing, use regular textarea
  if (!isLargeContent || isEditing || (!readOnly && !isLargeContent)) {
    const textAreaStyle: React.CSSProperties = {
      width: '100%',
      resize: 'none',
      overflow: 'auto',
      fontFamily: "'Courier New', monospace",
      fontSize: '14px',
      padding: '15px',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: readOnly ? '#1e1e1e' : '#ffffff',
      color: readOnly ? '#ffffff' : '#000000',
      boxSizing: 'border-box'
    };

    if (height) {
      textAreaStyle.height = `${height}px`;
      textAreaStyle.minHeight = `${height}px`;
      textAreaStyle.maxHeight = `${height}px`;
    } else {
      textAreaStyle.flex = '1';
      textAreaStyle.minHeight = '200px';
    }

    return (
      <textarea
        ref={textAreaRef}
        value={value}
        readOnly={readOnly}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoFocus={isEditing}
        style={textAreaStyle}
      />
    );
  }

  // For large read-only content, use virtualized display
  const wrapperStyle: React.CSSProperties = {
    cursor: readOnly ? 'default' : 'text',
    display: 'flex',
    flexDirection: 'column',
    flex: height ? 'none' : '1',
    height: height ? `${height}px` : undefined,
    minHeight: height ? undefined : '200px'
  };

  return (
    <div 
      onClick={handleClick} 
      style={wrapperStyle}
    >
      <VirtualizedText 
        content={value || ''} 
        className={className}
        height={height}
        readOnly={readOnly}
      />
    </div>
  );
};