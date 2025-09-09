import { useMemo, useState } from "react";
import { logger } from "@/lib/logger";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import type { UserMessageItem, ToolMessageItem, AssistantMessageItem } from "@/contexts/SessionContext";

/**
 * Hook for processing raw messages into displayable format
 * Handles filtering, bundling, and preparation for UI display
 */
export const useMessageProcessing = (messages: ClaudeStreamMessage[]) => {
  const [collapsedMessageUuids, setCollapsedMessageUuids] = useState<string[]>([]);


  // Helper function: Extract all message types using corrected turn logic
  const extractAllMessageTypes = (messages: ClaudeStreamMessage[]) => {
    const userMessages: UserMessageItem[] = [];
    const toolMessages: ToolMessageItem[] = [];
    const assistantMessages: AssistantMessageItem[] = [];
    let lastInTurnCount = 0;
    
    messages.forEach((message, index) => {
      // Extract user messages
      if (message.type === "user" && message.message) {
        const msg = message.message;
        if (msg.content) {
          // Extract user message content
          let content = "";
          const msgContent = msg.content;
          
          if (typeof msgContent === "string") {
            content = msgContent;
          } else if (Array.isArray(msgContent)) {
            const textContent = msgContent
              .filter((c: any) => c.type === "text" || typeof c === "string")
              .map((c: any) => (typeof c === "string" ? c : c.text || ""))
              .join(" ");
            content = textContent;
          }
          
          const truncatedContent = content.trim().substring(0, 100);
          if (truncatedContent.length > 0) {
            // Filter out system-generated user message artifacts
            const isSystemArtifact = 
              truncatedContent.includes("[Request interrupted by user") ||
              truncatedContent.includes("<command-name>/hooks") ||
              truncatedContent.includes("<command-message>hooks</command-message>") ||
              truncatedContent.startsWith("<command-");
            
            if (!isSystemArtifact) {
              userMessages.push({
                index,
                content: truncatedContent,
                messageNumber: (message as any).messageNumber || index + 1,
              });
            }
          }
        }
      }
      
      // Extract assistant messages
      else if (message.type === "assistant" && message.message?.content) {
        const isSubAgentTask = Boolean(message.isSidechain === true || 
                             (message.message?.content && Array.isArray(message.message.content) &&
                              message.message.content.some((c: any) => 
                                c.type === "tool_use" && c.name === "Task"
                              )));
        
        const isSubAgentResponse = Boolean(message.isSidechain === true && !isSubAgentTask);
        
        assistantMessages.push({
          index,
          messageId: (message.message as any)?.id || message.uuid || `assistant-${index}`,
          messageNumber: (message as any).messageNumber || index + 1,
          isLastInTurn: false, // Will be calculated in second pass
          isSubAgentTask,
          isSubAgentResponse,
        });
        
        // Extract tool usage
        if (message.message?.content && Array.isArray(message.message.content)) {
          let toolNames: string[] = [];
          message.message.content.forEach((contentItem: any) => {
            if (contentItem.type === "tool_use" && contentItem.name) {
              toolNames.push(contentItem.name);
            }
          });
          
          if (toolNames.length > 0) {
            toolMessages.push({
              index,
              toolName: toolNames.join(', '),
              messageNumber: (message as any).messageNumber || index + 1,
            });
          }
        }
      }
      
      // Handle bundled tool results
      else if ((message as any).bundledToolResults && Array.isArray((message as any).bundledToolResults)) {
        const bundledResults = (message as any).bundledToolResults;
        const toolNames = bundledResults
          .map((result: any) => result.toolName)
          .filter(Boolean);
        
        if (toolNames.length > 0) {
          toolMessages.push({
            index,
            toolName: toolNames.join(', ') || 'tool',
            messageNumber: (message as any).messageNumber || index + 1,
          });
        }
      }
    });
    
    return { userMessages, toolMessages, assistantMessages };
  };

  // Helper function: Filter unwanted messages
  const filterMessages = (rawMessages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    logger.info(`🔧 filterMessages starting with ${rawMessages.length} raw messages`);
    const filteredUuids: string[] = [];

    const filtered = rawMessages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        if (message.uuid) filteredUuids.push(message.uuid);
        return false;
      }

      // Skip artificial user messages created by sub-agent system
      // These are internal system artifacts that just repeat task prompts
      if (message.isSidechain && message.type === "user") {
        if (message.uuid) filteredUuids.push(message.uuid);
        return false;
      }

      // Handle user messages
      if (message.type === "user" && message.message) {
        // Skip user meta messages
        if (message.isMeta) {
          if (message.uuid) filteredUuids.push(message.uuid);
          return false;
        }

        const msg = message.message;
        if (
          !msg.content ||
          (Array.isArray(msg.content) && msg.content.length === 0)
        ) {
          if (message.uuid) filteredUuids.push(message.uuid);
          return false;
        }

        // Handle regular user messages with tool results filtering
        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") {
              hasVisibleContent = true;
              break;
            }
            if (content.type === "tool_result") {
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Look for the matching tool_use in previous assistant messages
                const matchingToolUse = rawMessages.find(
                  (prevMsg) =>
                    prevMsg.type === "assistant" &&
                    prevMsg.message?.content &&
                    Array.isArray(prevMsg.message.content) &&
                    prevMsg.message.content.some(
                      (c: any) =>
                        c.type === "tool_use" && c.id === content.tool_use_id,
                    ),
                );
                if (matchingToolUse) {
                  const toolUse = (matchingToolUse.message!.content as any[]).find(
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
                      "exitplanmode",
                    ];
                    if (
                      toolsWithWidgets.includes(toolName) ||
                      toolUse.name?.startsWith("mcp__")
                    ) {
                      willBeSkipped = true;
                    }
                  }
                }
              }
              if (!willBeSkipped) {
                hasVisibleContent = true;
                break;
              }
            }
          }
          if (!hasVisibleContent) {
            if (message.uuid) filteredUuids.push(message.uuid);
            return false;
          }
        }
      }

      // Filter out system messages that MessageRouter won't handle
      if (message.type === "system" && !(message as any).subtype) {
        if (message.uuid) filteredUuids.push(message.uuid);
        return false;
      }

      return true; // Keep message
    });

    // Store filtered UUIDs for debugging purposes
    setCollapsedMessageUuids(filteredUuids);

    return filtered;
  };

  // Helper function: Bundle consecutive summary messages
  const bundleSummaries = (messages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    const result: ClaudeStreamMessage[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < messages.length; i++) {
      if (processed.has(i)) continue;

      const message = messages[i];

      if (
        message.leafUuid &&
        message.summary &&
        (message as any).type === "summary"
      ) {
        const summaries = [message.summary];
        const leafUuids = [message.leafUuid];

        // Look for consecutive summary messages
        let j = i + 1;
        while (j < messages.length) {
          const next = messages[j];
          if (
            next.leafUuid &&
            next.summary &&
            (next as any).type === "summary"
          ) {
            summaries.push(next.summary);
            leafUuids.push(next.leafUuid);
            processed.add(j);
            j++;
          } else {
            break;
          }
        }

        // For summary messages, use the leafUuids as contributing message identifiers
        // but also preserve the original message UUIDs if they exist
        const contributingUuids = leafUuids; // Use leafUuids for summary correlation

        result.push({
          ...message,
          summary: summaries,
          _contributingMessageUuids: contributingUuids,
          _isBundle: summaries.length > 1,
        });
      } else {
        result.push(message);
      }
    }

    return result;
  };

  // Helper function: Bundle command messages with their stdout
  const bundleCommands = (filteredMessages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    const bundledMessages: ClaudeStreamMessage[] = [];
    const processedIndices = new Set<number>();

    for (let i = 0; i < filteredMessages.length; i++) {
      if (processedIndices.has(i)) {
        continue;
      }

      const message = filteredMessages[i];

      // Check if this is a command message
      if (
        message.type === "user" &&
        message.message &&
        typeof message.message.content === "string"
      ) {
        const contentStr = message.message.content as string;
        const commandMatch = contentStr.match(
          /<command-name>(.+?)<\/command-name>[\s\S]*?<command-message>(.+?)<\/command-message>[\s\S]*?<command-args>(.*?)<\/command-args>/,
        );

        if (commandMatch) {
          const [, commandName, commandMessage, commandArgs] = commandMatch;

          // Look for the stdout message by parentUuid (not just next message)
          let stdout = "";
          let contributingUuids = [message.uuid].filter(Boolean);

          // Find the stdout message that has this command as parent
          for (let j = i + 1; j < filteredMessages.length; j++) {
            const candidateMessage = filteredMessages[j];
            if (
              candidateMessage.parentUuid === message.uuid &&
              candidateMessage.type === "user" &&
              typeof candidateMessage.message?.content === "string"
            ) {
              const candidateContentStr = candidateMessage.message.content as string;
              const stdoutMatch = candidateContentStr.match(
                /<local-command-stdout>(.*?)<\/local-command-stdout>/s,
              );
              if (stdoutMatch) {
                stdout = stdoutMatch[1];
                if (candidateMessage.uuid)
                  contributingUuids.push(candidateMessage.uuid);
                processedIndices.add(j); // Mark stdout message as processed
                break; // Found the matching stdout, stop looking
              }
            }
          }

          // Create bundled command message and add it to results
          const bundledMessage: ClaudeStreamMessage = {
            ...message,
            _bundledCommand: {
              commandName: commandName.trim(),
              commandMessage: commandMessage.trim(),
              commandArgs: commandArgs?.trim(),
              output: stdout,
            },
            _contributingMessageUuids: contributingUuids,
          };

          bundledMessages.push(bundledMessage);
          // Continue to next message - this command message is now bundled and processed
          continue;
        }
      }

      // Add non-command message with contributing UUIDs
      const messageWithUuids = {
        ...message,
        _contributingMessageUuids: message.uuid ? [message.uuid] : [],
      };
      bundledMessages.push(messageWithUuids);
    }

    return bundledMessages;
  };

  // Helper function: Bundle ALL related messages (summaries, commands+stdout)
  const bundleMessages = (filteredMessages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    // First bundle consecutive summary messages
    const summaryBundled = bundleSummaries(filteredMessages);
    // Then bundle command+output pairs
    return bundleCommands(summaryBundled);
  };

  // Clean message processing pipeline: Filter -> Bundle -> Display
  const displayableMessages = useMemo(() => {
    const startTime = performance.now();

    // Step 1: Filter out unwanted messages (meta, sidechain, etc.)
    const filteredMessages = filterMessages(messages);

    // Step 2: Bundle related messages (summaries, commands + stdout, etc.)
    const bundledMessages = bundleMessages(filteredMessages);

    // Step 3: Add contributing UUIDs but DON'T number yet - numbering happens after MessageRouter
    const messagesWithUuids = bundledMessages.map((msg) => ({
      ...msg,
      _contributingMessageUuids:
        msg._contributingMessageUuids || (msg.uuid ? [msg.uuid] : []),
    }));

    const totalTime = performance.now() - startTime;
    logger.info(
      `🔄 Processed ${messages.length} raw → ${filteredMessages.length} filtered → ${bundledMessages.length} bundled → ${messagesWithUuids.length} displayable (${totalTime.toFixed(2)}ms)`,
    );

    return messagesWithUuids;
  }, [messages]);

  // Extract all message types with simple turn detection
  const { userMessages, toolMessages, assistantMessages, lastInTurnCount } = useMemo(() => {
    // Create fresh assistant messages with array positions and mark last in turn
    const userMessages: UserMessageItem[] = [];
    const toolMessages: ToolMessageItem[] = [];
    const assistantMessages: AssistantMessageItem[] = [];
    
    displayableMessages.forEach((message, arrayIndex) => {
      // Extract user messages
      if (message.type === "user" && message.message) {
        const msg = message.message;
        if (msg.content) {
          let content = "";
          const msgContent = msg.content;
          
          if (typeof msgContent === "string") {
            content = msgContent;
          } else if (Array.isArray(msgContent)) {
            const textContent = msgContent
              .filter((c: any) => c.type === "text" || typeof c === "string")
              .map((c: any) => (typeof c === "string" ? c : c.text || ""))
              .join(" ");
            content = textContent;
          }
          
          const truncatedContent = content.trim().substring(0, 100);
          if (truncatedContent.length > 0) {
            const isSystemArtifact = 
              truncatedContent.includes("[Request interrupted by user") ||
              truncatedContent.includes("<command-name>/hooks") ||
              truncatedContent.includes("<command-message>hooks</command-message>") ||
              truncatedContent.startsWith("<command-");
            
            if (!isSystemArtifact) {
              userMessages.push({
                index: arrayIndex,
                content: truncatedContent,
                messageNumber: arrayIndex + 1,
              });
            }
          }
        }
      }
      
      // Extract assistant messages and mark last in turn
      else if (message.type === "assistant" && message.message?.content) {
        const hasTaskTool = message.message?.content && Array.isArray(message.message.content) &&
                           message.message.content.some((c: any) => 
                             c.type === "tool_use" && c.name?.toLowerCase() === "task"
                           );
        
        const isSubAgentTask = Boolean(hasTaskTool);
        const isSubAgentResponse = Boolean((message as any).isSidechain === true && !hasTaskTool);
        
        // Your simple algorithm: mark as last in turn initially as false, will be set later
        let isLastInTurn = false;
        
        assistantMessages.push({
          index: arrayIndex,
          messageId: (message.message as any)?.id || (message as any).uuid || `assistant-${arrayIndex}`,
          messageNumber: arrayIndex + 1,
          isLastInTurn,
          isSubAgentTask,
          isSubAgentResponse,
        });
        
        // Extract tool usage (but exclude Task tools - those are subagent delegations, not regular tools)
        if (message.message?.content && Array.isArray(message.message.content)) {
          let toolNames: string[] = [];
          message.message.content.forEach((contentItem: any) => {
            if (contentItem.type === "tool_use" && contentItem.name && contentItem.name.toLowerCase() !== "task") {
              toolNames.push(contentItem.name);
            }
          });
          
          if (toolNames.length > 0) {
            toolMessages.push({
              index: arrayIndex,
              toolName: toolNames.join(', '),
              messageNumber: arrayIndex + 1,
            });
          }
        }
      }
    });
    
    // Find the last MAIN assistant before each user message (not subagents)
    userMessages.forEach(userMsg => {
      // Find main assistant with highest index that's still less than user index
      const mainAssistantBeforeUser = assistantMessages
        .filter(a => a.index < userMsg.index && !a.isSubAgentResponse)
        .sort((a, b) => b.index - a.index)[0];
      
      if (mainAssistantBeforeUser) {
        mainAssistantBeforeUser.isLastInTurn = true;
      }
    });
    
    // Mark the last subagent before each main assistant message as last in turn
    const mainAssistants = assistantMessages.filter(a => !a.isSubAgentResponse && !a.isSubAgentTask);
    mainAssistants.forEach(mainAssistant => {
      // Find the subagent with highest index that's still less than this main assistant's index
      const subagentBeforeMain = assistantMessages
        .filter(a => a.isSubAgentResponse && a.index < mainAssistant.index)
        .sort((a, b) => b.index - a.index)[0];
      
      if (subagentBeforeMain) {
        subagentBeforeMain.isLastInTurn = true;
      }
    });
    
    // Mark the very last assistant message as last in turn
    if (assistantMessages.length > 0) {
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      if (!lastAssistant.isLastInTurn) {
        lastAssistant.isLastInTurn = true;
      }
    }
    
    const lastInTurnCount = assistantMessages.filter(a => a.isLastInTurn).length;
    const subagentTaskCount = assistantMessages.filter(a => a.isSubAgentTask).length;
    const subagentResponseCount = assistantMessages.filter(a => a.isSubAgentResponse).length;
    
    
    return { userMessages, toolMessages, assistantMessages, lastInTurnCount };
  }, [displayableMessages]);

  // Calculate total tokens from displayable messages
  const totalTokens = useMemo(() => {
    return displayableMessages.reduce((sum, msg) => {
      if (msg.message?.usage) {
        return sum + msg.message.usage.input_tokens + msg.message.usage.output_tokens;
      }
      return sum;
    }, 0);
  }, [displayableMessages]);

  return {
    displayableMessages,
    collapsedMessageUuids,
    totalTokens,
    userMessages,
    toolMessages,
    assistantMessages,
    lastInTurnCount,
  };
};