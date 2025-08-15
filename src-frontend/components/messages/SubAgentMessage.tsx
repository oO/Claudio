import React from 'react';
import { cn } from '@/lib/utils';
import { MessageRoleIcon, DebugLabel } from '@/components/ui/atoms';
import { Message } from './Message';
import { useMessageContent } from '@/hooks/useMessageContent';
import { useAgentStyling } from '@/hooks/useAgentStyling';
import type { ClaudeStreamMessage } from '@/components/agents';

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
    <Message.Container message={message} contentClassName="pb-2">
      <DebugLabel label="SubAgentMessage" />
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