import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExecutionMetadata } from "@/components/ui/molecules/ExecutionMetadata";
import { OutputControlsToolbar } from "@/components/ui/molecules/OutputControlsToolbar";
import { StreamControls } from "@/components/ui/molecules/StreamControls";
import { ExecutionStatus } from "@/components/ui/atoms/ExecutionStatusBadge";
import { cn } from "@/lib/utils";

export interface ExecutionControlPanelProps {
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
  
  // Control states
  isRefreshing?: boolean;
  isFullscreen?: boolean;
  isAutoScrolling?: boolean;
  showScrollToTop?: boolean;
  showScrollToBottom?: boolean;
  
  // Callbacks
  onRefresh?: () => void;
  onStop?: () => void;
  onToggleFullscreen?: () => void;
  onCopyJsonl?: () => void;
  onCopyMarkdown?: () => void;
  onExport?: (format: "jsonl" | "markdown") => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  onToggleAutoScroll?: () => void;
  
  // Copy popover state
  copyPopoverOpen?: boolean;
  onCopyPopoverChange?: (open: boolean) => void;
  
  // Layout options
  compact?: boolean;
  showStreamControls?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const ExecutionControlPanel: React.FC<ExecutionControlPanelProps> = ({
  agentName,
  agentIcon,
  task,
  model,
  status,
  createdAt,
  duration,
  totalTokens,
  cost,
  isRefreshing = false,
  isFullscreen = false,
  isAutoScrolling = true,
  showScrollToTop = false,
  showScrollToBottom = false,
  onRefresh,
  onStop,
  onToggleFullscreen,
  onCopyJsonl,
  onCopyMarkdown,
  onExport,
  onScrollToTop,
  onScrollToBottom,
  onToggleAutoScroll,
  copyPopoverOpen = false,
  onCopyPopoverChange,
  compact = false,
  showStreamControls = true,
  orientation = "horizontal",
  className
}) => {
  const isRunning = status === "running";

  if (compact) {
    // Compact layout - single row with essential controls
    return (
      <div className={cn(
        "flex items-center justify-between gap-4 p-4 border-b",
        className
      )}>
        <ExecutionMetadata
          agentName={agentName}
          agentIcon={agentIcon}
          task={task}
          model={model}
          status={status}
          createdAt={createdAt}
          duration={duration}
          totalTokens={totalTokens}
          cost={cost}
          compact
          orientation="horizontal"
        />
        
        <div className="flex items-center gap-2">
          <OutputControlsToolbar
            isRunning={isRunning}
            isRefreshing={isRefreshing}
            isFullscreen={isFullscreen}
            onRefresh={onRefresh}
            onStop={onStop}
            onToggleFullscreen={onToggleFullscreen}
            onCopyJsonl={onCopyJsonl}
            onCopyMarkdown={onCopyMarkdown}
            onExport={onExport}
            copyPopoverOpen={copyPopoverOpen}
            onCopyPopoverChange={onCopyPopoverChange}
            compact
          />
        </div>
      </div>
    );
  }

  // Full layout with card structure
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className={cn(
          "flex justify-between gap-4",
          orientation === "vertical" ? "flex-col" : "flex-row items-start"
        )}>
          <ExecutionMetadata
            agentName={agentName}
            agentIcon={agentIcon}
            task={task}
            model={model}
            status={status}
            createdAt={createdAt}
            duration={duration}
            totalTokens={totalTokens}
            cost={cost}
            orientation={orientation}
            className="flex-1"
          />
          
          <OutputControlsToolbar
            isRunning={isRunning}
            isRefreshing={isRefreshing}
            isFullscreen={isFullscreen}
            onRefresh={onRefresh}
            onStop={onStop}
            onToggleFullscreen={onToggleFullscreen}
            onCopyJsonl={onCopyJsonl}
            onCopyMarkdown={onCopyMarkdown}
            onExport={onExport}
            copyPopoverOpen={copyPopoverOpen}
            onCopyPopoverChange={onCopyPopoverChange}
            orientation={orientation}
          />
        </div>
      </CardHeader>
      
      {showStreamControls && (
        <CardContent className="pt-0">
          <StreamControls
            status={status}
            isAutoScrolling={isAutoScrolling}
            showScrollToTop={showScrollToTop}
            showScrollToBottom={showScrollToBottom}
            onScrollToTop={onScrollToTop}
            onScrollToBottom={onScrollToBottom}
            onToggleAutoScroll={onToggleAutoScroll}
            compact={compact}
            orientation={orientation}
          />
        </CardContent>
      )}
    </Card>
  );
};