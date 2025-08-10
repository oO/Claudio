import React, { useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Widget for Glob tool
 */
export const GlobWidget: React.FC<{ pattern: string; result?: any }> = ({ pattern, result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Extract result content if available
  let resultContent = '';
  let isError = false;
  let lineCount = 0;
  let isLargeResult = false;
  
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
    
    // Count lines and determine if large
    const lines = resultContent.split('\n').filter(line => line.trim());
    lineCount = lines.length;
    isLargeResult = lineCount > 5; // Show collapsed view for more than 5 results
  }
  
  // Get first few lines for preview
  const previewLines = resultContent.split('\n').slice(0, 3).join('\n');
  
  return (
    <div className="space-y-1 relative">
      <DebugLabel label="GlobWidget" />
      {/* Command section - outside the expand box */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm">Searching for pattern:</span>
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
          {pattern}
        </code>
        {!result && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            <span>Searching...</span>
          </div>
        )}
      </div>
      
      {/* Results section - expandable box */}
      {result && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {isError ? "Search failed" : "Results"}
              </span>
              {!isError && lineCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({lineCount} {lineCount === 1 ? 'match' : 'matches'})
                </span>
              )}
            </div>
            
            {isLargeResult && !isError && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            )}
          </div>
          
          {/* Content area */}
          <div className="relative">
            <div className={cn(
              "transition-all duration-200",
              !isExpanded && isLargeResult && "max-h-24"
            )}>
              <div className={cn(
                "p-3 text-xs font-mono whitespace-pre-wrap overflow-auto",
                !isExpanded && isLargeResult && "max-h-20",
                isError 
                  ? "text-red-600 dark:text-red-400" 
                  : "text-green-700 dark:text-green-300"
              )}>
                {isError 
                  ? (resultContent || "Search failed")
                  : (!isExpanded && isLargeResult 
                      ? previewLines + (lineCount > 3 ? '\n...' : '')
                      : (resultContent || "No matches found")
                    )
                }
              </div>
            </div>
            
            {/* Gradient fade for collapsed view */}
            {!isExpanded && isLargeResult && !isError && lineCount > 3 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};