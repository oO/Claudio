import React, { useState } from "react";
import { 
  Globe,
  AlertCircle,
  ChevronRight,
  Info,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-shell";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for WebFetch tool - displays URL fetching with optional prompts
 */
export const WebFetchWidget: React.FC<{ 
  url: string;
  prompt?: string;
  result?: any;
}> = ({ url, prompt, result }) => {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  
  // Extract result content if available
  let fetchedContent = '';
  let isLoading = !result;
  let hasError = false;
  
  if (result) {
    if (typeof result.content === 'string') {
      fetchedContent = result.content;
    } else if (result.content && typeof result.content === 'object') {
      if (result.content.text) {
        fetchedContent = result.content.text;
      } else if (Array.isArray(result.content)) {
        fetchedContent = result.content
          .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
          .join('\n');
      } else {
        fetchedContent = JSON.stringify(result.content, null, 2);
      }
    }
    
    // Check if there's an error
    hasError = result.is_error || 
               fetchedContent.toLowerCase().includes('error') ||
               fetchedContent.toLowerCase().includes('failed');
  }
  
  // Calculate line count for ExpandableResult
  const lineCount = fetchedContent ? fetchedContent.split('\n').length : 0;
  
  // Extract domain from URL for display
  const getDomain = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname;
    } catch {
      return urlString;
    }
  };
  
  const handleUrlClick = async () => {
    try {
      await open(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="WebFetchWidget" />
      
      <ToolWidgetTemplate.Header 
        icon={Globe} 
        title="Fetching from:"
        isLoading={isLoading}
        loadingText={`Fetching content from ${getDomain(url)}...`}
      >
        <button
          onClick={handleUrlClick}
          className="text-sm text-foreground/80 hover:text-foreground truncate text-left hover:underline ml-2 flex-1 min-w-0"
        >
          {url}
        </button>
      </ToolWidgetTemplate.Header>

      {/* Prompt Display */}
      {prompt && (
        <div className="ml-6 space-y-1">
          <button
            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", isPromptExpanded && "rotate-90")} />
            <Info className="h-3 w-3" />
            <span>Analysis Prompt</span>
          </button>
          
          {isPromptExpanded && (
            <div className="rounded-lg border bg-muted/30 p-3 ml-4">
              <p className="text-sm text-foreground/90">
                {prompt}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!isLoading && (
        <ToolWidgetTemplate.ExpandableResult
          lineCount={lineCount}
          rawContent={fetchedContent}
          headerContent={
            hasError ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Failed to fetch content</span>
              </div>
            ) : fetchedContent ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>Content from {getDomain(url)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                <span className="text-sm">No content returned</span>
              </div>
            )
          }
        >
          {(excerptedContent, isShowingExcerpt) => (
            <>
              {fetchedContent ? (
                <ToolWidgetTemplate.CodeOutput>
                  {excerptedContent}
                </ToolWidgetTemplate.CodeOutput>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">
                  No content available
                </div>
              )}
            </>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      )}
    </ToolWidgetTemplate>
  );
};
