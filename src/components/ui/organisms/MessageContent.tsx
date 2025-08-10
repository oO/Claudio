import React from "react";
import { MarkdownRenderer } from "../molecules/MarkdownRenderer";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  content: any;
  onLinkDetected?: (url: string) => void;
  className?: string;
}

/**
 * Organism component for rendering message text content
 * Handles various content formats and delegates to appropriate renderers
 */
export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  onLinkDetected,
  className
}) => {
  // Extract text content from various formats
  const extractTextContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (content?.text) {
      return typeof content.text === 'string' 
        ? content.text 
        : (content.text?.text || JSON.stringify(content.text));
    }
    
    return JSON.stringify(content || '');
  };

  // Handle array of content blocks
  if (Array.isArray(content)) {
    return (
      <div className={cn("space-y-1", className)}>
        {content.map((block: any, idx: number) => {
          if (block.type === "text") {
            const textContent = extractTextContent(block);
            if (!textContent.trim()) return null;
            
            return (
              <MarkdownRenderer
                key={idx}
                content={textContent}
                compact
                onLinkDetected={onLinkDetected}
              />
            );
          }
          return null;
        }).filter(Boolean)}
      </div>
    );
  }

  // Handle single content block
  const textContent = extractTextContent(content);
  if (!textContent.trim()) return null;

  // Check if it's a simple string that doesn't need markdown processing
  const isSimpleText = !textContent.includes('\n') && 
                      !textContent.includes('*') && 
                      !textContent.includes('#') &&
                      !textContent.includes('[') &&
                      !textContent.includes('`');

  if (isSimpleText) {
    return (
      <div className={cn("text-sm", className)}>
        {textContent}
      </div>
    );
  }

  // Use markdown renderer for rich content
  return (
    <MarkdownRenderer
      content={textContent}
      compact
      onLinkDetected={onLinkDetected}
      className={className}
    />
  );
};