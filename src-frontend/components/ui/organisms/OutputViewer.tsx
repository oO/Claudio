import React, { useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { StatusMessage } from "@/components/ui/molecules/StatusMessage";
import { ScrollIndicator } from "@/components/ui/atoms/ScrollIndicator";
import { MessageRouter } from "@/components/messages";
import { ErrorBoundary } from "@/components/common";
import type { ClaudeStreamMessage } from "@/hooks/useAgentExecution";
import { cn } from "@/lib/utils";

export interface OutputViewerProps {
  messages: ClaudeStreamMessage[];
  loading?: boolean;
  error?: string | null;
  autoScroll?: boolean;
  showScrollIndicators?: boolean;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
  endRef?: React.RefObject<HTMLDivElement>;
}

export const OutputViewer: React.FC<OutputViewerProps> = ({
  messages,
  loading = false,
  error = null,
  autoScroll = true,
  showScrollIndicators = true,
  onScroll,
  onScrollToTop,
  onScrollToBottom,
  emptyMessage = "No output available yet",
  loadingMessage = "Loading output...",
  className,
  containerRef,
  endRef
}) => {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const internalEndRef = useRef<HTMLDivElement>(null);
  
  const scrollRef = containerRef || internalScrollRef;
  const endElementRef = endRef || internalEndRef;

  // Filter displayable messages
  const displayableMessages = useMemo(() => {
    return messages.filter((message) => {
      if (message.isMeta && !message.leafUuid && !message.summary) return false;

      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) return false;

        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") { 
              hasVisibleContent = true; 
              break; 
            }
            if (content.type === "tool_result") {
              // Check if this tool result will be displayed as a widget
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Find the corresponding tool use
                for (let i = messages.indexOf(message) - 1; i >= 0; i--) {
                  const prevMsg = messages[i];
                  if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                    const toolUse = prevMsg.message.content.find((c: any) => c.type === 'tool_use' && c.id === content.tool_use_id);
                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();
                      const toolsWithWidgets = ['task','edit','multiedit','todowrite','ls','read','glob','bash','write','grep'];
                      if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                        willBeSkipped = true;
                      }
                      break;
                    }
                  }
                }
              }
              if (!willBeSkipped) { 
                hasVisibleContent = true; 
                break; 
              }
            }
          }
          if (!hasVisibleContent) return false;
        }
      }
      return true;
    });
  }, [messages]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (autoScroll && endElementRef.current) {
      endElementRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Show loading state
  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full",
        className
      )}>
        <LoadingSpinner size="default" message={loadingMessage} />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={cn("p-4", className)}>
        <StatusMessage
          type="error"
          message={error}
        />
      </div>
    );
  }

  // Show empty state
  if (messages.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full text-muted-foreground",
        className
      )}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full", className)}>
      <div 
        ref={scrollRef}
        className="h-full overflow-y-auto p-4 space-y-2"
        onScroll={onScroll}
      >
        <AnimatePresence mode="popLayout">
          {displayableMessages.map((message: ClaudeStreamMessage, index: number) => (
            <motion.div
              key={`${index}-${message.type}-${message.timestamp || Date.now()}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ 
                duration: 0.2,
                ease: "easeOut"
              }}
              layout
            >
              <ErrorBoundary fallback={(error, reset) => (
                <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">
                    Failed to render message at index {index}
                  </p>
                </div>
              )}>
                <MessageRouter 
                  message={message} 
                  streamMessages={messages} 
                />
              </ErrorBoundary>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endElementRef} className="h-1" />
      </div>

      {/* Scroll Indicators */}
      {showScrollIndicators && (
        <>
          <ScrollIndicator
            direction="up"
            visible={!!onScrollToTop}
            onClick={onScrollToTop}
            position="top"
          />
          <ScrollIndicator
            direction="down"
            visible={!!onScrollToBottom}
            onClick={onScrollToBottom}
            position="bottom"
          />
        </>
      )}
    </div>
  );
};