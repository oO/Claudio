import React from "react";
import { Prism as PrismSyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useThemeUnified } from "@/hooks";
import { cn } from "@/lib/utils";

interface SyntaxHighlighterProps {
  code: string;
  language: string;
  className?: string;
  showLineNumbers?: boolean;
}

/**
 * Atomic component for syntax highlighting code blocks
 * Uses consistent theme integration with the application
 */
export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  code,
  language,
  className,
  showLineNumbers = false
}) => {
  const { theme } = useThemeUnified();
  const syntaxTheme = getClaudeSyntaxTheme(theme);
  
  // Provide fallback styling if theme is empty
  const fallbackStyle = Object.keys(syntaxTheme).length === 0 ? {
    'pre[class*="language-"]': {
      background: 'var(--muted)',
      color: 'var(--foreground)',
    },
    'code[class*="language-"]': {
      background: 'transparent',
      color: 'var(--info)',
    }
  } : syntaxTheme;

  return (
    <div className={cn("rounded-md overflow-hidden", className)}>
      <PrismSyntaxHighlighter
        style={fallbackStyle}
        language={language}
        PreTag="div"
        showLineNumbers={showLineNumbers}
      >
        {code.replace(/\n$/, '')}
      </PrismSyntaxHighlighter>
    </div>
  );
};