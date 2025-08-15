import React from 'react';
import { AlertCircle } from 'lucide-react';
import { DebugLabel } from '@/components/ui/atoms';
import { Message } from './Message';
import type { ClaudeStreamMessage } from '@/components/agents';

interface ErrorMessageProps {
  message: ClaudeStreamMessage;
  error: Error | unknown;
}

/**
 * Self-contained component for rendering error messages when message rendering fails
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  error,
}) => {
  return (
    <Message.Container message={message}>
      <DebugLabel label="ErrorMessage" />
      <Message.Header
        icon={<AlertCircle className="h-5 w-5 text-destructive" />}
        title="Error rendering message"
        titleClassName="text-sm font-medium"
      >
        <Message.Content>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </Message.Content>
      </Message.Header>
    </Message.Container>
  );
};