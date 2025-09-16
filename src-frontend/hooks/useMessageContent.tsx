import React from 'react';
import {
  MessageContent,
  ToolCallRenderer,
  ToolResultRenderer,
} from '@/components/ui';
import { ImageWidget } from '@/components/tools';
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { useStreamData } from '../contexts/StreamDataContext';
import { logger } from '@/lib/logger';

/**
 * Hook that processes message content into React nodes
 * Handles different content types and tool call/result relationships
 */
export const useMessageContent = (message: ClaudeStreamMessage): React.ReactNode[] => {
  const { getToolResult, streamMessages } = useStreamData();

  if (message.type === 'assistant' && message.message) {
    const msg = message.message;
    const contentItems: React.ReactNode[] = [];

    // Process message content
    if (msg.content && Array.isArray(msg.content)) {
      msg.content.forEach((content: any, idx: number) => {
        // Text content
        if (content.type === "text") {
          contentItems.push(
            <MessageContent
              key={`text-${idx}`}
              content={content}
            />,
          );
        }

        // Image content
        if (content.type === "image") {
          contentItems.push(
            <ImageWidget
              key={`image-${idx}`}
              content={content}
            />,
          );
        }

        // Thinking content and tool use
        if (content.type === "thinking" || content.type === "tool_use") {
          const toolResult = getToolResult(content.id);
          
          // Create enhanced message with combined UUIDs for clipboard functionality
          const enhancedMessage = {
            ...message,
            _contributingMessageUuids: [
              ...(message._contributingMessageUuids || []),
              ...(message.uuid ? [message.uuid] : []),
              // Add tool result UUID if available
              ...(toolResult?._sourceMessageUuid ? [toolResult._sourceMessageUuid] : [])
            ].filter((uuid, index, array) => uuid && array.indexOf(uuid) === index) // Remove duplicates
          };
          
          contentItems.push(
            <ToolCallRenderer
              key={`tool-${idx}`}
              toolCall={content}
              toolResult={toolResult}
              originalMessage={enhancedMessage}
            />,
          );
        }
      });
    }

    return contentItems;
  }

  if (message.type === 'user') {
    const msg = message.message || message;
    const contentItems: React.ReactNode[] = [];

    // Check for bundled command first, then handle regular content
    if (message._bundledCommand) {
      contentItems.push(
        <ToolCallRenderer
          key="bundled-command"
          toolCall={{ type: "command" }}
          commandContent={{
            commandName: message._bundledCommand.commandName,
            commandMessage: message._bundledCommand.commandMessage,
            commandArgs: message._bundledCommand.commandArgs,
            output: message._bundledCommand.output,
          }}
          originalMessage={message}
        />,
      );
    } else if (
      typeof msg.content === "string" ||
      (msg.content && !Array.isArray(msg.content))
    ) {
      const contentStr =
        typeof msg.content === "string" ? msg.content : String(msg.content);
      if (contentStr.trim()) {
        // Check for command patterns (fallback for non-bundled commands)
        const commandMatch = contentStr.match(
          /<command-name>(.+?)<\/command-name>[\s\S]*?<command-message>(.+?)<\/command-message>[\s\S]*?<command-args>(.*?)<\/command-args>/,
        );
        if (commandMatch) {
          const [, commandName, commandMessage, commandArgs] = commandMatch;
          contentItems.push(
            <ToolCallRenderer
              key="command"
              toolCall={{ type: "command" }}
              commandContent={{
                commandName: commandName.trim(),
                commandMessage: commandMessage.trim(),
                commandArgs: commandArgs?.trim(),
              }}
              originalMessage={message}
            />,
          );
        } else {
          contentItems.push(
            <MessageContent
              key="content"
              content={contentStr}
            />,
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
              if (
                prevMsg.type === "assistant" &&
                prevMsg.message?.content &&
                Array.isArray(prevMsg.message.content)
              ) {
                const toolUse = prevMsg.message.content.find(
                  (c: any) =>
                    c.type === "tool_use" && c.id === content.tool_use_id,
                );
                if (toolUse) {
                  const toolName = toolUse.name?.toLowerCase();
                  const toolsWithWidgets = [
                    "task",
                    "edit",
                    "multiedit",
                    "todowrite",
                    "ls",
                    "read",
                    "glob",
                    "bash",
                    "write",
                    "grep",
                    "websearch",
                    "webfetch",
                    "exitplanmode",
                  ];
                  if (
                    toolsWithWidgets.includes(toolName) ||
                    toolUse.name?.startsWith("mcp__")
                  ) {
                    hasCorrespondingWidget = true;
                  }
                  break;
                }
              }
            }
          }

          if (!hasCorrespondingWidget) {
            contentItems.push(
              <ToolResultRenderer
                key={`result-${idx}`}
                content={content}
                toolUseId={content.tool_use_id}
                isError={content.is_error}
                streamMessages={streamMessages}
              />,
            );
          }
        } else if (content.type === "text") {
          contentItems.push(
            <MessageContent
              key={`text-${idx}`}
              content={content}
            />,
          );
        } else if (content.type === "image") {
          contentItems.push(
            <ImageWidget
              key={`image-${idx}`}
              content={content}
            />,
          );
        }
      });
    }

    return contentItems;
  }

  return [];
};