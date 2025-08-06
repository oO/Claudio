import { useEffect, useRef } from "react";

export interface UseAutoResizeOptions {
  minHeight?: number;
  maxHeight?: number;
  value?: string;
}

export interface UseAutoResizeReturn {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Custom hook for auto-resizing textarea based on content
 */
export const useAutoResize = ({
  minHeight = 44,
  maxHeight = 120,
  value = "",
}: UseAutoResizeOptions = {}): UseAutoResizeReturn => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the natural scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate the new height
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    
    // Set the new height
    textarea.style.height = `${newHeight}px`;
  }, [value, minHeight, maxHeight]);

  return {
    textareaRef,
  };
};