import React, { useRef } from "react";
import { X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutionControlPanel } from "./ExecutionControlPanel";
import { OutputViewer } from "./OutputViewer";
import { ExecutionStatus } from "@/components/ui/atoms/ExecutionStatusBadge";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { cn } from "@/lib/utils";

export interface FullscreenOutputModalProps {
  // Modal state
  open: boolean;
  onClose: () => void;
  
  // Agent metadata
  agentName: string;
  agentIcon?: string;
  task: string;
  model: string;
  status: ExecutionStatus;
  createdAt: string;
  duration?: number;
  totalTokens?: number;
  cost?: number;
  
  // Output data
  messages: ClaudeStreamMessage[];
  loading?: boolean;
  error?: string | null;
  
  // Control states
  isRefreshing?: boolean;
  isAutoScrolling?: boolean;
  
  // Callbacks
  onRefresh?: () => void;
  onStop?: () => void;
  onCopyJsonl?: () => void;
  onCopyMarkdown?: () => void;
  onExport?: (format: "jsonl" | "markdown") => void;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  
  // Copy popover state
  copyPopoverOpen?: boolean;
  onCopyPopoverChange?: (open: boolean) => void;
  
  className?: string;
}

export const FullscreenOutputModal: React.FC<FullscreenOutputModalProps> = ({
  open,
  onClose,
  agentName,
  agentIcon,
  task,
  model,
  status,
  createdAt,
  duration,
  totalTokens,
  cost,
  messages,
  loading = false,
  error = null,
  isRefreshing = false,
  isAutoScrolling = true,
  onRefresh,
  onStop,
  onCopyJsonl,
  onCopyMarkdown,
  onExport,
  onScroll,
  copyPopoverOpen = false,
  onCopyPopoverChange,
  className
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const handleScrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!open) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-background z-[60] flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ExecutionControlPanel
          agentName={agentName}
          agentIcon={agentIcon}
          task={task}
          model={model}
          status={status}
          createdAt={createdAt}
          duration={duration}
          totalTokens={totalTokens}
          cost={cost}
          isRefreshing={isRefreshing}
          isFullscreen={true}
          isAutoScrolling={isAutoScrolling}
          onRefresh={onRefresh}
          onStop={onStop}
          onCopyJsonl={onCopyJsonl}
          onCopyMarkdown={onCopyMarkdown}
          onExport={onExport}
          copyPopoverOpen={copyPopoverOpen}
          onCopyPopoverChange={onCopyPopoverChange}
          compact
          showStreamControls={false}
        />
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-2"
          >
            <Minimize2 className="h-4 w-4" />
            Exit Fullscreen
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-6xl mx-auto">
          <OutputViewer
            messages={messages}
            loading={loading}
            error={error}
            autoScroll={isAutoScrolling}
            onScroll={onScroll}
            onScrollToTop={handleScrollToTop}
            onScrollToBottom={handleScrollToBottom}
            containerRef={scrollRef}
            endRef={endRef}
            className="h-full"
            emptyMessage="No output available yet"
            loadingMessage="Loading agent output..."
          />
        </div>
      </div>
    </div>
  );
};