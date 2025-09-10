import React from "react";
import { Info } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MarkdownRenderer } from "@/components/ui/molecules";
import { MessageTemplate } from "./MessageTemplate";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { MessageEnhancementProvider } from "@/contexts/MessageEnhancementContext";
import { ToolWidgetTemplate } from "@/components/tools/ToolWidgetTemplate";

interface SummaryMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering AI-generated summary messages
 * Uses ToolWidgetTemplate for consistent expand/collapse functionality
 */
export const SummaryMessage: React.FC<SummaryMessageProps> = ({ message }) => {
  // Check if this is a bundled summary (array of summaries)
  const isBundle = Array.isArray(message.summary);
  const summaries = isBundle ? (message.summary as string[]) : [];
  const summary = isBundle ? "" : message.summary || "";

  const lineCount = isBundle
    ? summaries.length
    : summary.split("\n").filter((line: string) => line.trim()).length;

  // For raw content analysis by ToolWidgetTemplate
  const rawContent = isBundle ? summaries.join("\n") : summary;

  const renderSummaryContent = (excerptedContent: string, isShowingExcerpt: boolean, isExpanded: boolean) => {
    const contentToRender = isShowingExcerpt ? excerptedContent : rawContent;
    
    return (
      <ToolWidgetTemplate.PlainOutput isExpanded={isExpanded}>
        {isBundle ? (
          <ul className="text-sm space-y-1">
            {(isShowingExcerpt ? excerptedContent.split("\n") : summaries).map((summaryItem, index) => (
              <li key={index} className="list-disc list-inside">
                {summaryItem}
              </li>
            ))}
          </ul>
        ) : (
          <MarkdownRenderer
            content={contentToRender}
            compact={true}
            className="text-sm"
          />
        )}
      </ToolWidgetTemplate.PlainOutput>
    );
  };

  return (
    <MessageEnhancementProvider message={message}>
      <MessageTemplate.Container message={message}>
        <DebugLabel label="SummaryMessage" />
        <MessageTemplate.Header
          IconComponent={Info}
          iconClassName="bg-background text-info"
          title="Context Summary"
          titleClassName="w-full text-info"
        >
          <MessageTemplate.Content>
            <ToolWidgetTemplate>
              <ToolWidgetTemplate.Debug label="SummaryMessageWidget" />
              <ToolWidgetTemplate.Header
                icon={Info}
                title="AI Context Summary"
              />
              <ToolWidgetTemplate.ExpandableResult
                rawContent={rawContent}
                lineCount={lineCount}
                initiallyExpanded={false}
                largeContentThreshold={15}
                headerContent={
                  <span className="text-xs text-muted-foreground">
                    {isBundle ? `${summaries.length} items` : "Summary"}
                  </span>
                }
              >
                {renderSummaryContent}
              </ToolWidgetTemplate.ExpandableResult>
            </ToolWidgetTemplate>
          </MessageTemplate.Content>
        </MessageTemplate.Header>
        <MessageTemplate.Footer message={message} />
      </MessageTemplate.Container>
    </MessageEnhancementProvider>
  );
};