import React from "react";
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward,
  Volume2,
  VolumeX
} from "lucide-react";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { ActionButtonGroup, ActionButtonGroupItem } from "@/components/ui/molecules/ActionButtonGroup";
import { ExecutionStatusBadge, ExecutionStatus } from "@/components/ui/atoms/ExecutionStatusBadge";
import { ScrollIndicator } from "@/components/ui/atoms/ScrollIndicator";
import { cn } from "@/lib/utils";

export interface StreamControlsProps {
  status: ExecutionStatus;
  isAutoScrolling?: boolean;
  showScrollToTop?: boolean;
  showScrollToBottom?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  onToggleAutoScroll?: () => void;
  onScrollToStart?: () => void;
  onScrollToEnd?: () => void;
  compact?: boolean;
  showLabels?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const StreamControls: React.FC<StreamControlsProps> = ({
  status,
  isAutoScrolling = true,
  showScrollToTop = false,
  showScrollToBottom = false,
  onPlay,
  onPause,
  onStop,
  onScrollToTop,
  onScrollToBottom,
  onToggleAutoScroll,
  onScrollToStart,
  onScrollToEnd,
  compact = false,
  showLabels = false,
  orientation = "horizontal",
  className
}) => {
  const playbackActions: ActionButtonGroupItem[] = [];

  // Add play/pause based on status
  if (status === "running" && onPause) {
    playbackActions.push({
      id: "pause",
      icon: Pause,
      label: "Pause",
      onClick: onPause,
      variant: "ghost"
    });
  } else if (status !== "running" && onPlay) {
    playbackActions.push({
      id: "play",
      icon: Play,
      label: "Resume",
      onClick: onPlay,
      variant: "ghost"
    });
  }

  // Add stop if running
  if (status === "running" && onStop) {
    playbackActions.push({
      id: "stop",
      icon: Square,
      label: "Stop",
      onClick: onStop,
      variant: "ghost"
    });
  }

  // Scrolling actions
  const scrollActions: ActionButtonGroupItem[] = [];

  if (onScrollToStart) {
    scrollActions.push({
      id: "scroll-start",
      icon: SkipBack,
      label: "Go to Start",
      onClick: onScrollToStart,
      variant: "ghost"
    });
  }

  if (onScrollToEnd) {
    scrollActions.push({
      id: "scroll-end",
      icon: SkipForward,
      label: "Go to End",
      onClick: onScrollToEnd,
      variant: "ghost"
    });
  }

  if (onToggleAutoScroll) {
    scrollActions.push({
      id: "toggle-autoscroll",
      icon: isAutoScrolling ? Volume2 : VolumeX,
      label: isAutoScrolling ? "Disable Auto-scroll" : "Enable Auto-scroll",
      onClick: onToggleAutoScroll,
      variant: isAutoScrolling ? "default" : "ghost"
    });
  }

  return (
    <div className={cn(
      "flex gap-4 items-center",
      orientation === "vertical" ? "flex-col items-stretch" : "flex-row",
      className
    )}>
      {/* Status Badge */}
      <ExecutionStatusBadge 
        status={status}
        size={compact ? "sm" : "default"}
        animated={status === "running"}
      />

      {/* Playback Controls */}
      {playbackActions.length > 0 && (
        <ActionButtonGroup
          actions={playbackActions}
          orientation={orientation}
          size={compact ? "sm" : "default"}
          showLabels={showLabels}
        />
      )}

      {/* Scroll Controls */}
      {scrollActions.length > 0 && (
        <ActionButtonGroup
          actions={scrollActions}
          orientation={orientation}
          size={compact ? "sm" : "default"}
          showLabels={showLabels}
        />
      )}

      {/* Scroll Indicators */}
      <div className="relative flex gap-2">
        <ScrollIndicator
          direction="up"
          visible={showScrollToTop}
          onClick={onScrollToTop}
          position="top"
        />
        <ScrollIndicator
          direction="down"
          visible={showScrollToBottom}
          onClick={onScrollToBottom}
          position="bottom"
        />
      </div>
    </div>
  );
};