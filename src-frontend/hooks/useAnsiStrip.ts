import { useCallback } from 'react';

/**
 * Hook for stripping ANSI escape codes from terminal output
 * Removes color codes, cursor movement, and other terminal control sequences
 * 
 * @returns Function that strips ANSI codes from a string
 * 
 * @example
 * const stripAnsi = useAnsiStrip();
 * const cleanText = stripAnsi('\u001b[31mRed text\u001b[0m'); // "Red text"
 */
export const useAnsiStrip = () => {
  return useCallback((text: string): string => {
    if (!text) return text;
    
    // Remove ANSI escape sequences:
    // \u001b[ - ESC[ sequence start
    // [0-9;]* - any combination of numbers and semicolons (parameters)
    // [mK] - final character (m for colors, K for line clearing, etc.)
    // 
    // This covers most common ANSI codes:
    // - Color codes (\u001b[31m, \u001b[0m, etc.)
    // - Text formatting (\u001b[1m bold, \u001b[22m normal, etc.)
    // - Line clearing (\u001b[K)
    // - Complex color codes (\u001b[38;5;244m)
    return text
      .replace(/\u001b\[[0-9;]*[mK]/g, '') // Standard ANSI codes
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, ''); // Other control sequences
  }, []);
};