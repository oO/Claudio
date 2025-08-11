import React from "react";
import { ChevronRight } from "lucide-react";
import { detectLinks, makeLinksClickable } from "@/lib/linkDetector";

/**
 * Widget for command output/stdout
 */
export const CommandOutputWidget: React.FC<{ 
  output: string;
  onLinkDetected?: (url: string) => void;
}> = ({ output, onLinkDetected }) => {
  // Check for links on mount and when output changes
  React.useEffect(() => {
    if (output && onLinkDetected) {
      const links = detectLinks(output);
      if (links.length > 0) {
        // Notify about the first detected link
        onLinkDetected(links[0].fullUrl);
      }
    }
  }, [output, onLinkDetected]);

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
      const linkElements = makeLinksClickable(part, (url) => {
        onLinkDetected?.(url);
      });
      
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
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-green-600 dark:text-green-400" />
        <span className="text-xs font-mono text-green-600 dark:text-green-400">Output</span>
      </div>
      <div className="p-3">
        <pre className="text-sm font-mono text-foreground whitespace-pre-wrap">
          {output ? parseAnsiToReact(output) : <span className="text-muted-foreground italic">No output</span>}
        </pre>
      </div>
    </div>
  );
};