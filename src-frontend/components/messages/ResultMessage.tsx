import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui';
import { DebugLabel } from '@/components/ui/atoms';
import { Message } from './Message';
import type { ClaudeStreamMessage } from '@/components/agents';

interface ResultMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Self-contained component for rendering execution result messages with success/error styling
 */
export const ResultMessage: React.FC<ResultMessageProps> = ({
  message,
}) => {
  const isError = message.is_error || message.subtype?.includes("error");
  
  const resultContent = (
    <>
      {message.result && (
        <MarkdownRenderer content={message.result} compact />
      )}
      {message.error && (
        <div className="text-sm text-destructive">
          {message.error}
        </div>
      )}
    </>
  );

  return (
    <Message.Container message={message}>
      <DebugLabel label="ResultMessage" />
      <Message.Header
        icon={
          isError ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          )
        }
        title={isError ? "Execution Failed" : "Execution Complete"}
        titleClassName="text-base font-semibold"
      >
        <Message.Content>{resultContent}</Message.Content>
      </Message.Header>
      <Message.Footer message={message} />
    </Message.Container>
  );
};