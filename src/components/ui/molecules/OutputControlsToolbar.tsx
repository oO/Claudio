import React from "react";
import { 
  Copy, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  StopCircle, 
  ChevronDown,
  Download
} from "lucide-react";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { ActionButtonGroup, ActionButtonGroupItem } from "@/components/ui/molecules/ActionButtonGroup";
import { Popover } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { OutputFormatBadge } from "@/components/ui/atoms/OutputFormatBadge";
import { cn } from "@/lib/utils";

export interface OutputControlsToolbarProps {
  isRunning?: boolean;
  isRefreshing?: boolean;
  isFullscreen?: boolean;
  onRefresh?: () => void;
  onStop?: () => void;
  onToggleFullscreen?: () => void;
  onCopyJsonl?: () => void;
  onCopyMarkdown?: () => void;
  onExport?: (format: "jsonl" | "markdown") => void;
  copyPopoverOpen?: boolean;
  onCopyPopoverChange?: (open: boolean) => void;
  orientation?: "horizontal" | "vertical";
  showLabels?: boolean;
  compact?: boolean;
  className?: string;
}

export const OutputControlsToolbar: React.FC<OutputControlsToolbarProps> = ({
  isRunning = false,
  isRefreshing = false,
  isFullscreen = false,
  onRefresh,
  onStop,
  onToggleFullscreen,
  onCopyJsonl,
  onCopyMarkdown,
  onExport,
  copyPopoverOpen = false,
  onCopyPopoverChange,
  orientation = "horizontal",
  showLabels = false,
  compact = false,
  className
}) => {
  // Core action buttons
  const actions: ActionButtonGroupItem[] = [
    {
      id: "refresh",
      icon: RotateCcw,
      label: "Refresh",
      onClick: onRefresh || (() => {}),
      disabled: isRefreshing,
      isLoading: isRefreshing,
      variant: "ghost"
    },
    {
      id: "fullscreen",
      icon: isFullscreen ? Minimize2 : Maximize2,
      label: isFullscreen ? "Exit Fullscreen" : "Fullscreen",
      onClick: onToggleFullscreen || (() => {}),
      variant: "ghost"
    }
  ];

  // Add stop button if running
  if (isRunning && onStop) {
    actions.unshift({
      id: "stop",
      icon: StopCircle,
      label: "Stop",
      onClick: onStop,
      variant: "ghost",
      disabled: isRefreshing
    });
  }

  return (
    <div className={cn(
      "flex gap-2",
      orientation === "vertical" ? "flex-col" : "flex-row items-center",
      className
    )}>
      {/* Copy Dropdown */}
      <Popover
        trigger={
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            className={cn(
              "gap-2",
              compact && "h-8 px-2"
            )}
          >
            <Copy className={cn(
              compact ? "h-3 w-3" : "h-4 w-4"
            )} />
            {showLabels && "Copy"}
            <ChevronDown className={cn(
              compact ? "h-2.5 w-2.5" : "h-3 w-3"
            )} />
          </Button>
        }
        content={
          <div className="w-48 p-1">
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onCopyJsonl?.();
                  onCopyPopoverChange?.(false);
                }}
              >
                <OutputFormatBadge format="jsonl" size="sm" />
                Copy as JSONL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onCopyMarkdown?.();
                  onCopyPopoverChange?.(false);
                }}
              >
                <OutputFormatBadge format="markdown" size="sm" />
                Copy as Markdown
              </Button>
            </div>
          </div>
        }
        open={copyPopoverOpen}
        onOpenChange={onCopyPopoverChange}
        align="end"
      />

      {/* Export Dropdown (if onExport provided) */}
      {onExport && (
        <Popover
          trigger={
            <Button
              variant="ghost"
              size={compact ? "sm" : "default"}
              className={cn(
                "gap-2",
                compact && "h-8 px-2"
              )}
            >
              <Download className={cn(
                compact ? "h-3 w-3" : "h-4 w-4"
              )} />
              {showLabels && "Export"}
              <ChevronDown className={cn(
                compact ? "h-2.5 w-2.5" : "h-3 w-3"
              )} />
            </Button>
          }
          content={
            <div className="w-48 p-1">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => onExport("jsonl")}
                >
                  <OutputFormatBadge format="jsonl" size="sm" />
                  Export as JSONL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => onExport("markdown")}
                >
                  <OutputFormatBadge format="markdown" size="sm" />
                  Export as Markdown
                </Button>
              </div>
            </div>
          }
          align="end"
        />
      )}

      {/* Main Action Buttons */}
      <ActionButtonGroup
        actions={actions}
        orientation={orientation}
        size={compact ? "sm" : "default"}
        showLabels={showLabels}
      />
    </div>
  );
};