import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ChevronDown, X, Terminal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { MessageRouter } from "@/components/messages";
import { ErrorBoundary, ICON_MAP as AGENT_ICONS } from "@/components/common";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import type { Agent } from "@/lib/api";
import type { ClaudeStreamMessage } from "@/hooks/useAgentExecution";
import type { Virtualizer } from "@tanstack/react-virtual";

interface FullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
  isRunning: boolean;
  messages: ClaudeStreamMessage[];
  displayableMessages: ClaudeStreamMessage[];
  fullscreenScrollRef: React.RefObject<HTMLDivElement>;
  fullscreenMessagesEndRef: React.RefObject<HTMLDivElement>;
  fullscreenRowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  copyPopoverOpen: boolean;
  setCopyPopoverOpen: (open: boolean) => void;
  onScroll: () => void;
  onCopyAsJsonl: () => void;
  onCopyAsMarkdown: () => void;
}

export const FullscreenModal: React.FC<FullscreenModalProps> = ({
  isOpen,
  onClose,
  agent,
  isRunning,
  messages,
  displayableMessages,
  fullscreenScrollRef,
  fullscreenMessagesEndRef,
  fullscreenRowVirtualizer,
  copyPopoverOpen,
  setCopyPopoverOpen,
  onScroll,
  onCopyAsJsonl,
  onCopyAsMarkdown,
}) => {
  const renderIcon = () => {
    const Icon = agent.icon in AGENT_ICONS ? AGENT_ICONS[agent.icon as keyof typeof AGENT_ICONS] : Terminal;
    return <Icon className="h-5 w-5" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Modal Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {renderIcon()}
          <h2 className="text-lg font-semibold">{agent.name} - Output</h2>
          {isRunning && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 font-medium">Running</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Output
                <ChevronDown className="h-3 w-3" />
              </Button>
            }
            content={
              <div className="w-44 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onCopyAsJsonl}
                >
                  Copy as JSONL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onCopyAsMarkdown}
                >
                  Copy as Markdown
                </Button>
              </div>
            }
            open={copyPopoverOpen}
            onOpenChange={setCopyPopoverOpen}
            align="end"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </div>

      {/* Modal Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div 
          ref={fullscreenScrollRef}
          className="h-full overflow-y-auto space-y-8"
          onScroll={onScroll}
        >
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
              <LoadingSpinner message="Initializing agent..." />
            </div>
          )}

          <div
            className="relative w-full max-w-5xl mx-auto"
            style={{ height: `${fullscreenRowVirtualizer.getTotalSize()}px` }}
          >
            <AnimatePresence>
              {fullscreenRowVirtualizer.getVirtualItems().map((virtualItem) => {
                const message = displayableMessages[virtualItem.index];
                return (
                  <motion.div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={(el) => el && fullscreenRowVirtualizer.measureElement(el)}
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
          
          <div ref={fullscreenMessagesEndRef} />
        </div>
      </div>
    </div>
  );
};