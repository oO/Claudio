import React from "react";
import { Prism as PrismSyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useTheme } from "@/hooks";
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
  const { theme } = useTheme();
  const syntaxTheme = getClaudeSyntaxTheme(theme);

  return (
    <div className={cn("rounded-md overflow-hidden", className)}>
      <PrismSyntaxHighlighter
        style={syntaxTheme}
        language={language}
        PreTag="div"
        showLineNumbers={showLineNumbers}
      >
        {code.replace(/\n$/, '')}
      </PrismSyntaxHighlighter>
    </div>
  );
};