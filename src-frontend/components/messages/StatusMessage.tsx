import React from "react";
import { Loader2 } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MessageTemplate } from "./MessageTemplate";
import type { ClaudeStreamMessage } from "@/components/agents";

interface StatusMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering status messages with fun action verbs and haikus
 * Shows Claude's current processing state with title and shimmering haiku message
 */
export const StatusMessage: React.FC<StatusMessageProps> = ({ message }) => {
  const title = (message as any).title || "Claude is thinking...";
  const haiku = message.message?.content?.[0]?.text || "Processing your request";

  return (
    <MessageTemplate.Container message={message} className="bg-muted/30 border-dashed">
      <DebugLabel label="StatusMessage" />
      <MessageTemplate.Header
        IconComponent={Loader2}
        iconClassName="bg-purple-500/20 text-purple-600 animate-spin"
        title={title}
        titleClassName="text-purple-600 font-medium"
      >
        <MessageTemplate.Content>
          <div className="text-sm text-muted-foreground italic font-serif text-center">
            <span>{haiku}</span>
          </div>
        </MessageTemplate.Content>
      </MessageTemplate.Header>
      {/* No footer for status messages since they're temporary */}
    </MessageTemplate.Container>
  );
};