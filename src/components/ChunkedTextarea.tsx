// filepath: /home/vignesh/Documents/DevMate/src/components/ChunkedTextarea.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";

interface ChunkedTextareaProps {
  contentType: 'raw' | 'formatted';
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  onManualChange?: (value: string) => void; // For base64 manual editing
  manualValue?: string; // For base64 manual content
  isManualMode?: boolean; // Whether this is in manual editing mode (base64)
  onCopyAll?: () => void; // Callback to copy all content
}

interface ContentChunk {
  chunk: string;
  has_more: boolean;
  total_length: number;
  next_start: number;
}

const ChunkedTextarea: React.FC<ChunkedTextareaProps> = ({
  contentType,
  placeholder,
  className,
  readOnly = false,
  onManualChange,
  manualValue = '',
  isManualMode = false,
  onCopyAll
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(0);
  const [totalLength, setTotalLength] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingRef = useRef(false);
  
  const CHUNK_SIZE = 10000; // 10KB chunks

  const loadInitialContent = useCallback(async () => {
    if (isManualMode) return;
    
    try {
      setIsLoading(true);
      
      // First check if there's content available
      const info = await invoke('get_content_info') as any;
      const hasContent = contentType === 'raw' ? info.has_raw : info.has_formatted;
      
      if (!hasContent) {
        setDisplayedContent('');
        setHasMore(false);
        setNextStart(0);
        setTotalLength(0);
        return;
      }
      
      const result = await invoke('get_content_chunk', {
        contentType,
        start: 0,
        chunkSize: CHUNK_SIZE
      }) as ContentChunk;
      
      setDisplayedContent(result.chunk);
      setHasMore(result.has_more);
      setNextStart(result.next_start);
      setTotalLength(result.total_length);
    } catch (error) {
      console.error('Failed to load initial content:', error);
      setDisplayedContent('');
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [contentType, isManualMode]);

  const loadMoreContent = useCallback(async () => {
    if (!hasMore || loadingRef.current || isManualMode) return;
    
    try {
      loadingRef.current = true;
      setIsLoading(true);
      
      const result = await invoke('get_content_chunk', {
        contentType,
        start: nextStart,
        chunkSize: CHUNK_SIZE
      }) as ContentChunk;
      
      setDisplayedContent(prev => prev + result.chunk);
      setHasMore(result.has_more);
      setNextStart(result.next_start);
    } catch (error) {
      console.error('Failed to load more content:', error);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [contentType, hasMore, nextStart, isManualMode]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = textarea;
    
    // Load more content when scrolled near the bottom
    const threshold = 100; // pixels from bottom
    if (scrollHeight - scrollTop - clientHeight < threshold && hasMore && !isLoading) {
      loadMoreContent();
    }
  }, [hasMore, isLoading, loadMoreContent]);

  // Load initial content when contentType changes or component mounts
  useEffect(() => {
    if (!isManualMode) {
      loadInitialContent();
    }
  }, [loadInitialContent]);

  // Reset when switching between content types
  useEffect(() => {
    if (!isManualMode) {
      setDisplayedContent('');
      setNextStart(0);
      setHasMore(false);
      setTotalLength(0);
      loadInitialContent();
    }
  }, [contentType, isManualMode, loadInitialContent]);

  const handleManualChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onManualChange) {
      onManualChange(e.target.value);
    }
  };

  const copyAllContent = useCallback(async () => {
    if (isManualMode || !onCopyAll) return;
    
    try {
      // Get all content from backend
      const info = await invoke('get_content_info') as any;
      const hasContent = contentType === 'raw' ? info.has_raw : info.has_formatted;
      
      if (!hasContent) return;
      
      // Get the full content in one request
      const result = await invoke('get_content_chunk', {
        contentType,
        start: 0,
        chunkSize: info[contentType === 'raw' ? 'raw_length' : 'formatted_length']
      }) as ContentChunk;
      
      await navigator.clipboard.writeText(result.chunk);
      onCopyAll(); // Notify parent that copy completed
    } catch (error) {
      console.error('Failed to copy all content:', error);
    }
  }, [contentType, isManualMode, onCopyAll]);

  // Expose copy function to parent
  useEffect(() => {
    if (onCopyAll && !isManualMode) {
      (window as any)[`copyChunked_${contentType}`] = copyAllContent;
    }
  }, [copyAllContent, contentType, isManualMode, onCopyAll]);

  const currentValue = isManualMode ? manualValue : displayedContent;
  const showLoadingIndicator = isLoading && hasMore && displayedContent.length > 0;

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={handleManualChange}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={className}
        readOnly={!isManualMode && readOnly}
        style={{ 
          width: '100%', 
          height: '100%',
          resize: 'none'
        }}
      />
      {showLoadingIndicator && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none'
        }}>
          Loading more...
        </div>
      )}
      {!isManualMode && totalLength > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.1)',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '11px',
          color: '#666',
          pointerEvents: 'none'
        }}>
          {Math.round(displayedContent.length / totalLength * 100)}% loaded
        </div>
      )}
    </div>
  );
};

export default ChunkedTextarea;