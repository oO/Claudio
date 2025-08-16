import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { logger } from '@/lib/logger';

export interface UseImageHandlingOptions {
  projectPath?: string;
  onPromptUpdate?: (updater: (current: string) => string) => void;
  onFocusTextarea?: () => void;
  onSetCursor?: (position: number) => void;
}

export interface UseImageHandlingReturn {
  embeddedImages: string[];
  setEmbeddedImages: (images: string[]) => void;
  dragActive: boolean;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleRemoveImage: (index: number, currentPrompt: string) => void;
  addImage: (imagePath: string, currentPrompt: string) => string;
  extractImagePaths: (text: string) => string[];
}

/**
 * Custom hook for managing image handling (drag-drop, paste, display)
 */
export const useImageHandling = ({
  projectPath,
  onPromptUpdate,
  onFocusTextarea,
  onSetCursor,
}: UseImageHandlingOptions): UseImageHandlingReturn => {
  const [embeddedImages, setEmbeddedImages] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const unlistenDragDropRef = useRef<(() => void) | null>(null);

  // Helper function to check if a file is an image
  const isImageFile = useCallback((path: string): boolean => {
    // Check if it's a data URL
    if (path.startsWith('data:image/')) {
      return true;
    }
    // Otherwise check file extension
    const ext = path.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext || '');
  }, []);

  // Extract image paths from prompt text
  const extractImagePaths = useCallback((text: string): string[] => {
    
    // Updated regex to handle both quoted and unquoted paths
    // Pattern 1: @"path with spaces or data URLs" - quoted paths
    // Pattern 2: @path - unquoted paths (continues until @ or end)
    const quotedRegex = /@"([^"]+)"/g;
    const unquotedRegex = /@([^@\n\s]+)/g;
    
    const pathsSet = new Set<string>(); // Use Set to ensure uniqueness
    
    // First, extract quoted paths (including data URLs)
    let matches = Array.from(text.matchAll(quotedRegex));
    
    for (const match of matches) {
      const path = match[1]; // No need to trim, quotes preserve exact path
      
      // For data URLs, use as-is; for file paths, convert to absolute
      const fullPath = path.startsWith('data:') 
        ? path 
        : (path.startsWith('/') ? path : (projectPath ? `${projectPath}/${path}` : path));
      
      if (isImageFile(fullPath)) {
        pathsSet.add(fullPath);
      }
    }
    
    // Remove quoted mentions from text to avoid double-matching
    let textWithoutQuoted = text.replace(quotedRegex, '');
    
    // Then extract unquoted paths (typically file paths)
    matches = Array.from(textWithoutQuoted.matchAll(unquotedRegex));
    
    for (const match of matches) {
      const path = match[1].trim();
      // Skip if it looks like a data URL fragment (shouldn't happen with proper quoting)
      if (path.includes('data:')) continue;
      
      
      // Convert relative path to absolute if needed
      const fullPath = path.startsWith('/') ? path : (projectPath ? `${projectPath}/${path}` : path);
      
      if (isImageFile(fullPath)) {
        pathsSet.add(fullPath);
      }
    }

    const uniquePaths = Array.from(pathsSet);
    return uniquePaths;
  }, [projectPath, isImageFile]);

  // Add image to prompt
  const addImage = useCallback((imagePath: string, currentPrompt: string): string => {
    const existingPaths = extractImagePaths(currentPrompt);
    if (existingPaths.includes(imagePath)) {
      return currentPrompt; // Image already added
    }

    // Wrap path in quotes if it contains spaces
    const mention = imagePath.includes(' ') ? `@"${imagePath}"` : `@${imagePath}`;
    const newPrompt = currentPrompt + (currentPrompt.endsWith(' ') || currentPrompt === '' ? '' : ' ') + mention + ' ';

    // Focus the textarea and set cursor
    setTimeout(() => {
      onFocusTextarea?.();
      onSetCursor?.(newPrompt.length);
    }, 0);

    return newPrompt;
  }, [extractImagePaths, onFocusTextarea, onSetCursor]);

  // Remove image from prompt
  const handleRemoveImage = useCallback((index: number, currentPrompt: string) => {
    const imagePath = embeddedImages[index];
    
    // For data URLs, we need to handle them specially since they're always quoted
    if (imagePath.startsWith('data:')) {
      // Simply remove the exact quoted data URL
      const quotedPath = `@"${imagePath}"`;
      const newPrompt = currentPrompt.replace(quotedPath, '').trim();
      onPromptUpdate?.(() => newPrompt);
      return;
    }
    
    // For file paths, use the original logic
    const escapedPath = imagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedRelativePath = imagePath.replace(projectPath + '/', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create patterns for both quoted and unquoted mentions
    const patterns = [
      // Quoted full path
      new RegExp(`@"${escapedPath}"\\s?`, 'g'),
      // Unquoted full path
      new RegExp(`@${escapedPath}\\s?`, 'g'),
      // Quoted relative path
      new RegExp(`@"${escapedRelativePath}"\\s?`, 'g'),
      // Unquoted relative path
      new RegExp(`@${escapedRelativePath}\\s?`, 'g')
    ];

    let newPrompt = currentPrompt;
    for (const pattern of patterns) {
      newPrompt = newPrompt.replace(pattern, '');
    }

    onPromptUpdate?.(() => newPrompt.trim());
  }, [embeddedImages, projectPath, onPromptUpdate]);

  // Tauri drag-drop setup
  useEffect(() => {
    let lastDropTime = 0;

    const setupListener = async () => {
      try {
        // If a listener from a previous mount/render is still around, clean it up.
        if (unlistenDragDropRef.current) {
          unlistenDragDropRef.current();
        }

        const webview = getCurrentWebviewWindow();
        unlistenDragDropRef.current = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setDragActive(true);
          } else if (event.payload.type === 'leave') {
            setDragActive(false);
          } else if (event.payload.type === 'drop' && event.payload.paths) {
            setDragActive(false);

            const currentTime = Date.now();
            if (currentTime - lastDropTime < 200) {
              // This debounce is crucial to handle the storm of drop events
              // that Tauri/OS can fire for a single user action.
              return;
            }
            lastDropTime = currentTime;

            const droppedPaths = event.payload.paths as string[];
            const imagePaths = droppedPaths.filter(isImageFile);

            if (imagePaths.length > 0 && onPromptUpdate) {
              onPromptUpdate(currentPrompt => {
                const existingPaths = extractImagePaths(currentPrompt);
                const newPaths = imagePaths.filter(p => !existingPaths.includes(p));

                if (newPaths.length === 0) {
                  return currentPrompt; // All dropped images are already in the prompt
                }

                // Wrap paths with spaces in quotes for clarity
                const mentionsToAdd = newPaths.map(p => {
                  // If path contains spaces, wrap in quotes
                  if (p.includes(' ')) {
                    return `@"${p}"`;
                  }
                  return `@${p}`;
                }).join(' ');
                const newPrompt = currentPrompt + (currentPrompt.endsWith(' ') || currentPrompt === '' ? '' : ' ') + mentionsToAdd + ' ';

                setTimeout(() => {
                  onFocusTextarea?.();
                  onSetCursor?.(newPrompt.length);
                }, 0);

                return newPrompt;
              });
            }
          }
        });
      } catch (error) {
        logger.error('Failed to set up Tauri drag-drop listener:', error);
      }
    };

    setupListener();

    return () => {
      // On unmount, ensure we clean up the listener.
      if (unlistenDragDropRef.current) {
        unlistenDragDropRef.current();
        unlistenDragDropRef.current = null;
      }
    };
  }, [isImageFile, extractImagePaths, onPromptUpdate, onFocusTextarea, onSetCursor]);

  // Browser drag and drop handlers - just prevent default behavior
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Visual feedback is handled by Tauri events
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // File processing is handled by Tauri's onDragDropEvent
  }, []);

  // Handle paste events for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        // Get the image blob
        const blob = item.getAsFile();
        if (!blob) continue;

        try {
          // Convert blob to base64
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = reader.result as string;
            
            // Add the base64 data URL directly to the prompt
            onPromptUpdate?.(currentPrompt => {
              // Use the data URL directly as the image reference
              const mention = `@"${base64Data}"`;
              const newPrompt = currentPrompt + (currentPrompt.endsWith(' ') || currentPrompt === '' ? '' : ' ') + mention + ' ';
              
              // Focus the textarea and move cursor to end
              setTimeout(() => {
                onFocusTextarea?.();
                onSetCursor?.(newPrompt.length);
              }, 0);

              return newPrompt;
            });
          };
          
          reader.readAsDataURL(blob);
        } catch (error) {
          logger.error('Failed to paste image:', error);
        }
      }
    }
  }, [onPromptUpdate, onFocusTextarea, onSetCursor]);

  return {
    embeddedImages,
    setEmbeddedImages,
    dragActive,
    handleDrag,
    handleDrop,
    handlePaste,
    handleRemoveImage,
    addImage,
    extractImagePaths,
  };
};