import React from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";
import { MessageTemplate } from "./MessageTemplate";
import { useMessageContent } from "@/hooks/useMessageContent";
import { useAgentStyling } from "@/hooks/useAgentStyling";
import type { ClaudeStreamMessage } from "@/lib/outputCache";

interface SubAgentMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering subagent messages with specialized styling
 * Handles its own content processing and agent metadata
 */
export const SubAgentMessage: React.FC<SubAgentMessageProps> = ({
  message,
}) => {
  const contentItems = useMessageContent(message);
  const { agentName, agentBackgroundClass } = useAgentStyling(message);

  return (
    <MessageTemplate.Container message={message} contentClassName="pb-2">
      <DebugLabel label="SubAgentMessage" />
      <MessageTemplate.Header
        IconComponent={Bot}
        iconClassName="bg-background"
        title={agentName}
        titleClassName={cn(
          "text-base font-semibold px-2 py-0.5 pb-1 rounded",
          agentBackgroundClass,
        )}
      >
        <MessageTemplate.Content>{contentItems}</MessageTemplate.Content>
      </MessageTemplate.Header>
      <MessageTemplate.Footer message={message} />
    </MessageTemplate.Container>
  );
};
