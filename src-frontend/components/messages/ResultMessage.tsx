import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui';
import { DebugLabel } from '@/components/ui/atoms';
import { MessageTemplate } from './MessageTemplate';
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { MessageEnhancementProvider } from "@/contexts/MessageEnhancementContext";

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
    <MessageEnhancementProvider message={message}>
      <MessageTemplate.Container message={message}>
        <DebugLabel label="ResultMessage" />
        <MessageTemplate.Header
          IconComponent={isError ? AlertCircle : CheckCircle2}
          iconClassName={isError ? "bg-destructive" : "bg-green-600"}
          title={isError ? "Execution Failed" : "Execution Complete"}
        >
          <MessageTemplate.Content>{resultContent}</MessageTemplate.Content>
        </MessageTemplate.Header>
        <MessageTemplate.Footer message={message} />
      </MessageTemplate.Container>
    </MessageEnhancementProvider>
  );
};