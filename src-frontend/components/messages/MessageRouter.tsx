import React from "react";
import type { ClaudeStreamMessage } from "@/components/agents";
import { SummaryWidget, SystemInitializedWidget } from "../tools/ToolWidgets";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SubAgentMessage } from "./SubAgentMessage";
import { ResultMessage } from "./ResultMessage";
import { ErrorMessage } from "./ErrorMessage";

interface MessageRouterProps {
  message: ClaudeStreamMessage;
  streamMessages: ClaudeStreamMessage[];
  sessionFilePath?: string;
  projectId?: string;
  sessionId?: string;
}

/**
 * Clean message router that delegates to specialized message components
 * Each message type component is self-contained and handles its own concerns
 */
const MessageRouterComponent: React.FC<MessageRouterProps> = ({
  message,
  streamMessages,
  sessionFilePath,
  projectId,
  sessionId,
}) => {
  try {
    // Skip rendering for meta messages that don't have meaningful content
    if (message.isMeta && !message.leafUuid && !message.summary) {
      return null;
    }

    // Handle summary messages - delegate to SummaryWidget
    if (
      message.leafUuid &&
      message.summary &&
      (message as any).type === "summary"
    ) {
      return (
        <SummaryWidget
          summary={message.summary}
          leafUuid={message.leafUuid}
          messageNumber={message.messageNumber}
        />
      );
    }

    // System initialization message - delegate to SystemInitializedWidget
    if (message.type === "system" && message.subtype === "init") {
      return (
        <SystemInitializedWidget
          sessionId={message.session_id}
          model={message.model}
          cwd={message.cwd}
          tools={message.tools}
        />
      );
    }

    // Handle compact summaries with SummaryWidget (user message context)
    if (message.type === "user" && (message as any).isCompactSummary) {
      const msg = message.message || message;
      const content = typeof msg.content === 'string' ? msg.content : 
        Array.isArray(msg.content) ? msg.content.map(c => c.text || c).join('') :
        JSON.stringify(msg.content);
      
      return (
        <SummaryWidget 
          summary={content}
          leafUuid={message.uuid}
          messageNumber={message.messageNumber}
          sessionFilePath={sessionFilePath}
          projectId={projectId}
          sessionId={sessionId}
          contributingMessageUuids={message._contributingMessageUuids}
        />
      );
    }

    // Route to specialized message components based on type
    switch (message.type) {
      case "assistant":
        // Check if this is a subagent or main assistant
        return message.agentType === "subagent" ? (
          <SubAgentMessage message={message} />
        ) : (
          <AssistantMessage message={message} />
        );

      case "user":
        // Don't render meta messages
        if (message.isMeta) return null;
        return <UserMessage message={message} />;

      case "result":
        return <ResultMessage message={message} />;

      default:
        // Skip rendering if no meaningful content
        return null;
    }
  } catch (error) {
    // If any error occurs during rendering, show error message
    console.error("Error rendering stream message:", error, message);
    return <ErrorMessage message={message} error={error} />;
  }
};

export const MessageRouter = React.memo(MessageRouterComponent);