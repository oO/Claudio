import { useState, useCallback } from "react";
import { type SlashCommand } from "@/lib/api";

export interface UseSlashCommandsOptions {
  onCommandSelect?: (command: SlashCommand, insertPosition: number) => void;
}

export interface UseSlashCommandsReturn {
  showSlashCommandPicker: boolean;
  slashCommandQuery: string;
  setSlashCommandQuery: (query: string) => void;
  openSlashCommandPicker: (position: number, query?: string) => void;
  closeSlashCommandPicker: () => void;
  handleSlashCommandSelect: (command: SlashCommand) => void;
  detectSlashCommand: (text: string, newCursorPosition: number, oldText: string) => boolean;
}

/**
 * Custom hook for managing slash command functionality
 */
export const useSlashCommands = ({
  onCommandSelect,
}: UseSlashCommandsOptions = {}): UseSlashCommandsReturn => {
  const [showSlashCommandPicker, setShowSlashCommandPicker] = useState(false);
  const [slashCommandQuery, setSlashCommandQuery] = useState("");
  const [insertPosition, setInsertPosition] = useState(0);

  const openSlashCommandPicker = useCallback((position: number, query = "") => {
    setShowSlashCommandPicker(true);
    setSlashCommandQuery(query);
    setInsertPosition(position);
  }, []);

  const closeSlashCommandPicker = useCallback(() => {
    setShowSlashCommandPicker(false);
    setSlashCommandQuery("");
    setInsertPosition(0);
  }, []);

  const handleSlashCommandSelect = useCallback((command: SlashCommand) => {
    if (onCommandSelect) {
      onCommandSelect(command, insertPosition);
    }
    closeSlashCommandPicker();
  }, [onCommandSelect, insertPosition, closeSlashCommandPicker]);

  const detectSlashCommand = useCallback((
    newText: string, 
    newCursorPosition: number, 
    oldText: string
  ): boolean => {
    // Check if / was just typed at the beginning of input or after whitespace
    if (newText.length > oldText.length && newText[newCursorPosition - 1] === '/') {
      // Check if it's at the start or after whitespace
      const isStartOfCommand = newCursorPosition === 1 || 
        (newCursorPosition > 1 && /\s/.test(newText[newCursorPosition - 2]));
      
      if (isStartOfCommand) {
        openSlashCommandPicker(newCursorPosition, "");
        return true;
      }
    }

    // Check if we're typing after / (for slash command search)
    if (showSlashCommandPicker && newCursorPosition >= insertPosition) {
      // Find the / position before cursor
      let slashPosition = -1;
      for (let i = newCursorPosition - 1; i >= 0; i--) {
        if (newText[i] === '/') {
          slashPosition = i;
          break;
        }
        // Stop if we hit whitespace (new word)
        if (newText[i] === ' ' || newText[i] === '\n') {
          break;
        }
      }

      if (slashPosition !== -1) {
        const query = newText.substring(slashPosition + 1, newCursorPosition);
        setSlashCommandQuery(query);
        return true;
      } else {
        // / was removed or cursor moved away
        closeSlashCommandPicker();
        return false;
      }
    }

    return false;
  }, [showSlashCommandPicker, insertPosition, openSlashCommandPicker, closeSlashCommandPicker]);

  return {
    showSlashCommandPicker,
    slashCommandQuery,
    setSlashCommandQuery,
    openSlashCommandPicker,
    closeSlashCommandPicker,
    handleSlashCommandSelect,
    detectSlashCommand,
  };
};