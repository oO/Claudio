import React from "react";
import { Drill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
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
    isAssistantFilterLast = false,
    toggleToolsVisibility,
  } = useSessionContext();

  const toolMessageCount = toolMessages.length;
  const hasTools = toolMessageCount > 0;
  const isDisabled = !hasTools || isAssistantFilterLast;

  const handleToggle = () => {
    if (isAssistantFilterLast) {
      return;
    }
    toggleToolsVisibility?.();
  };

  return (
    <div className="relative">
      <DebugLabel label="ToolFilter" />
      <Button
        variant="secondary"
        size="sm"
        disabled={isDisabled}
        onClick={handleToggle}
        className={cn(
          hasTools &&
            isToolsVisible &&
            !isAssistantFilterLast &&
            "bg-secondary text-foreground hover:bg-accent",
          hasTools &&
            !isToolsVisible &&
            !isAssistantFilterLast &&
            "text-muted-foreground bg-transparent hover:bg-accent",
          isAssistantFilterLast && "opacity-50 cursor-not-allowed",
        )}
        title={
          isAssistantFilterLast ? "Tools hidden by assistant filter" : undefined
        }
      >
        <Drill className="h-3 w-3" />
        <div className="flex items-center justify-center text-muted-foreground w-7 h-5 bg-card-hover rounded-full text-xs font-medium">
          {toolMessageCount}
        </div>
      </Button>
    </div>
  );
};
