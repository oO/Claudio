import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SyntaxHighlighter } from "../atoms/SyntaxHighlighter";
import { useLinkNotification } from "@/contexts/LinkNotificationContext";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
}

/**
 * Molecule component for rendering Markdown content with syntax highlighting
 * Handles its own link detection and notification
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  compact = false,
}) => {
  const notifyLinkDetected = useLinkNotification();
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
      // Detect and report links
      if (href) {
        notifyLinkDetected(href);
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
  }), [notifyLinkDetected]);

  return (
    <div className={cn(
      "prose dark:prose-invert max-w-none",
      compact ? "prose-sm" : "prose-base",
      // Fix spacing issues - target specific elements causing excessive spacing
      "prose-p:my-1 prose-p:leading-normal",
      "prose-ul:my-1 prose-ol:my-1",
      "prose-li:my-0.5 prose-li:leading-normal",
      "prose-h1:my-1 prose-h2:my-1 prose-h3:my-1 prose-h4:my-1 prose-h5:my-1 prose-h6:my-1",
      "prose-blockquote:my-1",
      "prose-pre:my-1",
      // Specifically target list item content and nested paragraphs
      "prose-li:prose-p:my-0.5",
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