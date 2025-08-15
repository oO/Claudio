import React from 'react';
import { MessageRoleIcon, DebugLabel } from '@/components/ui/atoms';
import { Message } from './Message';
import { useMessageContent } from '@/hooks/useMessageContent';
import type { ClaudeStreamMessage } from '@/components/agents';

interface UserMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering user messages
 * Handles its own content processing and styling
 */
export const UserMessage: React.FC<UserMessageProps> = ({
  message,
}) => {
  const contentItems = useMessageContent(message);

  return (
    <Message.Container message={message}>
      <DebugLabel label="UserMessage" />
      <Message.Header
        icon={<MessageRoleIcon role="user" />}
        title="User"
        titleClassName="text-base font-semibold"
      >
        <Message.Content>{contentItems}</Message.Content>
      </Message.Header>
      <Message.Footer message={message} />
    </Message.Container>
  );
};