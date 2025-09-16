import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ContentChunk {
  chunk_index: number;
  content: string;
  total_chunks: number;
  is_last_chunk: boolean;
}

interface FileMetadata {
  total_lines: number;
  total_size: number;
  total_chunks: number;
  chunk_size: number;
}

export const useChunkedContent = () => {
  const [chunks, setChunks] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const [currentContentId, setCurrentContentId] = useState<string>('');
  const loadedChunksRef = useRef<Set<number>>(new Set());

  // Load file content into backend
  const loadFileContent = useCallback(async (content: string, contentId?: string) => {
    const id = contentId || `content_${Date.now()}`;
    setIsLoading(true);
    setChunks([]);
    setMetadata(null);
    loadedChunksRef.current.clear();

    try {
      // Store content in backend
      const meta: FileMetadata = await invoke('load_file_content', {
        content,
        contentId: id,
        chunkSize: 50000
      });

      setMetadata(meta);
      setCurrentContentId(id);

      // Load first chunk
      if (meta.total_chunks > 0) {
        const firstChunk: ContentChunk = await invoke('get_content_chunk', {
          contentId: id,
          chunkIndex: 0
        });

        setChunks([firstChunk.content]);
        loadedChunksRef.current.add(0);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }

    return id;
  }, []);

  // Format content and store in backend
  const formatContent = useCallback(async (contentId: string, formatType: string, formattedContentId?: string) => {
    const id = formattedContentId || `formatted_${Date.now()}`;
    setIsLoading(true);
    setChunks([]);
    setMetadata(null);
    loadedChunksRef.current.clear();

    try {
      // Format and store content in backend
      const meta: FileMetadata = await invoke('format_and_store_content', {
        contentId,
        formattedContentId: id,
        formatType,
        chunkSize: 50000
      });

      setMetadata(meta);
      setCurrentContentId(id);

      // Load first chunk of formatted content
      if (meta.total_chunks > 0) {
        const firstChunk: ContentChunk = await invoke('get_content_chunk', {
          contentId: id,
          chunkIndex: 0
        });

        setChunks([firstChunk.content]);
        loadedChunksRef.current.add(0);
      }
    } catch (error) {
      console.error('Error formatting content:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }

    return id;
  }, []);

  // Load more chunks when scrolling
  const loadMoreChunks = useCallback(async (startIndex: number, count: number = 1) => {
    if (!metadata || !currentContentId || isLoadingChunk) return;

    setIsLoadingChunk(true);
    const newChunks: string[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const chunkIndex = startIndex + i;
        
        if (chunkIndex >= metadata.total_chunks || loadedChunksRef.current.has(chunkIndex)) {
          continue;
        }

        const chunk: ContentChunk = await invoke('get_content_chunk', {
          contentId: currentContentId,
          chunkIndex
        });

        newChunks.push(chunk.content);
        loadedChunksRef.current.add(chunkIndex);
      }

      if (newChunks.length > 0) {
        setChunks(prev => [...prev, ...newChunks]);
      }
    } catch (error) {
      console.error('Error loading chunks:', error);
    } finally {
      setIsLoadingChunk(false);
    }
  }, [metadata, currentContentId, isLoadingChunk]);

  // Clear content from backend
  const clearContent = useCallback(async (contentId?: string) => {
    const id = contentId || currentContentId;
    if (!id) return;

    try {
      await invoke('clear_content', { contentId: id });
      setChunks([]);
      setMetadata(null);
      loadedChunksRef.current.clear();
      if (contentId === currentContentId) {
        setCurrentContentId('');
      }
    } catch (error) {
      console.error('Error clearing content:', error);
    }
  }, [currentContentId]);

  // Get combined content (for display)
  const getCombinedContent = useCallback(() => {
    return chunks.join('');
  }, [chunks]);

  // Check if all chunks are loaded
  const isAllContentLoaded = useCallback(() => {
    return metadata ? loadedChunksRef.current.size === metadata.total_chunks : false;
  }, [metadata]);

  return {
    chunks,
    metadata,
    isLoading,
    isLoadingChunk,
    currentContentId,
    loadFileContent,
    formatContent,
    loadMoreChunks,
    clearContent,
    getCombinedContent,
    isAllContentLoaded,
    loadedChunksCount: loadedChunksRef.current.size
  };
};