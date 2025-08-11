import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  MessageHeader, 
  MessageContent, 
  ToolCallRenderer, 
  ToolResultRenderer,
  MarkdownRenderer,
  MessageUsageStats,
  type MessageRole 
} from "@/components/ui";
import { DebugLabel } from "@/components/ui/atoms";
import type { ClaudeStreamMessage } from "@/components/agents";
import { SummaryWidget, SystemInitializedWidget } from "../tools/ToolWidgets";

interface StreamMessageProps {
  message: ClaudeStreamMessage;
  className?: string;
  streamMessages: ClaudeStreamMessage[];
  onLinkDetected?: (url: string) => void;
}

/**
 * Component to render a single Claude Code stream message using Atomic Design principles
 */
const StreamMessageComponent: React.FC<StreamMessageProps> = ({ message, className, streamMessages, onLinkDetected }) => {
  // State to track tool results mapped by tool call ID
  const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());
  
  // Extract all tool results from stream messages
  useEffect(() => {
    const results = new Map<string, any>();
    
    // Iterate through all messages to find tool results
    streamMessages.forEach(msg => {
      if (msg.type === "user" && msg.message?.content && Array.isArray(msg.message.content)) {
        msg.message.content.forEach((content: any) => {
          if (content.type === "tool_result" && content.tool_use_id) {
            results.set(content.tool_use_id, content);
          }
        });
      }
    });
    
    setToolResults(results);
  }, [streamMessages]);
  
  // Helper to get tool result for a specific tool call ID
  const getToolResult = (toolId: string | undefined): any => {
    if (!toolId) return null;
    return toolResults.get(toolId) || null;
  };
  
  try {
    // Skip rendering for meta messages that don't have meaningful content
    if (message.isMeta && !message.leafUuid && !message.summary) {
      return null;
    }

    // Handle summary messages
    if (message.leafUuid && message.summary && (message as any).type === "summary") {
      return <SummaryWidget summary={message.summary} leafUuid={message.leafUuid} />;
    }

    // System initialization message
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

    // Assistant message
    if (message.type === "assistant" && message.message) {
      const msg = message.message;
      
      let renderedSomething = false;
      const contentItems: React.ReactNode[] = [];
      
      // Process message content
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((content: any, idx: number) => {
          // Text content
          if (content.type === "text") {
            renderedSomething = true;
            contentItems.push(
              <MessageContent 
                key={`text-${idx}`} 
                content={content} 
                onLinkDetected={onLinkDetected} 
              />
            );
          }
          
          // Thinking content and tool use
          if (content.type === "thinking" || content.type === "tool_use") {
            renderedSomething = true;
            const toolResult = getToolResult(content.id);
            contentItems.push(
              <ToolCallRenderer
                key={`tool-${idx}`}
                toolCall={content}
                toolResult={toolResult}
              />
            );
          }
        });
      }
      
      if (!renderedSomething) return null;
      
      return (
        <Card className={cn("relative border-primary/20", className)}>
          <DebugLabel label="AssistantMessage" />
          <CardContent className="p-4">
            <MessageHeader
              role="assistant"
              usage={msg.usage}
            />
            <div className="flex-1 space-y-2 min-w-0 mt-2">
              {contentItems}
            </div>
          </CardContent>
        </Card>
      );
    }

    // User message - handle both nested and direct content structures
    if (message.type === "user") {
      // Don't render meta messages, which are for system use
      if (message.isMeta) return null;

      // Handle different message structures
      const msg = message.message || message;
      
      let renderedSomething = false;
      const contentItems: React.ReactNode[] = [];
      
      // Handle string content
      if (typeof msg.content === 'string' || (msg.content && !Array.isArray(msg.content))) {
        const contentStr = typeof msg.content === 'string' ? msg.content : String(msg.content);
        if (contentStr.trim()) {
          renderedSomething = true;
          
          // Check for command patterns
          const commandMatch = contentStr.match(/<command-name>(.+?)<\/command-name>[\s\S]*?<command-message>(.+?)<\/command-message>[\s\S]*?<command-args>(.*?)<\/command-args>/);
          if (commandMatch) {
            const [, commandName, commandMessage, commandArgs] = commandMatch;
            contentItems.push(
              <ToolCallRenderer
                key="command"
                toolCall={{ type: "command" }}
                commandContent={{
                  commandName: commandName.trim(),
                  commandMessage: commandMessage.trim(),
                  commandArgs: commandArgs?.trim()
                }}
              />
            );
          } else {
            contentItems.push(
              <MessageContent key="content" content={contentStr} onLinkDetected={onLinkDetected} />
            );
          }
        }
      }
      
      // Handle array content
      if (Array.isArray(msg.content)) {
        msg.content.forEach((content: any, idx: number) => {
          if (content.type === "tool_result") {
            // Check if we should skip duplicate tool results
            let hasCorrespondingWidget = false;
            if (content.tool_use_id && streamMessages) {
              for (let i = streamMessages.length - 1; i >= 0; i--) {
                const prevMsg = streamMessages[i];
                if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                  const toolUse = prevMsg.message.content.find((c: any) => c.type === 'tool_use' && c.id === content.tool_use_id);
                  if (toolUse) {
                    const toolName = toolUse.name?.toLowerCase();
                    const toolsWithWidgets = ['task','edit','multiedit','todowrite','todoread','ls','read','glob','bash','write','grep','websearch','webfetch'];
                    if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                      hasCorrespondingWidget = true;
                    }
                    break;
                  }
                }
              }
            }
            
            if (!hasCorrespondingWidget) {
              renderedSomething = true;
              contentItems.push(
                <ToolResultRenderer
                  key={`result-${idx}`}
                  content={content}
                  toolUseId={content.tool_use_id}
                  isError={content.is_error}
                  streamMessages={streamMessages}
                  onLinkDetected={onLinkDetected}
                />
              );
            }
          } else if (content.type === "text") {
            renderedSomething = true;
            contentItems.push(
              <MessageContent key={`text-${idx}`} content={content} onLinkDetected={onLinkDetected} />
            );
          }
        });
      }
      
      if (!renderedSomething) return null;
      
      return (
        <Card className={cn("relative border-muted-foreground/20", className)}>
          <DebugLabel label="UserMessage" />
          <CardContent className="p-4">
            <MessageHeader role="user" />
            <div className="flex-1 space-y-2 min-w-0 mt-2">
              {contentItems}
            </div>
          </CardContent>
        </Card>
      );
    }


    // Result message - render with atomic components
    if (message.type === "result") {
      const isError = message.is_error || message.subtype?.includes("error");
      
      return (
        <Card className={cn(
          "relative",
          isError ? "border-destructive/20 bg-destructive/5" : "border-green-600/20 bg-green-600/5 dark:border-green-400/20 dark:bg-green-400/5",
          className
        )}>
          <DebugLabel label="ResultMessage" />
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {isError ? (
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold text-sm">
                  {isError ? "Execution Failed" : "Execution Complete"}
                </h4>
                
                {message.result && (
                  <MarkdownRenderer content={message.result} compact />
                )}
                
                {message.error && (
                  <div className="text-sm text-destructive">{message.error}</div>
                )}
                
                <MessageUsageStats
                  usage={message.usage}
                  costUsd={message.cost_usd || message.total_cost_usd}
                  durationMs={message.duration_ms}
                  numTurns={message.num_turns}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Skip rendering if no meaningful content
    return null;
  } catch (error) {
    // If any error occurs during rendering, show a safe error message
    console.error("Error rendering stream message:", error, message);
    return (
      <Card className={cn("border-destructive/20 bg-destructive/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Error rendering message</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
};

export const StreamMessage = React.memo(StreamMessageComponent);
