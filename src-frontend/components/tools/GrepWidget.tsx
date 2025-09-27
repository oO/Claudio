import React from "react";
import { Search } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Component to render parsed grep results with proper formatting
 */
const GrepResultsContent: React.FC<{
  parsedContent: Array<{type: 'file' | 'match' | 'context' | 'separator' | 'text', content: string, filename?: string}>;
  isExpanded?: boolean;
  isLargeContent?: boolean;
}> = ({ parsedContent, isExpanded = true, isLargeContent = false }) => {
  // Determine how many items to show based on expand state
  const displayContent = (!isExpanded && isLargeContent) ? parsedContent.slice(0, 12) : parsedContent;
  const isPreviewTruncated = (!isExpanded && isLargeContent) && displayContent.length < parsedContent.length;

  return (
    <div className="space-y-0.5">
      {displayContent.map((item, index) => (
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
      {isPreviewTruncated && (
        <div className="text-muted-foreground italic mt-2">...</div>
      )}
    </div>
  );
};

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
  
  // Build search description
  const searchDesc = [];
  if (path) searchDesc.push(`in ${path}`);
  if (include) searchDesc.push(`include: ${include}`);
  if (exclude) searchDesc.push(`exclude: ${exclude}`);
  const searchContext = searchDesc.length > 0 ? ` (${searchDesc.join(', ')})` : '';
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="GrepWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Search}
        title="Searching with pattern:"
        isLoading={!result}
        loadingText="Searching..."
      >
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
          {pattern}
        </code>
        {searchContext && (
          <span className="text-xs text-muted-foreground">{searchContext}</span>
        )}
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
          {(excerptedContent, isShowingExcerpt, isExpanded) => {
            const displayContent = isShowingExcerpt ? excerptedContent : resultContent;
            const displayParsedContent = parseGrepOutput(displayContent);
            
            return (
              <>
                <ToolWidgetTemplate.CodeOutput isExpanded={isExpanded}>
                  {isError ? (
                    <div className="text-destructive whitespace-pre-wrap">
                      {displayContent || "Search failed"}
                    </div>
                  ) : displayParsedContent.length === 0 ? (
                    <div className="text-muted-foreground">No matches found</div>
                  ) : (
                    <GrepResultsContent parsedContent={displayParsedContent} />
                  )}
                </ToolWidgetTemplate.CodeOutput>
                {isShowingExcerpt && (
                  <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground text-center">
                    --- {resultContent.split('\n').length - 5} more lines, {resultContent.length - excerptedContent.length} more characters ---
                  </div>
                )}
              </>
            );
          }}
        </ToolWidgetTemplate.ExpandableResult>
      )}
    </ToolWidgetTemplate>
  );
};