import React, { useState } from "react";
import { Terminal, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Widget for Bash tool
 */
export const BashWidget: React.FC<{ 
  command: string; 
  description?: string;
  result?: any;
}> = ({ command, description, result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  
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
    isLargeResult = lineCount > 5; // Show collapsed view for more than 5 lines
  }
  
  // Get first few lines for preview
  const previewLines = resultContent.split('\n').slice(0, 3).join('\n');
  
  return (
    <div className="space-y-1 relative">
      <DebugLabel label="BashWidget" />
      {/* Command section - outside the result box */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-sm">Terminal</span>
        {description && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{description}</span>
          </>
        )}
        {!result && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            <span>Running...</span>
          </div>
        )}
      </div>
      
      {/* Results section - expandable box */}
      {result && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {isError ? "Command failed" : "Output"}
              </span>
              {!isError && lineCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({lineCount} {lineCount === 1 ? 'line' : 'lines'})
                </span>
              )}
            </div>
            
            {isLargeResult && !isError && (
              <button
                onClick={async () => {
                  if (!isExpanded) {
                    setIsExpanding(true);
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
          
          {/* Content area */}
          <div className="relative">
            <div className="p-3 text-xs font-mono whitespace-pre-wrap bg-background overflow-auto">
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
                  ? (resultContent || "Command failed")
                  : (!isExpanded && isLargeResult 
                      ? previewLines + (lineCount > 3 ? '\n...' : '')
                      : (resultContent || "Command completed")
                    )
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};