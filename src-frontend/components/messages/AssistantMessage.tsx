import React from "react";
import { Bot } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MessageTemplate } from "./MessageTemplate";
import { useMessageContent } from "@/hooks/useMessageContent";
import type { ClaudeStreamMessage } from "@/lib/outputCache";

interface AssistantMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering assistant messages (main Claude agent)
 * Handles its own content processing with simple, clean styling
 */
export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
}) => {
  const contentItems = useMessageContent(message);

  return (
    <MessageTemplate.Container message={message} contentClassName="pb-2">
      <DebugLabel label="AssistantMessage" />
      <MessageTemplate.Header
        IconComponent={Bot}
        iconClassName="bg-background"
        title="Assistant"
      >
        <MessageTemplate.Content>{contentItems}</MessageTemplate.Content>
      </MessageTemplate.Header>
      <MessageTemplate.Footer message={message} />
    </MessageTemplate.Container>
  );
};
