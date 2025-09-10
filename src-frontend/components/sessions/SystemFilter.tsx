import React from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useSessionContext } from "@/contexts/SessionContext";

/**
 * Simple toggle button to show/hide system messages from conversation
 * Shows count of system messages in the badge - matches ProjectSessionTab filter style
 */
export const SystemFilter: React.FC = () => {
  // Get system messages from context (processed by useMessageProcessing)
  const {
    systemMessages = [],
    isSystemVisible = false,
    isAssistantFilterLast = false,
    toggleSystemVisibility,
  } = useSessionContext();

  const systemMessageCount = systemMessages.length;
  const hasSystemMessages = systemMessageCount > 0;
  const isDisabled = !hasSystemMessages || isAssistantFilterLast;

  const handleToggle = () => {
    if (isAssistantFilterLast) {
      logger.log(
        "⚙️ System filter disabled due to assistant filter being in Last mode",
      );
      return;
    }
    logger.log("⚙️ Toggling system messages visibility:", !isSystemVisible);
    toggleSystemVisibility?.();
  };

  return (
    <div className="relative">
      <DebugLabel label="SystemFilter" />
      <Button
        variant="secondary"
        size="sm"
        disabled={isDisabled}
        onClick={handleToggle}
        className={cn(
          hasSystemMessages &&
            isSystemVisible &&
            !isAssistantFilterLast &&
            "bg-secondary text-foreground hover:bg-accent",
          hasSystemMessages &&
            !isSystemVisible &&
            !isAssistantFilterLast &&
            "text-muted-foreground bg-transparent hover:bg-accent",
          isAssistantFilterLast && "opacity-50 cursor-not-allowed",
        )}
        title={
          isAssistantFilterLast
            ? "System messages hidden by assistant filter"
            : undefined
        }
      >
        <Settings className="h-3 w-3" />
        <div className="flex items-center justify-center text-muted-foreground w-7 h-5 bg-card-hover rounded-full text-xs font-medium">
          {systemMessageCount}
        </div>
      </Button>
    </div>
  );
};
