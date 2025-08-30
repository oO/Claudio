import React from "react";
import type { ClaudeStreamMessage } from "@/components/agents";
import { SummaryWidget, SystemInitializedWidget } from "../tools/ToolWidgets";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SubAgentMessage } from "./SubAgentMessage";
import { ResultMessage } from "./ResultMessage";
import { ErrorMessage } from "./ErrorMessage";
import { SummaryMessage } from "./SummaryMessage";
import { ThinkingMessage } from "./ThinkingMessage";
import { logger } from '@/lib/logger';

interface MessageRouterProps {
  message: ClaudeStreamMessage;
  streamMessages: ClaudeStreamMessage[];
  messageIndex?: number;
}

/**
 * Utility function to detect and bundle consecutive summary messages
 */
const shouldBundleSummaries = (
  messages: ClaudeStreamMessage[],
  startIndex: number
): { shouldBundle: boolean; bundleCount: number; summaries: string[] } => {
  let bundleCount = 0;
  const summaries: string[] = [];
  
  // Count consecutive summary messages starting from startIndex
  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.leafUuid && msg.summary && (msg as any).type === "summary") {
      bundleCount++;
      summaries.push(msg.summary);
    } else {
      break;
    }
  }
  
  // Only bundle if we have 2 or more consecutive summaries
  return {
    shouldBundle: bundleCount >= 2,
    bundleCount,
    summaries
  };
};

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

    // Summary bundling is now handled in SessionHandleView, not here

    // Handle summary messages - check if we should bundle consecutive ones
    if (
      message.leafUuid &&
      message.summary &&
      (message as any).type === "summary"
    ) {
      const bundleInfo = shouldBundleSummaries(streamMessages, messageIndex);
      
      if (bundleInfo.shouldBundle) {
        // Collect all contributing UUIDs
        const contributingUuids = streamMessages
          .slice(messageIndex, messageIndex + bundleInfo.bundleCount)
          .map(msg => msg.leafUuid)
          .filter(Boolean) as string[];
        
        // Create a bundled summary message object
        const bundledMessage = {
          ...message,
          summary: bundleInfo.summaries, // Pass array of summaries
          _contributingMessageUuids: contributingUuids,
          _bundleCount: bundleInfo.bundleCount,
          _isBundle: true
        };
        
        return <SummaryMessage message={bundledMessage} />;
      } else {
        return <SummaryMessage message={message} />;
      }
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

    // Handle compact summaries with SummaryWidget (preserves multi-message functionality)
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

      case "status":
        return <ThinkingMessage message={message} />;

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