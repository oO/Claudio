import React from "react";
import { GitBranch } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for displaying MultiEdit tool results with diffs
 */
export const MultiEditResultWidget: React.FC<{ 
  content: string;
  edits?: Array<{ old_string: string; new_string: string }>;
}> = ({ content, edits }) => {
  // Calculate total line count for expand threshold
  const totalLines = edits ? edits.reduce((count, edit) => {
    return count + edit.old_string.split('\n').length + edit.new_string.split('\n').length;
  }, 0) : content.split('\n').length;

  // If we have the edits array, show a nice diff view
  if (edits && edits.length > 0) {
    return (
      <ToolWidgetTemplate>
        <ToolWidgetTemplate.Debug label="MultiEditResultWidget" />
        
        <ToolWidgetTemplate.Header
          icon={GitBranch}
          title={`${edits.length} Changes Applied`}
          isLoading={false}
        />
        
        <ToolWidgetTemplate.ExpandableResult
          largeContentThreshold={25}
          lineCount={totalLines}
          rawContent={edits ? edits.map((edit, index) => 
            `Edit ${index + 1}:\n-${edit.old_string}\n+${edit.new_string}`
          ).join('\n\n') : content}
          headerContent={
            <span className="text-xs font-mono text-muted-foreground">
              Diff view
            </span>
          }
        >
          {(excerptedContent, isShowingExcerpt, isExpanded) => (
            <>
              <ToolWidgetTemplate.PlainOutput isExpanded={isExpanded}>
                <div className="space-y-4">
                  {edits.map((edit, index) => {
                    // Split the strings into lines for diff display
                    const oldLines = edit.old_string.split('\n');
                    const newLines = edit.new_string.split('\n');
                    
                    return (
                      <div key={index} className="border border-border/50 rounded-md overflow-hidden">
                        <div className="px-3 py-1 bg-muted/50 border-b border-border/50">
                          <span className="text-xs font-medium text-muted-foreground">Change {index + 1}</span>
                        </div>
                        
                        <div className="font-mono text-xs">
                          {/* Show removed lines */}
                          {oldLines.map((line, lineIndex) => (
                            <div
                              key={`old-${lineIndex}`}
                              className="flex bg-red-500/10 border-l-4 border-red-500"
                            >
                              <span className="w-12 px-2 py-1 text-red-600 dark:text-red-400 select-none text-right bg-red-500/10">
                                -{lineIndex + 1}
                              </span>
                              <pre className="flex-1 px-3 py-1 text-red-700 dark:text-red-300 overflow-x-auto">
                                <code>{line || ' '}</code>
                              </pre>
                            </div>
                          ))}
                          
                          {/* Show added lines */}
                          {newLines.map((line, lineIndex) => (
                            <div
                              key={`new-${lineIndex}`}
                              className="flex bg-green-500/10 border-l-4 border-green-500"
                            >
                              <span className="w-12 px-2 py-1 text-green-600 dark:text-green-400 select-none text-right bg-green-500/10">
                                +{lineIndex + 1}
                              </span>
                              <pre className="flex-1 px-3 py-1 text-green-700 dark:text-green-300 overflow-x-auto">
                                <code>{line || ' '}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ToolWidgetTemplate.PlainOutput>
            </>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      </ToolWidgetTemplate>
    );
  }

  // Fallback to plain content display
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="MultiEditResultWidget" />
      
      <ToolWidgetTemplate.Header
        icon={GitBranch}
        title="Multi-Edit Result"
        isLoading={false}
      />
      
      <ToolWidgetTemplate.ExpandableResult
        largeContentThreshold={20}
        lineCount={content.split('\n').length}
        rawContent={content}
        headerContent={
          <span className="text-xs font-mono text-muted-foreground">
            Result content
          </span>
        }
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <>
            <ToolWidgetTemplate.CodeOutput isExpanded={isExpanded}>
              {excerptedContent}
            </ToolWidgetTemplate.CodeOutput>
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
