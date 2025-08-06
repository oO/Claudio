import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface CodeSyntaxHighlightProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  language?: 'shell' | 'bash' | 'javascript' | 'json';
}

export const CodeSyntaxHighlight: React.FC<CodeSyntaxHighlightProps> = ({
  value,
  onChange,
  placeholder = "Enter command...",
  disabled = false,
  className,
  minHeight = "80px",
  language = 'shell'
}) => {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "font-mono text-sm resize-none",
        "bg-slate-50 dark:bg-slate-900",
        "border-slate-200 dark:border-slate-700",
        "focus:ring-slate-300 dark:focus:ring-slate-600",
        className
      )}
      style={{ minHeight }}
      spellCheck={false}
    />
  );
};