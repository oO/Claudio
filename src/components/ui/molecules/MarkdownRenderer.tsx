import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SyntaxHighlighter } from "../atoms/SyntaxHighlighter";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
  onLinkDetected?: (url: string) => void;
}

/**
 * Molecule component for rendering Markdown content with syntax highlighting
 * Integrates ReactMarkdown with our atomic SyntaxHighlighter component
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  compact = false,
  onLinkDetected
}) => {
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children);
      
      if (!inline && match) {
        return (
          <SyntaxHighlighter
            code={code}
            language={match[1]}
            className="my-2"
          />
        );
      }
      
      return (
        <code className={cn("font-mono text-sm px-1 py-0.5 bg-muted rounded", className)} {...props}>
          {children}
        </code>
      );
    },
    a({ href, children, ...props }: any) {
      // Detect and report links if callback provided
      if (onLinkDetected && href) {
        onLinkDetected(href);
      }
      
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors"
          {...props}
        >
          {children}
        </a>
      );
    }
  }), [onLinkDetected]);

  return (
    <div className={cn(
      "prose dark:prose-invert max-w-none",
      compact ? "prose-sm" : "prose-base",
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};