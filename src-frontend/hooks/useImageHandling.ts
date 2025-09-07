import { useCallback, useState } from 'react';
import { DragEvent as ReactDragEvent, ClipboardEvent as ReactClipboardEvent } from 'react';
import { logger } from '@/lib/logger';

interface UseImageHandlingProps {
  projectPath?: string;
  onPromptUpdate?: (updater: (current: string) => string) => void;
  onFocusTextarea?: () => void;
  onSetCursor?: (position: number) => void;
}

/**
 * Simple stub for image handling - minimal implementation
 * TODO: Implement full image handling functionality if needed
 */
export const useImageHandling = (props: UseImageHandlingProps) => {
  const [embeddedImages, setEmbeddedImages] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const handleImageUpload = useCallback((files: FileList) => {
    // Stub implementation - just log for now
    logger.warn('Image upload not implemented - files:', Array.from(files).map(f => f.name));
  }, []);

  const handleImagePaste = useCallback((e: ReactClipboardEvent) => {
    // Handle clipboard image paste
    if (e.clipboardData?.files.length) {
      logger.warn('Image paste not implemented - files:', Array.from(e.clipboardData.files).map(f => f.name));
      handleImageUpload(e.clipboardData.files);
    }
  }, [handleImageUpload]);

  const handleDrag = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: ReactDragEvent) => {
    e.preventDefault();
    setDragActive(false);
    // Handle file drops
    if (e.dataTransfer?.files) {
      handleImageUpload(e.dataTransfer.files);
    }
  }, [handleImageUpload]);

  const handlePaste = useCallback((e: ReactClipboardEvent) => {
    // Convert React clipboard event to regular ClipboardEvent for compatibility
    if (e.clipboardData?.files.length) {
      handleImageUpload(e.clipboardData.files);
    }
  }, [handleImageUpload]);

  const handleRemoveImage = useCallback((index: number, prompt?: string) => {
    setEmbeddedImages(prev => prev.filter((_, i) => i !== index));
    // If prompt is provided and we need to update it, we could call onPromptUpdate here
    // For now, just remove the image from the list
  }, []);

  const addImage = useCallback((imagePath: string, currentPrompt: string) => {
    const imageRef = `![Image](${imagePath})`;
    const newImage = { path: imagePath, name: imagePath.split('/').pop() || 'image' };
    setEmbeddedImages(prev => [...prev, newImage]);
    
    // Return updated prompt with image reference
    return currentPrompt + (currentPrompt ? '\n\n' : '') + imageRef;
  }, []);

  const extractImagePaths = useCallback((prompt?: string) => {
    // Extract image paths from prompt markdown syntax like ![Image](path/to/image.png)
    if (!prompt) return [];
    
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = [];
    let match;
    
    while ((match = imageRegex.exec(prompt)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }, []);

  return {
    embeddedImages,
    setEmbeddedImages,
    dragActive,
    handleImageUpload,
    handleImagePaste: handlePaste, // Use the React-compatible version
    handleDrag,
    handleDrop,
    handlePaste,
    handleRemoveImage,
    addImage,
    extractImagePaths,
    attachImageListeners: (element?: HTMLElement) => {
      // Stub - would attach drag/drop listeners to the element
    },
    detachImageListeners: (element?: HTMLElement) => {
      // Stub - would remove drag/drop listeners from the element  
    },
  };
};