import React from "react";
import { Terminal } from "lucide-react";
import { detectLinks, makeLinksClickable } from "@/lib/linkDetector";
import { useLinkNotification } from "@/contexts/LinkNotificationContext";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for command output/stdout
 * Handles its own link detection and notification
 */
export const CommandOutputWidget: React.FC<{ 
  output: string;
}> = ({ output }) => {
  const notifyLinkDetected = useLinkNotification();

  // Check for links on mount and when output changes
  React.useEffect(() => {
    if (output) {
      const links = detectLinks(output);
      if (links.length > 0) {
        // Notify about the first detected link
        notifyLinkDetected(links[0].fullUrl);
      }
    }
  }, [output, notifyLinkDetected]);

  // Parse ANSI codes for basic styling
  const parseAnsiToReact = (text: string) => {
    // Simple ANSI parsing - handles bold (\u001b[1m) and reset (\u001b[22m)
    const parts = text.split(/(\u001b\[\d+m)/);
    let isBold = false;
    const elements: React.ReactNode[] = [];
    
    parts.forEach((part, idx) => {
      if (part === '\u001b[1m') {
        isBold = true;
        return;
      } else if (part === '\u001b[22m') {
        isBold = false;
        return;
      } else if (part.match(/\u001b\[\d+m/)) {
        // Ignore other ANSI codes for now
        return;
      }
      
      if (!part) return;
      
      // Make links clickable within this part
      const linkElements = makeLinksClickable(part, notifyLinkDetected);
      
      if (isBold) {
        elements.push(
          <span key={idx} className="font-bold">
            {linkElements}
        </span>
      );
      } else {
        elements.push(...linkElements);
      }
    });
    
    return elements;
  };

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="CommandOutputWidget" />
      <ToolWidgetTemplate.Header icon={Terminal} title="Command output" />
      
      <ToolWidgetTemplate.ExpandableResult
        headerContent={
          <span className="text-xs font-mono text-green-600 dark:text-green-400">Output</span>
        }
        rawContent={output}
        lineCount={output ? output.split('\n').length : 0}
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <>
            <ToolWidgetTemplate.CodeOutput isExpanded={isExpanded}>
              {output ? parseAnsiToReact(excerptedContent) : <span className="text-muted-foreground italic">No output</span>}
            </ToolWidgetTemplate.CodeOutput>
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
