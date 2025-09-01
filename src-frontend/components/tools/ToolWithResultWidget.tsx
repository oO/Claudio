import React from 'react';
import { Wrench, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ToolWidgetTemplate } from './ToolWidgetTemplate';
import type { ClaudeStreamMessage } from '@/lib/outputCache';

interface ToolWithResultWidgetProps {
  /** The assistant message containing the tool call */
  message: ClaudeStreamMessage;
  /** Optional tool result message */
  toolResult?: ClaudeStreamMessage;
}

interface GenericToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

/**
 * Generic widget for displaying tool calls with their results
 * Used as a fallback for tools that don't have custom widgets
 */
export const ToolWithResultWidget: React.FC<ToolWithResultWidgetProps> = ({
  message,
  toolResult,
}) => {
  // Find the tool call in the message content
  const toolCall = React.useMemo(() => {
    if (!message.message?.content || !Array.isArray(message.message.content)) {
      return null;
    }

    return message.message.content.find(
      (content): content is GenericToolCall =>
        content.type === 'tool_use'
    );
  }, [message.message?.content]);

  // Extract tool result details
  const resultInfo = React.useMemo(() => {
    if (!toolResult?.message?.content || !Array.isArray(toolResult.message.content)) {
      return null;
    }

    const toolResultContent = toolResult.message.content.find(
      (content: any) => content.type === 'tool_result' && content.tool_use_id === toolCall?.id
    );

    if (!toolResultContent) return null;

    const isError = toolResultContent.is_error === true;
    const content = toolResultContent.content;

    return {
      isError,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      hasResult: content !== undefined && content !== null
    };
  }, [toolResult?.message?.content, toolCall?.id]);

  if (!toolCall) {
    return null;
  }

  const toolName = toolCall.name;
  const toolInput = toolCall.input;
  const inputString = JSON.stringify(toolInput, null, 2);
  const inputLineCount = inputString.split('\n').length;
  const resultLineCount = resultInfo?.content ? resultInfo.content.split('\n').length : 0;

  const getStatusIcon = () => {
    if (!resultInfo) return <AlertCircle className="h-3 w-3 text-yellow-600" />;
    return resultInfo.isError 
      ? <XCircle className="h-3 w-3 text-red-600" />
      : <CheckCircle className="h-3 w-3 text-green-600" />;
  };

  const getStatusText = () => {
    if (!resultInfo) return 'Pending';
    return resultInfo.isError ? 'Error' : 'Success';
  };

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="ToolWithResultWidget" />
      
      <ToolWidgetTemplate.Header
        icon={Wrench}
        title={
          <div className="flex items-center gap-2">
            <span>{toolName}</span>
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {getStatusText()}
            </span>
          </div>
        }
      />

      {/* Tool Input */}
      {Object.keys(toolInput).length > 0 && (
        <ToolWidgetTemplate.ExpandableResult
          rawContent={inputString}
          initiallyExpanded={inputLineCount <= 5}
          headerContent={
            <span className="text-xs font-medium text-muted-foreground">
              Input Parameters
            </span>
          }
        >
          {(excerptedContent, isShowingExcerpt) => (
            <ToolWidgetTemplate.CodeOutput>
              {isShowingExcerpt ? excerptedContent : inputString}
              {isShowingExcerpt && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  ... {inputLineCount - 5} more lines
                </div>
              )}
            </ToolWidgetTemplate.CodeOutput>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      )}

      {/* Tool Result */}
      {resultInfo?.hasResult && (
        <ToolWidgetTemplate.ExpandableResult
          rawContent={resultInfo.content}
          initiallyExpanded={resultLineCount <= 10}
          headerContent={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {resultInfo.isError ? 'Error Output' : 'Result'}
              </span>
              {getStatusIcon()}
            </div>
          }
          className={resultInfo.isError ? "border-red-200 bg-red-50/50" : ""}
        >
          {(excerptedContent, isShowingExcerpt) => (
            <ToolWidgetTemplate.CodeOutput
              className={resultInfo.isError ? "text-red-900 bg-red-50" : ""}
            >
              {isShowingExcerpt ? excerptedContent : resultInfo.content}
              {isShowingExcerpt && (
                <div className="mt-2 text-xs text-muted-foreground italic">
                  ... {resultLineCount - 10} more lines
                </div>
              )}
            </ToolWidgetTemplate.CodeOutput>
          )}
        </ToolWidgetTemplate.ExpandableResult>
      )}

      {resultInfo && (
        <ToolWidgetTemplate.Footer>
          <div className="flex items-center gap-2 text-xs">
            {getStatusIcon()}
            <span className={`${
              resultInfo.isError ? 'text-red-700' : 'text-green-700'
            }`}>
              Tool {resultInfo.isError ? 'failed' : 'completed successfully'}
            </span>
          </div>
        </ToolWidgetTemplate.Footer>
      )}
    </ToolWidgetTemplate>
  );
};