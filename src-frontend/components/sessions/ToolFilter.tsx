import React from "react";
import { Drill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useSessionContext } from "@/contexts/SessionContext";

/**
 * Simple toggle button to show/hide tool messages from conversation
 * Shows count of tool messages in the badge - matches ProjectSessionTab filter style
 */
export const ToolFilter: React.FC = () => {
  // Get tool messages from context (processed by useMessageProcessing)
  const {
    toolMessages = [],
    isToolsVisible = true,
    toggleToolsVisibility,
  } = useSessionContext();

  const toolMessageCount = toolMessages.length;
  const hasTools = toolMessageCount > 0;

  const handleToggle = () => {
    logger.log("🔧 Toggling tool messages visibility:", !isToolsVisible);
    toggleToolsVisibility?.();
  };

  return (
    <div className="relative">
      <DebugLabel label="ToolFilter" />
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasTools}
        onClick={handleToggle}
        className={cn(
          hasTools &&
            isToolsVisible &&
            "bg-secondary text-foreground hover:bg-accent",
          hasTools &&
            !isToolsVisible &&
            "text-muted-foreground bg-transparent hover:bg-accent",
        )}
      >
        <Drill className="h-3 w-3" />
        <span>Tools</span>
        <div className="flex items-center justify-center text-muted-foreground w-7 h-5 bg-card-hover rounded-full text-xs font-medium">
          {toolMessageCount}
        </div>
      </Button>
    </div>
  );
};
