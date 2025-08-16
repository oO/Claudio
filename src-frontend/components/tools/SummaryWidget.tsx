import React, { useState } from "react";
import { Info, MessageSquare } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/molecules";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { useSessionContext } from "@/contexts/SessionContext";
import { logger } from '@/lib/logger';

// Constants
const PREVIEW_LINES = 8; // Number of lines to show when collapsed
const LARGE_SUMMARY_THRESHOLD = 15; // Summaries with more lines are considered "large"

/**
 * Widget for AI-generated summaries (tool/widget context)
 * For message flow summaries, use SummaryMessage component instead
 */
export const SummaryWidget: React.FC<{
  summary: string;
  leafUuid?: string;
  messageNumber?: number;
  contributingMessageUuids?: string[];
  isBundle?: boolean;
}> = ({
  summary,
  leafUuid,
  messageNumber,
  contributingMessageUuids,
  isBundle = false,
}) => {
  const { projectId, sessionId, sessionFilePath } = useSessionContext();
  const lineCount = summary.split("\n").filter((line) => line.trim()).length;
  const isLargeSummary = lineCount > LARGE_SUMMARY_THRESHOLD;

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="SummaryWidget" />
      <ToolWidgetTemplate.Header 
        icon={Info} 
        title={isBundle ? "Context Summaries" : "Context Summary"}
      />
      
      <ToolWidgetTemplate.ExpandableResult
        headerContent={
          <span className="text-xs text-muted-foreground">
            AI-generated summary
            {lineCount > 0 && (
              <span className="ml-2">
                ({lineCount} {lineCount === 1 ? "line" : "lines"})
              </span>
            )}
          </span>
        }
        isExpandable={isLargeSummary}
        initiallyExpanded={!isLargeSummary}
        largeContentThreshold={LARGE_SUMMARY_THRESHOLD}
        lineCount={lineCount}
        rawContent={summary}
      >
        {(excerptedContent, isShowingExcerpt) => (
          <>
            <ToolWidgetTemplate.PlainOutput>
              <MarkdownRenderer
                content={excerptedContent}
                compact={true}
                className="text-sm"
              />

              {messageNumber && (
                <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground mt-4 pt-3 border-t">
                  <div
                    className="flex items-center gap-1 cursor-pointer bg-accent text-muted-foreground hover:!text-accent-foreground px-2 py-1 rounded transition-colors"
                    onClick={async () => {
                      const uuids =
                        contributingMessageUuids || (leafUuid ? [leafUuid] : []);

                      if (
                        uuids.length > 0 &&
                        projectId &&
                        sessionId &&
                        sessionFilePath
                      ) {
                        try {
                          // Build complete message location object (Single Source of Truth)
                          const messageLocation = {
                            project: projectId,
                            session: sessionId,
                            messages: uuids,
                            session_path: sessionFilePath,
                          };
                          const locationJson = JSON.stringify(
                            messageLocation,
                            null,
                            2,
                          );
                          await navigator.clipboard.writeText(locationJson);
                          logger.log(
                            `Copied message location JSON to clipboard:`,
                            messageLocation,
                          );
                        } catch (error) {
                          logger.error("Failed to copy message location:", error);
                        }
                      } else if (leafUuid) {
                        // Fallback to just UUID if missing data
                        try {
                          await navigator.clipboard.writeText(leafUuid);
                          logger.log(
                            `Copied message UUID to clipboard: ${leafUuid}`,
                          );
                        } catch (error) {
                          logger.error("Failed to copy message UUID:", error);
                        }
                      }
                    }}
                    title={
                      projectId && sessionId && sessionFilePath
                        ? "Click to copy message location JSON (all contributing messages)"
                        : "Click to copy message UUID"
                    }
                  >
                    <MessageSquare className="h-3 w-3" />
                    {messageNumber.toString().padStart(3, "0")}
                  </div>
                </div>
              )}
            </ToolWidgetTemplate.PlainOutput>
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
