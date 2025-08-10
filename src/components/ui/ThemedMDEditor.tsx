import React from "react";
import MDEditor, { MDEditorProps } from "@uiw/react-md-editor";
import { useThemeContext } from "@/contexts/ThemeContext";
import { getThemeById } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface ThemedMDEditorProps extends Omit<MDEditorProps, 'data-color-mode'> {
  /**
   * Optional className for the wrapper container
   */
  containerClassName?: string;
  /**
   * Height of the editor - can be string like "100%" or number for fixed pixels
   * @default "100%"
   */
  height?: string | number;
}

/**
 * A theme-aware wrapper around @uiw/react-md-editor that automatically
 * detects the current theme and applies appropriate styling.
 * 
 * This component eliminates the need to duplicate theme detection logic
 * across multiple markdown editor usages.
 * 
 * @example
 * // Full height editor
 * <ThemedMDEditor 
 *   value={content}
 *   onChange={setContent}
 * />
 * 
 * @example  
 * // Fixed height editor
 * <ThemedMDEditor
 *   value={prompt}
 *   onChange={setPrompt}
 *   height={400}
 * />
 * 
 * @example
 * // With custom container styling
 * <ThemedMDEditor
 *   value={content}
 *   onChange={setContent}
 *   containerClassName="border-2 border-primary"
 * />
 */
export const ThemedMDEditor: React.FC<ThemedMDEditorProps> = ({
  containerClassName,
  height = "100%",
  preview = "edit",
  visibleDragbar = false,
  ...props
}) => {
  const { theme } = useThemeContext();
  
  // Determine if current theme is dark
  const isDarkTheme = theme === 'custom' ? true : (getThemeById(theme)?.isDark ?? true);

  return (
    <div 
      className={cn(
        "h-full rounded-lg border border-border overflow-hidden shadow-sm",
        containerClassName
      )} 
      data-color-mode={isDarkTheme ? "dark" : "light"}
    >
      <MDEditor
        preview={preview}
        height={height}
        visibleDragbar={visibleDragbar}
        {...props}
      />
    </div>
  );
};