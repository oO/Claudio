import React from "react";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { SystemInitializedWidget } from "../tools/ToolWidgets";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SubAgentMessage } from "./SubAgentMessage";
import { ResultMessage } from "./ResultMessage";
import { ErrorMessage } from "./ErrorMessage";
import { SummaryMessage } from "./SummaryMessage";
import { SystemMessage } from "./SystemMessage";
import { ThinkingMessage } from "./ThinkingMessage";
import { logger } from '@/lib/logger';

interface MessageRouterProps {
  message: ClaudeStreamMessage;
  streamMessages: ClaudeStreamMessage[];
  messageIndex?: number;
}


/**
 * Clean message router that delegates to specialized message components
 * Each message type component is self-contained and handles its own concerns
 */
const MessageRouterComponent: React.FC<MessageRouterProps> = ({
  message,
  streamMessages,
  messageIndex = 0,
}) => {
  try {
    // Skip rendering for meta messages that don't have meaningful content
    if (message.isMeta && !message.leafUuid && !message.summary) {
      return null;
    }

    // Handle summary messages (bundling already done in useMessageProcessing)
    if (
      message.leafUuid &&
      message.summary &&
      (message as any).type === "summary"
    ) {
      return <SummaryMessage message={message} />;
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

    // Handle compact summaries with SummaryMessage (preserves multi-message functionality)
    if (message.type === "user" && (message as any).isCompactSummary) {
      const msg = message.message || message;
      const content = typeof msg.content === 'string' ? msg.content : 
        Array.isArray(msg.content) ? msg.content.map(c => c.text || c).join('') :
        JSON.stringify(msg.content);
      
      // Create a summary message structure for compact summaries
      const compactSummaryMessage = {
        ...message,
        summary: content,
        _contributingMessageUuids: message._contributingMessageUuids,
        _isCompactSummary: true
      };
      
      return <SummaryMessage message={compactSummaryMessage} />;
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
        
        // Filter out fake user tool result messages (should be bundled by messageProcessor)
        const content = message.message?.content;
        if (Array.isArray(content) && content.length === 1 && content[0]?.type === "tool_result") {
          return null;
        }
        
        // Filter out interruption messages - they're just noise
        if (Array.isArray(content) && content.length === 1 && 
            typeof content[0]?.text === 'string' && 
            content[0].text.startsWith('[Request interrupted by')) {
          return null;
        }
        
        return <UserMessage message={message} />;

      case "result":
        return <ResultMessage message={message} />;

      case "status":
        return <ThinkingMessage message={message} />;

      case "system":
        // Handle general system messages (non-init)
        if (message.subtype !== "init") {
          return <SystemMessage message={message} />;
        }
        // Skip init messages as they're handled above
        return null;

      default:
        // Skip rendering if no meaningful content
        return null;
    }
  } catch (error) {
    // If any error occurs during rendering, show error message
    logger.error("Error rendering stream message:", error, message);
    return <ErrorMessage message={message} error={error} />;
  }
};

export const MessageRouter = React.memo(MessageRouterComponent);