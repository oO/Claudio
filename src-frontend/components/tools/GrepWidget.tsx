import React, { useState } from "react";
import { Search, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Widget for Grep tool
 */
export const GrepWidget: React.FC<{ 
  pattern: string; 
  include?: string; 
  path?: string;
  exclude?: string;
  result?: any;
}> = ({ pattern, include, path, exclude, result }) => {
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
    isLargeResult = lineCount > 5; // Show collapsed view for more than 5 results
  }
  
  // Parse grep output for better formatting
  const parseGrepOutput = (content: string) => {
    const lines = content.split('\n');
    const parsed: Array<{type: 'file' | 'match' | 'context' | 'separator' | 'text', content: string, filename?: string}> = [];
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      // Handle separator lines
      if (line.trim() === '--') {
        parsed.push({type: 'separator', content: ''});
        continue;
      }
      
      // Check for file path with context (contains '-')
      // Format: "/path/to/file.tsx-context_content"
      if (line.includes('/') && line.includes('-')) {
        const dashIndex = line.lastIndexOf('-');
        const beforeDash = line.substring(0, dashIndex);
        const afterDash = line.substring(dashIndex + 1);
        
        // Check if this looks like a file path
        if (beforeDash.includes('/') && !beforeDash.includes(' ')) {
          const parts = beforeDash.split('/');
          const filename = parts[parts.length - 1];
          
          parsed.push({type: 'context', content: afterDash, filename});
          continue;
        }
      }
      
      // Check for file path with match (contains ':')
      // Format: "/path/to/file.tsx:match_content"
      if (line.includes('/') && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const beforeColon = line.substring(0, colonIndex);
        const afterColon = line.substring(colonIndex + 1);
        
        // Check if this looks like a file path
        if (beforeColon.includes('/') && !beforeColon.includes(' ')) {
          const parts = beforeColon.split('/');
          const filename = parts[parts.length - 1];
          
          parsed.push({type: 'match', content: afterColon, filename});
          continue;
        }
      }
      
      // Check if this is a standalone filename (no path, no separators)
      if (!line.includes('/') && !line.includes('-') && !line.includes(':') && line.includes('.')) {
        parsed.push({type: 'file', content: line});
        continue;
      }
      
      // If not a recognized format, just add the line as-is
      parsed.push({type: 'text', content: line});
    }
    
    return parsed;
  };

  const parsedContent = isError ? [] : parseGrepOutput(resultContent);
  
  // Create preview for collapsed view
  const createPreview = (parsed: Array<{type: 'file' | 'match' | 'context' | 'separator' | 'text', content: string, filename?: string}>, limit: number) => {
    const preview = parsed.slice(0, limit);
    return preview.length < parsed.length;
  };
  
  const isPreviewTruncated = createPreview(parsedContent, 12);
  
  // Build search description
  const searchDesc = [];
  if (path) searchDesc.push(`in ${path}`);
  if (include) searchDesc.push(`include: ${include}`);
  if (exclude) searchDesc.push(`exclude: ${exclude}`);
  const searchContext = searchDesc.length > 0 ? ` (${searchDesc.join(', ')})` : '';
  
  return (
    <div className="space-y-1 relative">
      <DebugLabel label="GrepWidget" />
      {/* Command section - outside the expand box */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm">Searching for pattern:</span>
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
          {pattern}
        </code>
        {searchContext && (
          <span className="text-xs text-muted-foreground">{searchContext}</span>
        )}
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
            <div className="p-3 text-xs font-mono bg-background overflow-auto">
              {isError ? (
                <div className="text-destructive whitespace-pre-wrap">
                  {resultContent || "Search failed"}
                </div>
              ) : parsedContent.length === 0 ? (
                <div className="text-muted-foreground">No matches found</div>
              ) : (
                <div className="space-y-0.5">
                  {(!isExpanded && isLargeResult ? parsedContent.slice(0, 12) : parsedContent).map((item, index) => (
                    <div key={index}>
                      {item.type === 'file' && (
                        <div className="font-bold text-primary mt-2 first:mt-0">
                          {item.content}
                        </div>
                      )}
                      {item.type === 'match' && (
                        <div className="text-foreground ml-4 whitespace-pre-wrap bg-accent/20 px-2 py-0.5 rounded">
                          {item.content}
                        </div>
                      )}
                      {item.type === 'context' && (
                        <div className="text-muted-foreground ml-4 whitespace-pre-wrap text-xs">
                          {item.content}
                        </div>
                      )}
                      {item.type === 'separator' && (
                        <div className="border-t border-muted my-2"></div>
                      )}
                      {item.type === 'text' && (
                        <div className="text-foreground whitespace-pre-wrap">{item.content}</div>
                      )}
                    </div>
                  ))}
                  {!isExpanded && isLargeResult && isPreviewTruncated && (
                    <div className="text-muted-foreground italic mt-2">...</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};