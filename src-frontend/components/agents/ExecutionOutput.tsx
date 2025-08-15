import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Loader2 } from "lucide-react";
import { MessageRouter } from "@/components/messages";
import { ErrorBoundary } from "@/components/common";
import { LoadingSpinner, DebugLabel } from "@/components/ui/atoms";
import type { ClaudeStreamMessage } from "@/hooks/useAgentExecution";
import type { Virtualizer } from "@tanstack/react-virtual";

interface ExecutionOutputProps {
  isRunning: boolean;
  messages: ClaudeStreamMessage[];
  displayableMessages: ClaudeStreamMessage[];
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  onScroll: () => void;
}

export const ExecutionOutput: React.FC<ExecutionOutputProps> = ({
  isRunning,
  messages,
  displayableMessages,
  scrollContainerRef,
  messagesEndRef,
  rowVirtualizer,
  onScroll,
}) => {
  return (
    <div className="flex-1 overflow-hidden relative">
      <DebugLabel label="ExecutionOutput" />
      <div className="w-full max-w-5xl mx-auto h-full">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto p-6 space-y-8"
          onScroll={onScroll}
        >
          <div>
          {messages.length === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Terminal className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Ready to Execute</h3>
              <p className="text-sm text-muted-foreground">
                Select a project path and enter a task to run the agent
              </p>
            </div>
          )}

          {isRunning && messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner message="Starting execution..." />
            </div>
          )}

          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            <AnimatePresence>
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const message = displayableMessages[virtualItem.index];
                return (
                  <motion.div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={(el) => el && rowVirtualizer.measureElement(el)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-x-4 pb-4"
                    style={{ top: virtualItem.start }}
                  >
                    <ErrorBoundary>
                      <MessageRouter message={message} streamMessages={messages} />
                    </ErrorBoundary>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          
          <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};