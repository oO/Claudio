import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DebugLabel } from "@/components/ui/atoms";
import { useSessionContext } from "@/contexts/SessionContext";
import { logger } from "@/lib/logger";

interface UserMessageNavigationProps {
  onNavigate: (messageIndex: number) => void;
}

/**
 * Simple user message navigation dropdown for jumping to conversation turns
 * Shows truncated user messages for quick navigation
 */
export const UserMessageNavigation: React.FC<UserMessageNavigationProps> = ({
  onNavigate,
}) => {
  // Get user messages from context (processed by useMessageProcessing)
  const { userMessages = [] } = useSessionContext();

  const handleNavigate = (messageIndex: number) => {
    logger.log("🔸 Navigating to user message at index:", messageIndex);
    onNavigate(messageIndex);
  };

  const hasMessages = userMessages.length > 0;

  return (
    <div className="relative">
      <DebugLabel label="UserMessageNavigation" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" disabled={!hasMessages}>
            <MessageSquare className="h-3 w-3" />
            <div className="flex items-center justify-center w-7 h-5 bg-card-hover text-muted-foreground rounded-full text-xs font-medium">
              {userMessages.length}
            </div>
          </Button>
        </DropdownMenuTrigger>
        {hasMessages && (
          <DropdownMenuContent
            align="start"
            className="w-100 max-h-96 overflow-y-auto backdrop-blur-sm"
          >
            {userMessages.map((userMsg) => (
              <DropdownMenuItem
                key={userMsg.index}
                onClick={() => handleNavigate(userMsg.index)}
                className="p-1 px-3 text-sm"
              >
                <div className="w-full truncate">{userMsg.content}</div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
};
