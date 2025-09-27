import React, { createContext, useContext, useMemo } from 'react';
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { useStreamData } from './StreamDataContext';

export type ToolStatus = 'pending' | 'approved' | 'rejected' | 'error';

interface ToolStatusInfo {
  status: ToolStatus | null;
  toolCallId?: string;
  toolName?: string;
  errorMessage?: string;
}

interface MessageEnhancementContextValue {
  /** Original message */
  originalMessage: ClaudeStreamMessage;
  /** Enhanced message with combined UUIDs for clipboard functionality */
  enhancedMessage: ClaudeStreamMessage;
  /** Combined UUIDs from both tool calls and their results */
  contributingUuids: string[];
  /** Tool status information for tool calls in this message */
  toolStatuses: Map<string, ToolStatusInfo>;
  /** Primary tool status (for messages with single tool calls) */
  primaryToolStatus: ToolStatusInfo | null;
}

interface MessageEnhancementProviderProps {
  children: React.ReactNode;
  message: ClaudeStreamMessage;
}

const MessageEnhancementContext = createContext<MessageEnhancementContextValue | null>(null);

/**
 * Determines the tool status based on tool result
 */
function determineToolStatus(toolResult: any): ToolStatus | null {
  if (!toolResult) {
    return 'pending';
  }

  const isError = toolResult.is_error === true;
  const content = toolResult.content;

  // Check for user rejection patterns
  if (isError && typeof content === 'string') {
    const rejectionPatterns = [
      'rejected',
      'The user doesn\'t want to proceed',
      'tool use was rejected',
      'user rejected',
      'declined',
      'cancelled'
    ];
    
    if (rejectionPatterns.some(pattern => content.toLowerCase().includes(pattern.toLowerCase()))) {
      return 'rejected';
    }
  }

  // If it's an error but not a rejection, it's a system error
  if (isError) {
    return 'error';
  }

  // If no error, the tool was approved/succeeded
  return 'approved';
}

/**
 * Determines if a new tool status should override the primary status
 * Priority: rejected > error > pending > approved
 */
function shouldOverridePrimaryStatus(current: ToolStatusInfo, candidate: ToolStatusInfo): boolean {
  if (!current.status) return true;
  if (!candidate.status) return false;

  const priorityOrder: Record<ToolStatus, number> = {
    'rejected': 4,
    'error': 3,
    'pending': 2,
    'approved': 1
  };

  return priorityOrder[candidate.status] > priorityOrder[current.status];
}

/**
 * Provider for message enhancement data that combines tool call and tool result UUIDs
 * for proper clipboard functionality across all message types
 */
export const MessageEnhancementProvider: React.FC<MessageEnhancementProviderProps> = ({
  children,
  message,
}) => {
  const { getToolResult } = useStreamData();

  const enhancementData = useMemo(() => {
    // Start with original message UUIDs
    const contributingUuids: string[] = [
      ...(message._contributingMessageUuids || []),
      ...(message.uuid ? [message.uuid] : [])
    ];

    // Tool status tracking
    const toolStatuses = new Map<string, ToolStatusInfo>();
    let primaryToolStatus: ToolStatusInfo | null = null;

    // For assistant messages with tool calls, collect tool result UUIDs and status
    if (message.type === 'assistant' && message.message?.content && Array.isArray(message.message.content)) {
      message.message.content.forEach((content: any) => {
        if (content.type === "tool_use" && content.id) {
          const toolResult = getToolResult(content.id);
          
          // Collect UUID
          if (toolResult?._sourceMessageUuid) {
            contributingUuids.push(toolResult._sourceMessageUuid);
          }

          // Determine tool status
          const toolStatusInfo: ToolStatusInfo = {
            status: determineToolStatus(toolResult),
            toolCallId: content.id,
            toolName: content.name,
            errorMessage: toolResult?.is_error ? toolResult.content : undefined
          };

          toolStatuses.set(content.id, toolStatusInfo);

          // Set primary status (first tool or most significant status)
          if (!primaryToolStatus || shouldOverridePrimaryStatus(primaryToolStatus, toolStatusInfo)) {
            primaryToolStatus = toolStatusInfo;
          }
        }
      });
    }

    // Remove duplicates and filter out empty values
    const uniqueUuids = contributingUuids.filter((uuid, index, array) => 
      uuid && array.indexOf(uuid) === index
    );

    // Create enhanced message with combined UUIDs
    const enhancedMessage: ClaudeStreamMessage = {
      ...message,
      _contributingMessageUuids: uniqueUuids
    };

    return {
      originalMessage: message,
      enhancedMessage,
      contributingUuids: uniqueUuids,
      toolStatuses,
      primaryToolStatus
    };
  }, [message, getToolResult]);

  return (
    <MessageEnhancementContext.Provider value={enhancementData}>
      {children}
    </MessageEnhancementContext.Provider>
  );
};

/**
 * Hook to access message enhancement context
 * Used by components that need enhanced message data with combined UUIDs
 */
export const useMessageEnhancement = (): MessageEnhancementContextValue => {
  const context = useContext(MessageEnhancementContext);
  if (context === null) {
    throw new Error('useMessageEnhancement must be used within a MessageEnhancementProvider');
  }
  return context;
};

/**
 * Hook to get tool status information for the current message
 * Provides convenient access to tool approval/rejection/error status
 */
export const useToolStatus = (toolCallId?: string) => {
  const { toolStatuses, primaryToolStatus } = useMessageEnhancement();
  
  if (toolCallId) {
    return toolStatuses.get(toolCallId) || null;
  }
  
  return primaryToolStatus;
};