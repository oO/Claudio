import React, { useState } from "react";
import { Info, MessageSquare, ChevronRight, Loader2 } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MarkdownRenderer } from "@/components/ui/molecules";
import { cn } from "@/lib/utils";

// Constants
const PREVIEW_LINES = 8; // Number of lines to show when collapsed
const LARGE_SUMMARY_THRESHOLD = 15; // Summaries with more lines are considered "large"

/**
 * Widget for AI-generated summaries
 */
export const SummaryWidget: React.FC<{ 
  summary: string;
  leafUuid?: string;
  messageNumber?: number;
  sessionFilePath?: string;
  projectId?: string;
  sessionId?: string;
  contributingMessageUuids?: string[];
}> = ({ summary, leafUuid, messageNumber, sessionFilePath, projectId, sessionId, contributingMessageUuids }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);

  const lineCount = summary.split('\n').filter(line => line.trim()).length;
  const isLargeSummary = lineCount > LARGE_SUMMARY_THRESHOLD;
  
  // When collapsed, only show first N lines
  const displaySummary = (!isLargeSummary || isExpanded) 
    ? summary 
    : summary.split('\n').slice(0, PREVIEW_LINES).join('\n');

  return (
    <div className="rounded-lg border overflow-hidden relative">
      <DebugLabel label="SummaryWidget" />
      
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 text-info" />
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold">Context Compaction Summary</div>
            <div className="text-xs text-muted-foreground mt-1">
              AI-generated summary for assistant context
              {lineCount > 0 && (
                <span className="ml-2">
                  ({lineCount} {lineCount === 1 ? 'line' : 'lines'})
                </span>
              )}
            </div>
          </div>
        </div>
        
        {isLargeSummary && (
          <button
            onClick={async () => {
              if (!isExpanded) {
                setIsExpanding(true);
                // Small delay to allow UI to update before heavy rendering
                await new Promise(resolve => setTimeout(resolve, 50));
                setIsExpanded(true);
                setIsExpanding(false);
              } else {
                setIsExpanded(false);
              }
            }}
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
                <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                {isExpanded ? "Collapse" : "Expand"}
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <MarkdownRenderer 
          content={displaySummary}
          compact={true}
          className="text-sm"
        />
        
        {isLargeSummary && !isExpanded && (
          <div className="mt-3 pt-3 text-xs text-muted-foreground text-center border-t">
            ... {lineCount - PREVIEW_LINES} more lines ...
          </div>
        )}
        
        {messageNumber && (
          <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground mt-4 pt-3 border-t">
            <div
              className="flex items-center gap-1 cursor-pointer bg-accent text-muted-foreground hover:!text-accent-foreground px-2 py-1 rounded transition-colors"
              onClick={async () => {
                const uuids = contributingMessageUuids || (leafUuid ? [leafUuid] : []);
                
                if (uuids.length > 0 && projectId && sessionId && sessionFilePath) {
                  try {
                    // Build complete message location object (Single Source of Truth)
                    const messageLocation = {
                      project: projectId,
                      session: sessionId,
                      messages: uuids,
                      session_path: sessionFilePath
                    };
                    const locationJson = JSON.stringify(messageLocation, null, 2);
                    await navigator.clipboard.writeText(locationJson);
                    console.log(`Copied message location JSON to clipboard:`, messageLocation);
                  } catch (error) {
                    console.error("Failed to copy message location:", error);
                  }
                } else if (leafUuid) {
                  // Fallback to just UUID if missing data
                  try {
                    await navigator.clipboard.writeText(leafUuid);
                    console.log(`Copied message UUID to clipboard: ${leafUuid}`);
                  } catch (error) {
                    console.error("Failed to copy message UUID:", error);
                  }
                }
              }}
              title={projectId && sessionId && sessionFilePath ? "Click to copy message location JSON (all contributing messages)" : "Click to copy message UUID"}
            >
              <MessageSquare className="h-3 w-3" />
              {messageNumber.toString().padStart(3, "0")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};