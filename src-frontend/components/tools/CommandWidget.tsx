import React from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for user commands (e.g., /release-notes, /model, /clear)
 */
export const CommandWidget: React.FC<{
  commandName: string;
  commandMessage: string;
  commandArgs?: string;
  output?: string;
}> = ({ commandName, commandMessage, commandArgs, output }) => {
  // Count lines in output for expandable behavior
  const outputLineCount = output ? output.split('\n').length : 0;
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="CommandWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Terminal}
        title="Command"
      >
        {commandMessage && commandMessage !== commandName && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{commandMessage}</span>
          </>
        )}
      </ToolWidgetTemplate.Header>
      
      <ToolWidgetTemplate.ExpandableResult
        largeContentThreshold={10}
        lineCount={outputLineCount}
        rawContent={output || ""}
        headerContent={
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-info">{commandName}</code>
            {commandArgs && (
              <code className="text-xs font-mono text-muted-foreground">
                {commandArgs}
              </code>
            )}
          </div>
        }
      >
        {(excerptedContent, isShowingExcerpt) => (
          <ToolWidgetTemplate.CodeOutput>
            {output && output.trim() && output !== "(no content)" 
              ? (isShowingExcerpt ? excerptedContent : output)
              : <span className="text-muted-foreground text-sm">No output</span>
            }
          </ToolWidgetTemplate.CodeOutput>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
