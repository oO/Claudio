import { useState, useCallback } from "react";
import { type FileEntry } from "@/lib/api";

export interface UseFilePickerOptions {
  projectPath?: string;
  onFileSelect?: (entry: FileEntry, insertPosition: number) => void;
}

export interface UseFilePickerReturn {
  showFilePicker: boolean;
  filePickerQuery: string;
  setFilePickerQuery: (query: string) => void;
  openFilePicker: (position: number, query?: string) => void;
  closeFilePicker: () => void;
  handleFileSelect: (entry: FileEntry) => void;
  detectAtSymbol: (text: string, newCursorPosition: number, oldText: string) => boolean;
}

/**
 * Custom hook for managing file picker functionality with @ mentions
 */
export const useFilePicker = ({
  projectPath,
  onFileSelect,
}: UseFilePickerOptions = {}): UseFilePickerReturn => {
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState("");
  const [insertPosition, setInsertPosition] = useState(0);

  const openFilePicker = useCallback((position: number, query = "") => {
    setShowFilePicker(true);
    setFilePickerQuery(query);
    setInsertPosition(position);
  }, []);

  const closeFilePicker = useCallback(() => {
    setShowFilePicker(false);
    setFilePickerQuery("");
    setInsertPosition(0);
  }, []);

  const handleFileSelect = useCallback((entry: FileEntry) => {
    if (onFileSelect) {
      onFileSelect(entry, insertPosition);
    }
    closeFilePicker();
  }, [onFileSelect, insertPosition, closeFilePicker]);

  const detectAtSymbol = useCallback((
    newText: string, 
    newCursorPosition: number, 
    oldText: string
  ): boolean => {
    // Check if @ was just typed and we have a project path
    if (projectPath?.trim() && newText.length > oldText.length && newText[newCursorPosition - 1] === '@') {
      openFilePicker(newCursorPosition, "");
      return true;
    }

    // Check if we're typing after @ (for search query)
    if (showFilePicker && newCursorPosition >= insertPosition) {
      // Find the @ position before cursor
      let atPosition = -1;
      for (let i = newCursorPosition - 1; i >= 0; i--) {
        if (newText[i] === '@') {
          atPosition = i;
          break;
        }
        // Stop if we hit whitespace (new word)
        if (newText[i] === ' ' || newText[i] === '\n') {
          break;
        }
      }

      if (atPosition !== -1) {
        const query = newText.substring(atPosition + 1, newCursorPosition);
        setFilePickerQuery(query);
        return true;
      } else {
        // @ was removed or cursor moved away
        closeFilePicker();
        return false;
      }
    }

    return false;
  }, [projectPath, showFilePicker, insertPosition, openFilePicker, closeFilePicker]);

  return {
    showFilePicker,
    filePickerQuery,
    setFilePickerQuery,
    openFilePicker,
    closeFilePicker,
    handleFileSelect,
    detectAtSymbol,
  };
};