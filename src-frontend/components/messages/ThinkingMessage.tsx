import React from "react";
import { Loader2 } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MessageTemplate } from "./MessageTemplate";
import type { ClaudeStreamMessage } from "@/components/agents";

interface ThinkingMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering thinking messages with fun action verbs and haikus
 * Shows Claude's current processing state with title and shimmering haiku message
 */
export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({ message }) => {
  const title = (message as any).title || "Claude is thinking...";
  const haiku =
    message.message?.content?.[0]?.text || "Processing your request";

  return (
    <MessageTemplate.Container
      message={message}
      className="bg-muted/30 border-dashed"
    >
      <DebugLabel label="ThinkingMessage" />
      <MessageTemplate.Header
        IconComponent={Loader2}
        iconClassName="bg-purple-500/20 text-purple-600 animate-spin"
        title={title}
        titleClassName="text-purple-600 font-medium"
      >
        <MessageTemplate.Content>
          <div className="text text-muted-foreground italic font-serif text-center">
            <span>{haiku}</span>
          </div>
        </MessageTemplate.Content>
      </MessageTemplate.Header>
      {/* No footer for thinking messages since they're temporary */}
    </MessageTemplate.Container>
  );
};
