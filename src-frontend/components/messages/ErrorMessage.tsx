import React from 'react';
import { AlertCircle } from 'lucide-react';
import { DebugLabel } from '@/components/ui/atoms';
import { MessageTemplate } from './MessageTemplate';
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
    <MessageTemplate.Container message={message}>
      <DebugLabel label="ErrorMessage" />
      <MessageTemplate.Header
        IconComponent={AlertCircle}
        iconClassName="bg-destructive"
        title="Error rendering message"
        titleClassName="text-sm font-medium"
      >
        <MessageTemplate.Content>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </MessageTemplate.Content>
      </MessageTemplate.Header>
    </MessageTemplate.Container>
  );
};