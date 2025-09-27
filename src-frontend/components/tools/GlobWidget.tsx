import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for Glob tool
 */
export const GlobWidget: React.FC<{ pattern: string; result?: any }> = ({ pattern, result }) => {
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
      <ToolWidgetTemplate.Debug label="GlobWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Search}
        title="Searching for pattern:"
        isLoading={!result}
        loadingText="Searching..."
      >
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
          {pattern}
        </code>
      </ToolWidgetTemplate.Header>
      
      {result && (
        <ToolWidgetTemplate.ExpandableResult
          largeContentThreshold={5}
          lineCount={lineCount}
          rawContent={resultContent}
          headerContent={
            <>
              <span className="text-xs font-mono text-muted-foreground">
                {isError ? "Search failed" : "Results"}
              </span>
              {!isError && lineCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({lineCount} {lineCount === 1 ? 'match' : 'matches'})
                </span>
              )}
            </>
          }
        >
          {(excerptedContent, isShowingExcerpt, isExpanded) => (
            <>
              <ToolWidgetTemplate.CodeOutput isExpanded={isExpanded}>
                <div className={cn(
                  isError 
                    ? "text-destructive" 
                    : "text-foreground"
                )}>
                  {isError 
                    ? (excerptedContent || "Search failed")
                    : (excerptedContent || "No matches found")
                  }
                </div>
              </ToolWidgetTemplate.CodeOutput>
              {isShowingExcerpt && (
                <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground text-center">
                  --- {resultContent.split('\n').length - 5} more lines, {resultContent.length - excerptedContent.length} more characters ---
                </div>
              )}
            </>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      )}
    </ToolWidgetTemplate>
  );
};