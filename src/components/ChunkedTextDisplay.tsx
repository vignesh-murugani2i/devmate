import { useEffect, useRef, useCallback } from 'react';

interface ChunkedTextDisplayProps {
  content: string;
  isLoading: boolean;
  isLoadingChunk: boolean;
  onLoadMore: () => void;
  isAllLoaded: boolean;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export const ChunkedTextDisplay = ({
  content,
  isLoading,
  isLoadingChunk,
  onLoadMore,
  isAllLoaded,
  placeholder,
  className = '',
  readOnly = true,
  onChange
}: ChunkedTextDisplayProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingThreshold = 0.8; // Load more when 80% scrolled

  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || isLoadingChunk || isAllLoaded) return;

    const { scrollTop, scrollHeight, clientHeight } = textarea;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage >= loadingThreshold) {
      onLoadMore();
    }
  }, [isLoadingChunk, isAllLoaded, onLoadMore, loadingThreshold]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  if (isLoading) {
    return (
      <div className={`chunked-text-loading ${className}`}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '300px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <div style={{ color: '#666', fontSize: '14px' }}>
            Processing content...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontFamily: 'Monaco, "Lucida Console", monospace',
          fontSize: '12px',
          lineHeight: '1.4',
          resize: 'none',
          outline: 'none'
        }}
      />
      
      {isLoadingChunk && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '8px'
          }} />
          Loading more...
        </div>
      )}
      
      {!isAllLoaded && !isLoadingChunk && content && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          Scroll down for more content
        </div>
      )}
    </div>
  );
};