import React from "react";
import { Brain } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { MarkdownRenderer } from "@/components/ui/molecules";

/**
 * Widget for displaying AI thinking/reasoning content
 */
export const ThinkingWidget: React.FC<{ 
  thinking: string;
  signature?: string;
}> = ({ thinking }) => {
  // Strip whitespace from thinking content
  const trimmedThinking = thinking.trim();
  const lineCount = trimmedThinking.split('\n').filter(line => line.trim()).length;
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="ThinkingWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Brain}
        title="Thinking..."
        isLoading={false}
      />
      
      <ToolWidgetTemplate.ExpandableResult
        initiallyExpanded={false}
        largeContentThreshold={10}
        lineCount={lineCount}
        rawContent={trimmedThinking}
        headerContent={
          <span className="text-xs font-mono text-muted-foreground">
            AI reasoning
          </span>
        }
      >
        {(excerptedContent, isShowingExcerpt) => (
          <>
            <ToolWidgetTemplate.PlainOutput>
              <MarkdownRenderer
                content={excerptedContent}
                compact={true}
                className="text-sm"
              />
            </ToolWidgetTemplate.PlainOutput>
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
