import React from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for Bash tool
 */
export const BashWidget: React.FC<{ 
  command: string; 
  description?: string;
  result?: any;
}> = ({ command, description, result }) => {
  // Extract result content if available
  let resultContent = '';
  let isError = false;
  let lineCount = 0;
  
  if (result) {
    isError = result.is_error || false;
    if (typeof result.content === 'string') {
      resultContent = result.content;
    } else if (result.content && typeof result.content === 'object') {
      if (result.content.text) {
        resultContent = result.content.text;
      } else if (Array.isArray(result.content)) {
        resultContent = result.content
          .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
          .join('\n');
      } else {
        resultContent = JSON.stringify(result.content, null, 2);
      }
    }
    
    // Count lines
    const lines = resultContent.split('\n').filter(line => line.trim());
    lineCount = lines.length;
  }
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="BashWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Terminal}
        title="Terminal"
        isLoading={!result}
        loadingText="Running..."
      >
        {description && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{description}</span>
          </>
        )}
      </ToolWidgetTemplate.Header>
      
      {result && (
        <ToolWidgetTemplate.ExpandableResult
          largeContentThreshold={5}
          lineCount={lineCount}
          rawContent={resultContent}
          headerContent={
            <span className="text-xs font-mono text-muted-foreground">
              {isError ? "Command failed" : "Output"}
            </span>
          }
        >
          {(excerptedContent, isShowingExcerpt) => (
            <ToolWidgetTemplate.CodeOutput>
              {/* Command at top */}
              <div className="mb-3 pb-2 border-b border-border">
                <code className="text-info font-semibold">
                  $ {command}
                </code>
              </div>
              
              {/* Result at bottom */}
              <div className={cn(
                isError 
                  ? "text-destructive" 
                  : "text-foreground"
              )}>
                {isError 
                  ? (excerptedContent || "Command failed")
                  : (excerptedContent || "Command completed")
                }
              </div>
              
            </ToolWidgetTemplate.CodeOutput>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      )}
    </ToolWidgetTemplate>
  );
};