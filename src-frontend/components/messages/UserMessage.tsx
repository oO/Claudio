import React from "react";
import { CircleUser } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MessageTemplate } from "./MessageTemplate";
import { useMessageContent } from "@/hooks/useMessageContent";
import type { ClaudeStreamMessage } from "@/components/agents";

interface UserMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering user messages
 * Handles its own content processing and styling
 */
export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  const contentItems = useMessageContent(message);

  return (
    <MessageTemplate.Container message={message}>
      <DebugLabel label="UserMessage" />
      <MessageTemplate.Header
        IconComponent={CircleUser}
        iconClassName="bg-accent"
        title="User"
        titleClassName="text-accent"
      >
        <MessageTemplate.Content>{contentItems}</MessageTemplate.Content>
      </MessageTemplate.Header>
      <MessageTemplate.Footer message={message} />
    </MessageTemplate.Container>
  );
};
