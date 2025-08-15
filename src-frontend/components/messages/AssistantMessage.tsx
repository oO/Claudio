import React from "react";
import { cn } from "@/lib/utils";
import { MessageRoleIcon, DebugLabel } from "@/components/ui/atoms";
import { Message } from "./Message";
import { useMessageContent } from "@/hooks/useMessageContent";
import { useAgentStyling } from "@/hooks/useAgentStyling";
import type { ClaudeStreamMessage } from "@/components/agents";

interface AssistantMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering assistant messages (main Claude agent)
 * Handles its own content processing and agent styling
 */
export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
}) => {
  const contentItems = useMessageContent(message);
  const { agentName, agentBackgroundClass } = useAgentStyling(message);

  return (
    <Message.Container message={message} contentClassName="pb-2">
      <DebugLabel label="AssistantMessage" />
      <Message.Header
        icon={<MessageRoleIcon role="assistant" />}
        title={agentName}
        titleClassName={cn(
          "text-base font-semibold px-2 py-1 rounded",
          agentBackgroundClass,
        )}
      >
        <Message.Content>{contentItems}</Message.Content>
      </Message.Header>
      <Message.Footer message={message} />
    </Message.Container>
  );
};
