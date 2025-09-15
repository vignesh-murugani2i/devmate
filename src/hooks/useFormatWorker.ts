import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const useFormatWorker = () => {
  const formatText = useCallback(async (text: string, formatType: string): Promise<string> => {
    // For now, we'll keep the Tauri calls on the main thread
    // but use requestAnimationFrame to yield control back to the UI
    return new Promise((resolve, reject) => {
      // Use requestAnimationFrame to ensure UI updates before processing
      requestAnimationFrame(async () => {
        try {
          const result = await invoke('format_text', {
            text,
            formatType,
          });
          resolve(result as string);
        } catch (error) {
          reject(error);
        }
      });
    });
  }, []);

  const cleanup = useCallback(() => {
    // No cleanup needed for this implementation
  }, []);

  return { formatText, cleanup };
};