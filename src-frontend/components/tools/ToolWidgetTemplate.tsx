import React, { useState, ReactNode } from "react";
import { LucideIcon, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

// Content excerpting constants
const EXCERPT_THRESHOLDS = {
  MIN_LINES: 15,
  MIN_CHARACTERS: 15 * 80, // 15 lines * 80 chars
  EXCERPT_LINES: 5,
  EXCERPT_CHARACTERS: 5 * 80, // 5 lines * 80 chars
} as const;

// Types for the compound component system
interface ToolWidgetTemplateProps {
  children: ReactNode;
  className?: string;
}

interface ToolHeaderProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

interface ExpandableResultProps {
  children:
    | ReactNode
    | ((excerptedContent: string, isShowingExcerpt: boolean) => ReactNode);
  isExpandable?: boolean;
  initiallyExpanded?: boolean;
  largeContentThreshold?: number;
  lineCount?: number;
  headerContent?: ReactNode;
  className?: string;
  contentClassName?: string;
  // Raw content for excerpt analysis
  rawContent?: string;
}

interface ToolFooterProps {
  children?: ReactNode;
  className?: string;
}

// Container Component
const Container: React.FC<ToolWidgetTemplateProps> = ({
  children,
  className,
}) => {
  return <div className={cn("space-y-1 relative", className)}>{children}</div>;
};

// Debug Label Component
const Debug: React.FC<{ label: string }> = ({ label }) => {
  return <DebugLabel label={label} />;
};

// Tool Header Component - Shows tool identification and parameters
const Header: React.FC<ToolHeaderProps> = ({
  icon: Icon,
  title,
  children,
  isLoading = false,
  loadingText = "Loading...",
}) => {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm">{title}</span>
      {children}
      {isLoading && (
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
          <span>{loadingText}</span>
        </div>
      )}
    </div>
  );
};

// Expandable Result Component - Shows tool output/results
const ExpandableResult: React.FC<ExpandableResultProps> = ({
  children,
  isExpandable = true,
  initiallyExpanded = false,
  largeContentThreshold = 15,
  lineCount,
  headerContent,
  className,
  contentClassName,
  rawContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [isExpanding, setIsExpanding] = useState(false);

  // Check if content needs excerpting using raw content
  const needsExcerpting = rawContent
    ? rawContent.split("\n").length >= EXCERPT_THRESHOLDS.MIN_LINES ||
      rawContent.length >= EXCERPT_THRESHOLDS.MIN_CHARACTERS
    : false;

  // Create excerpt from raw content when collapsed
  const getExcerptedContent = (): string => {
    if (!rawContent || !needsExcerpting || isExpanded) return rawContent || "";

    const lines = rawContent.split("\n");
    let excerpt = "";
    let charCount = 0;

    // Take first 5 lines or 400 characters, whichever comes first
    for (
      let i = 0;
      i < Math.min(EXCERPT_THRESHOLDS.EXCERPT_LINES, lines.length);
      i++
    ) {
      const line = lines[i];
      if (charCount + line.length + 1 > EXCERPT_THRESHOLDS.EXCERPT_CHARACTERS) {
        // Truncate this line to fit character limit
        const remainingChars =
          EXCERPT_THRESHOLDS.EXCERPT_CHARACTERS - charCount;
        excerpt += line.substring(0, remainingChars);
        break;
      }
      excerpt += line;
      charCount += line.length;

      if (
        i < Math.min(EXCERPT_THRESHOLDS.EXCERPT_LINES - 1, lines.length - 1)
      ) {
        excerpt += "\n";
        charCount += 1;
      }
    }

    return excerpt;
  };

  const excerptedContent = getExcerptedContent();
  const isShowingExcerpt = needsExcerpting && !isExpanded && rawContent;

  // Fall back to line count if no raw content provided
  const isLargeContent =
    needsExcerpting ||
    (lineCount !== undefined && lineCount > largeContentThreshold);
  const shouldShowExpandButton = isExpandable && isLargeContent;

  const handleExpandToggle = async () => {
    if (!isExpanded) {
      setIsExpanding(true);
      // Small delay to allow UI to update before heavy rendering
      await new Promise((resolve) => setTimeout(resolve, 50));
      setIsExpanded(true);
      setIsExpanding(false);
    } else {
      setIsExpanded(false);
    }
  };

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {headerContent}
          {lineCount !== undefined && lineCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({lineCount} {lineCount === 1 ? "line" : "lines"})
            </span>
          )}
        </div>

        {shouldShowExpandButton && (
          <button
            onClick={handleExpandToggle}
            disabled={isExpanding}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isExpanding ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronRight
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isExpanded && "rotate-90",
                  )}
                />
                {isExpanded ? "Collapse" : "Expand"}
              </>
            )}
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="relative">
        <div className={cn("relative", contentClassName)}>
          {typeof children === "function"
            ? children(excerptedContent, !!isShowingExcerpt)
            : children}
        </div>
      </div>
    </div>
  );
};

// Footer Component for tool-specific actions or metadata
const Footer: React.FC<ToolFooterProps> = ({ children, className }) => {
  if (!children) return null;

  return (
    <div className={cn("px-4 py-3 border-t bg-muted/20", className)}>
      {children}
    </div>
  );
};

// Pre-styled content components for common tool output patterns
const CodeOutput: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "p-3 text-xs font-mono whitespace-pre-wrap bg-background overflow-auto max-h-[440px]",
        className,
      )}
    >
      {children}
    </div>
  );
};

const PlainOutput: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("p-3 text-sm overflow-auto max-h-[440px]", className)}>
      {children}
    </div>
  );
};

// Main compound component with dot notation
export const ToolWidgetTemplate = Object.assign(Container, {
  Debug,
  Header,
  ExpandableResult,
  Footer,
  CodeOutput,
  PlainOutput,
});

// Export types for consumers
export type {
  ToolWidgetTemplateProps,
  ToolHeaderProps,
  ExpandableResultProps,
  ToolFooterProps,
};
