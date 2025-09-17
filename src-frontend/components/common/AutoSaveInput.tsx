import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// Auto-save state for visual feedback
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Simple debounce hook using native React - no external dependencies needed
 */
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

export interface AutoSaveInputProps {
  value: any;
  onChange: (value: any) => Promise<void>;
  type: 'text' | 'boolean' | 'select' | 'textarea' | 'number';
  options?: Array<{label: string, value: any}>;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Auto-save input component with optimistic updates and visual feedback
 *
 * Following the spec requirements:
 * - No save buttons - instant persistence
 * - Optimistic updates for snappy UX
 * - Visual feedback for save state
 * - Automatic rollback on errors
 * - Debounced saves for text inputs
 * - Immediate saves for boolean/select
 */
export function AutoSaveInput({
  value,
  onChange,
  type,
  options,
  debounceMs = 500,
  placeholder,
  className,
  disabled = false,
  'data-testid': testId,
}: AutoSaveInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Sync local value when prop changes (from external updates)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Save function with error handling
  const saveValue = useCallback(async (newValue: any) => {
    setSaveState('saving');

    try {
      await onChange(newValue);
      setSaveState('saved');

      // Clear "saved" indicator after 1 second
      setTimeout(() => {
        setSaveState(prev => prev === 'saved' ? 'idle' : prev);
      }, 1000);

      logger.debug('AutoSaveInput: successfully saved value', { type, newValue });
    } catch (error) {
      logger.error('AutoSaveInput: failed to save value', { type, newValue, error });
      setSaveState('error');

      // Rollback to original value on error
      setLocalValue(value);

      // Clear error indicator after 2 seconds
      setTimeout(() => {
        setSaveState(prev => prev === 'error' ? 'idle' : prev);
      }, 2000);
    }
  }, [onChange, value, type]);

  // Debounced save for text inputs (but immediate for others)
  const debouncedSave = useDebounce(
    saveValue,
    type === 'text' || type === 'textarea' ? debounceMs : 0 // Immediate for non-text inputs
  );

  const handleChange = useCallback((newValue: any) => {
    // Optimistic update - show change immediately
    setLocalValue(newValue);

    // Trigger debounced save
    debouncedSave(newValue);
  }, [debouncedSave]);

  const renderInput = () => {
    const baseInputClasses = cn(
      "w-full transition-colors duration-200",
      "border border-gray-300 dark:border-gray-600",
      "bg-white dark:bg-gray-800",
      "text-gray-900 dark:text-gray-100",
      "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      saveState === 'error' && "border-red-500 focus:ring-red-500 focus:border-red-500",
      saveState === 'saving' && "border-blue-400",
      saveState === 'saved' && "border-green-500",
      className
    );

    switch (type) {
      case 'text':
        return (
          <input
            type="text"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(baseInputClasses, "px-3 py-2 rounded-md")}
            data-testid={testId}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(baseInputClasses, "px-3 py-2 rounded-md min-h-[80px] resize-vertical")}
            data-testid={testId}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={localValue || ''}
            onChange={(e) => handleChange(Number(e.target.value))}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(baseInputClasses, "px-3 py-2 rounded-md")}
            data-testid={testId}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(localValue)}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={disabled}
              className={cn(
                "w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded",
                "focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800",
                "focus:ring-2 dark:bg-gray-700 dark:border-gray-600",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              data-testid={testId}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {placeholder || 'Enable'}
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className={cn(baseInputClasses, "px-3 py-2 rounded-md")}
            data-testid={testId}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options?.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {renderInput()}
      <SaveIndicator state={saveState} />
    </div>
  );
}

/**
 * Visual save state indicator
 */
function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <AnimatePresence>
      {state !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn(
            "absolute -right-8 top-1/2 -translate-y-1/2",
            "flex items-center justify-center w-5 h-5",
            "text-xs font-medium"
          )}
          data-testid="save-indicator"
        >
          {state === 'saving' && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          {state === 'saved' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
            >
              <Check className="w-3 h-3 text-white" />
            </motion.div>
          )}
          {state === 'error' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook for managing auto-save state
 */
export function useAutoSave<T>(
  initialValue: T,
  onSave: (value: T) => Promise<void>,
  debounceMs: number = 500
) {
  const [value, setValue] = useState<T>(initialValue);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const saveValue = useCallback(async (newValue: T) => {
    setSaveState('saving');

    try {
      await onSave(newValue);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1000);
    } catch (error) {
      setSaveState('error');
      setValue(initialValue); // Rollback
      setTimeout(() => setSaveState('idle'), 2000);
      throw error;
    }
  }, [onSave, initialValue]);

  const debouncedSave = useDebounce(saveValue, debounceMs);

  const updateValue = useCallback((newValue: T) => {
    setValue(newValue);
    debouncedSave(newValue);
  }, [debouncedSave]);

  // Sync with external changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return {
    value,
    updateValue,
    saveState,
  };
}

export default AutoSaveInput;