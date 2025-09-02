import React from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { useAnsiStrip } from "@/hooks/useAnsiStrip";

/**
 * Widget for user commands (e.g., /release-notes, /model, /clear)
 */
export const CommandWidget: React.FC<{
  commandName: string;
  commandMessage: string;
  commandArgs?: string;
  output?: string;
}> = ({ commandName, commandMessage, commandArgs, output }) => {
  const stripAnsi = useAnsiStrip();
  
  // Clean output of ANSI escape codes
  const cleanOutput = output ? stripAnsi(output) : "";
  
  // Count lines in cleaned output for expandable behavior
  const outputLineCount = cleanOutput ? cleanOutput.split('\n').length : 0;
  
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
        rawContent={cleanOutput || ""}
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
            {cleanOutput && cleanOutput.trim() && cleanOutput !== "(no content)" 
              ? (isShowingExcerpt ? excerptedContent : cleanOutput)
              : <span className="text-muted-foreground text-sm">No output</span>
            }
          </ToolWidgetTemplate.CodeOutput>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
