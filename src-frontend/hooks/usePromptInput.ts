import { useState, useCallback } from "react";

export interface UsePromptInputOptions {
  defaultValue?: string;
  onSend?: (prompt: string) => void;
  disabled?: boolean;
}

export interface UsePromptInputReturn {
  prompt: string;
  setPrompt: (prompt: string) => void;
  updatePrompt: (updater: (current: string) => string) => void;
  clearPrompt: () => void;
  canSend: boolean;
  handleSend: () => void;
  cursorPosition: number;
  setCursorPosition: (position: number) => void;
}

/**
 * Custom hook for managing prompt input state and validation
 */
export const usePromptInput = ({
  defaultValue = "",
  onSend,
  disabled = false,
}: UsePromptInputOptions = {}): UsePromptInputReturn => {
  const [prompt, setPrompt] = useState(defaultValue);
  const [cursorPosition, setCursorPosition] = useState(0);

  const updatePrompt = useCallback((updater: (current: string) => string) => {
    setPrompt(updater);
  }, []);

  const clearPrompt = useCallback(() => {
    setPrompt("");
    setCursorPosition(0);
  }, []);

  const canSend = !disabled && prompt.trim().length > 0;

  const handleSend = useCallback(() => {
    if (canSend && onSend) {
      onSend(prompt.trim());
      clearPrompt();
    }
  }, [canSend, onSend, prompt, clearPrompt]);

  return {
    prompt,
    setPrompt,
    updatePrompt,
    clearPrompt,
    canSend,
    handleSend,
    cursorPosition,
    setCursorPosition,
  };
};