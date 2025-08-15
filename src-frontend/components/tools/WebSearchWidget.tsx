import React, { useState } from "react";
import { 
  Globe,
  Globe2,
  AlertCircle,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { open } from "@tauri-apps/plugin-shell";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Component to render parsed web search results with proper formatting
 */
const WebSearchResultsContent: React.FC<{
  sections: Array<{
    type: 'text' | 'links';
    content: string | Array<{ title: string; url: string }>;
  }>;
  noResults: boolean;
  isExpanded?: boolean;
  isLargeContent?: boolean;
}> = ({ sections, noResults, isExpanded = true, isLargeContent = false }) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  
  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const handleLinkClick = async (url: string) => {
    try {
      await open(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  if (!sections.length) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-muted-foreground">
        <div className="animate-pulse flex items-center gap-1">
          <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
        <span className="text-sm">Searching...</span>
      </div>
    );
  }

  if (noResults) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No results found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, idx) => {
        if (section.type === 'text') {
          return (
            <div key={idx} className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{section.content as string}</ReactMarkdown>
            </div>
          );
        } else if (section.type === 'links' && Array.isArray(section.content)) {
          const links = section.content;
          const isSectionExpanded = expandedSections.has(idx);
          
          return (
            <div key={idx} className="space-y-1.5">
              {/* Toggle Button */}
              <button
                onClick={() => toggleSection(idx)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSectionExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>{links.length} result{links.length !== 1 ? 's' : ''}</span>
              </button>
              
              {/* Links Display */}
              {isSectionExpanded ? (
                /* Expanded Card View */
                <div className="grid gap-1.5 ml-4">
                  {links.map((link, linkIdx) => (
                    <button
                      key={linkIdx}
                      onClick={() => handleLinkClick(link.url)}
                      className="group flex flex-col gap-0.5 p-2.5 rounded-md border bg-card/30 hover:bg-card/50 hover:border-blue-500/30 transition-all text-left"
                    >
                      <div className="flex items-start gap-2">
                        <Globe2 className="h-3.5 w-3.5 text-blue-500/70 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium group-hover:text-blue-500 transition-colors line-clamp-2">
                            {link.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {link.url}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* Collapsed Pills View */
                <div className="flex flex-wrap gap-1.5 ml-4">
                  {links.map((link, linkIdx) => (
                    <button
                      key={linkIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLinkClick(link.url);
                      }}
                      className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 transition-all"
                    >
                      <Globe2 className="h-3 w-3 text-blue-500/70" />
                      <span className="truncate max-w-[180px] text-foreground/70 group-hover:text-foreground/90">
                        {link.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

/**
 * Widget for WebSearch tool - displays web search query and results
 */
export const WebSearchWidget: React.FC<{ 
  query: string; 
  result?: any;
}> = ({ query, result }) => {
  // Parse the result to extract all links sections and build a structured representation
  const parseSearchResult = (resultContent: string) => {
    const sections: Array<{
      type: 'text' | 'links';
      content: string | Array<{ title: string; url: string }>;
    }> = [];
    
    // Split by "Links: [" to find all link sections
    const parts = resultContent.split(/Links:\s*\[/);
    
    // First part is always text (or empty)
    if (parts[0]) {
      sections.push({ type: 'text', content: parts[0].trim() });
    }
    
    // Process each links section
    parts.slice(1).forEach(part => {
      try {
        // Find the closing bracket
        const closingIndex = part.indexOf(']');
        if (closingIndex === -1) return;
        
        const linksJson = '[' + part.substring(0, closingIndex + 1);
        const remainingText = part.substring(closingIndex + 1).trim();
        
        // Parse the JSON array
        const links = JSON.parse(linksJson);
        sections.push({ type: 'links', content: links });
        
        // Add any remaining text
        if (remainingText) {
          sections.push({ type: 'text', content: remainingText });
        }
      } catch (e) {
        // If parsing fails, treat it as text
        sections.push({ type: 'text', content: 'Links: [' + part });
      }
    });
    
    return sections;
  };
  
  // Extract result content if available
  let searchResults: {
    sections: Array<{
      type: 'text' | 'links';
      content: string | Array<{ title: string; url: string }>;
    }>;
    noResults: boolean;
  } = { sections: [], noResults: false };
  
  let lineCount = 0;
  let resultContent = '';
  
  if (result) {
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
    
    searchResults.noResults = resultContent.toLowerCase().includes('no links found') || 
                               resultContent.toLowerCase().includes('no results');
    searchResults.sections = parseSearchResult(resultContent);
    
    // Count total lines/sections for expand threshold
    lineCount = searchResults.sections.reduce((count, section) => {
      if (section.type === 'text') {
        return count + (section.content as string).split('\n').length;
      } else if (section.type === 'links') {
        return count + (section.content as Array<any>).length;
      }
      return count;
    }, 0);
  }

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="WebSearchWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Globe}
        title="Web Search:"
        isLoading={!result}
        loadingText="Searching..."
      >
        <span className="text-sm text-muted-foreground/80 flex-1 truncate">{query}</span>
      </ToolWidgetTemplate.Header>
      
      {result && (
        <ToolWidgetTemplate.ExpandableResult
          largeContentThreshold={8}
          lineCount={lineCount}
          rawContent={resultContent}
          headerContent={
            <span className="text-xs font-mono text-muted-foreground">
              {searchResults.noResults ? "No results" : "Search Results"}
            </span>
          }
        >
          {(excerptedContent, isShowingExcerpt) => (
            <>
              <ToolWidgetTemplate.PlainOutput>
                <WebSearchResultsContent 
                  sections={searchResults.sections}
                  noResults={searchResults.noResults}
                />
              </ToolWidgetTemplate.PlainOutput>
            </>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      )}
    </ToolWidgetTemplate>
  );
};
