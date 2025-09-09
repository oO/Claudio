import React from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useSessionContext } from "@/contexts/SessionContext";

/**
 * Simple toggle button to show all assistant messages or only last per turn
 * When in "last" mode, also hides tools automatically
 */
export const AssistantMessageFilter: React.FC = () => {
  // Get assistant messages from context (processed by useMessageProcessing)
  const {
    assistantMessages = [],
    lastInTurnCount = 0,
    isAssistantFilterLast = false,
    toggleAssistantFilter,
  } = useSessionContext();

  const assistantMessageCount = assistantMessages.length;
  const hasAssistants = assistantMessageCount > 0;

  const handleToggle = () => {
    logger.log("🤖 Toggling assistant messages filter:", !isAssistantFilterLast);
    toggleAssistantFilter?.();
  };

  return (
    <div className="relative">
      <DebugLabel label="AssistantMessageFilter" />
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasAssistants}
        onClick={handleToggle}
        className={cn(
          hasAssistants &&
            !isAssistantFilterLast &&
            "bg-secondary text-foreground hover:bg-accent",
          hasAssistants &&
            isAssistantFilterLast &&
            "text-muted-foreground bg-transparent hover:bg-accent",
        )}
      >
        <Bot className="h-3 w-3" />
        <span>Agent</span>
        <div className="flex items-center justify-center text-muted-foreground w-7 h-5 bg-card-hover rounded-full text-xs font-medium">
          {isAssistantFilterLast ? "last" : "all"}
        </div>
      </Button>
    </div>
  );
};