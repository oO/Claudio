import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResize } from "@/hooks/useAutoResize";
import { DebugLabel } from "@/components/ui/atoms";

export interface PromptTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  minHeight?: number;
  maxHeight?: number;
  autoResize?: boolean;
  dragActive?: boolean;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * Enhanced textarea with auto-resize and drag-drop support
 */
export const PromptTextarea = React.forwardRef<HTMLTextAreaElement, PromptTextareaProps>(
  ({
    value,
    onChange,
    onKeyDown,
    onPaste,
    placeholder = "Type your prompt here...",
    disabled = false,
    className,
    rows = 1,
    minHeight = 44,
    maxHeight = 120,
    autoResize = true,
    dragActive = false,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
  }, forwardedRef) => {
    const { textareaRef } = useAutoResize({ 
      minHeight, 
      maxHeight, 
      value: autoResize ? value : undefined 
    });

    // Combine refs - use the auto-resize ref if autoResize is enabled, otherwise use the forwarded ref
    const ref = autoResize ? textareaRef : forwardedRef;

    return (
      <div className="relative">
        <DebugLabel label="PromptTextarea" />
        <Textarea
          ref={ref}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={cn(
            "resize-none",
            autoResize && "min-h-[44px] max-h-[120px]",
            dragActive && "border-primary",
            className
          )}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={autoResize ? undefined : { minHeight, maxHeight }}
        />
      </div>
    );
  }
);

PromptTextarea.displayName = 'PromptTextarea';