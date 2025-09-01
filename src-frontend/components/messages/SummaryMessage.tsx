import React, { useState } from "react";
import { Info, ChevronRight, Loader2 } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MarkdownRenderer } from "@/components/ui/molecules";
import { MessageTemplate } from "./MessageTemplate";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { MessageEnhancementProvider } from "@/contexts/MessageEnhancementContext";

// Constants
const PREVIEW_LINES = 8; // Number of lines to show when collapsed
const LARGE_SUMMARY_THRESHOLD = 15; // Summaries with more lines are considered "large"

interface SummaryMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering AI-generated summary messages
 * Handles expand/collapse functionality and message location copying
 */
export const SummaryMessage: React.FC<SummaryMessageProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);

  // Check if this is a bundled summary (array of summaries)
  const isBundle = Array.isArray(message.summary);
  const summaries = isBundle ? (message.summary as string[]) : [];
  const summary = isBundle ? "" : message.summary || "";

  const lineCount = isBundle
    ? summaries.length
    : summary.split("\n").filter((line: string) => line.trim()).length;
  const isLargeSummary = lineCount > LARGE_SUMMARY_THRESHOLD;

  // When collapsed, only show first N lines (or items for bundles)
  const displaySummary = isBundle
    ? summaries
    : !isLargeSummary || isExpanded
      ? summary
      : summary.split("\n").slice(0, PREVIEW_LINES).join("\n");

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

  const summaryContent = (
    <>
      {/* Summary content with expand/collapse */}
      <div>
        {isBundle ? (
          <ul className="text-sm space-y-1">
            {(displaySummary as string[]).map((summaryItem, index) => (
              <li key={index} className="list-disc list-inside">
                {summaryItem}
              </li>
            ))}
          </ul>
        ) : (
          <MarkdownRenderer
            content={displaySummary as string}
            compact={true}
            className="text-sm"
          />
        )}

        {isLargeSummary && !isExpanded && (
          <div className="mt-3 pt-3 text-xs text-muted-foreground text-center border-t">
            ... {lineCount - PREVIEW_LINES} more {isBundle ? "items" : "lines"}{" "}
            ...
          </div>
        )}
      </div>
    </>
  );

  const titleContent = (
    <div className="flex items-center justify-between w-full">
      <div>
        <div className="text-base font-semibold">
          {isBundle ? "Context Summaries" : "Context Summary"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          AI-generated {isBundle ? "summaries" : "summary"}
          {lineCount > 0 && (
            <span className="ml-2">
              ({lineCount}{" "}
              {isBundle
                ? lineCount === 1
                  ? "item"
                  : "items"
                : lineCount === 1
                  ? "line"
                  : "lines"}
              )
            </span>
          )}
        </div>
      </div>

      {isLargeSummary && (
        <button
          onClick={handleExpandToggle}
          disabled={isExpanding}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-4"
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
  );

  return (
    <MessageEnhancementProvider message={message}>
      <MessageTemplate.Container message={message}>
        <DebugLabel label="SummaryMessage" />
        <MessageTemplate.Header
          IconComponent={Info}
          iconClassName="bg-info"
          title="Summary"
          titleClassName="w-full text-info"
        >
          {titleContent}
          {/* Custom title layout for summary with expand/collapse button */}
          <MessageTemplate.Content>{summaryContent}</MessageTemplate.Content>
        </MessageTemplate.Header>
        <MessageTemplate.Footer message={message} />
      </MessageTemplate.Container>
    </MessageEnhancementProvider>
  );
};
