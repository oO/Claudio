import { logger } from '@/lib/logger';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

// Global tracking of which messages have already triggered resets to prevent spam
const globalProcessedResets = new Set<string>();

/**
 * Detect if a user message is actually a fake tool result message from Claude Code
 * These should be bundled with their corresponding tool use messages
 */
function isFakeUserToolResult(entry: any): boolean {
  if (entry.type !== "user" || !entry.message?.content) return false;
  
  // Check if content is array with single tool_result
  if (Array.isArray(entry.message.content) && entry.message.content.length === 1) {
    const content = entry.message.content[0];
    return content.type === "tool_result" && content.tool_use_id;
  }
  
  return false;
}

/**
 * Bundle fake user tool result messages with their corresponding tool use messages
 */
function bundleToolResults(messages: ClaudeStreamMessage[]): ClaudeStreamMessage[] {
  const result: ClaudeStreamMessage[] = [];
  const processedToolResults = new Set<string>();
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Check if this is a fake user tool result
    if (isFakeUserToolResult(message) && !processedToolResults.has(message.uuid)) {
      const toolResult = message.message?.content?.[0];
      if (!toolResult?.tool_use_id) continue;
      const toolUseId = toolResult.tool_use_id;
      
      // Find the corresponding tool use message by searching backwards
      let foundToolUse = false;
      for (let j = i - 1; j >= 0; j--) {
        const prevMessage = messages[j];
        
        if (prevMessage.type === "assistant" && 
            prevMessage.message?.content && 
            Array.isArray(prevMessage.message.content)) {
          
          // Look for tool use with matching ID
          const toolUseIndex = prevMessage.message.content.findIndex(
            (c: any) => c.type === "tool_use" && c.id === toolUseId
          );
          
          if (toolUseIndex !== -1) {
            // Bundle the tool result with this assistant message
            const enhancedMessage = {
              ...prevMessage,
              _bundledToolResults: [
                ...(prevMessage._bundledToolResults || []),
                {
                  ...toolResult,
                  _sourceMessageUuid: message.uuid,
                  _originalMessage: message
                }
              ]
            };
            
            // Update the message in result array if it's already there
            const resultIndex = result.findIndex(m => m.uuid === prevMessage.uuid);
            if (resultIndex !== -1) {
              result[resultIndex] = enhancedMessage;
            }
            
            processedToolResults.add(message.uuid);
            foundToolUse = true;
            break;
          }
        }
      }
      
      // Skip adding this fake user message since it's now bundled
      if (foundToolUse) {
        continue;
      }
    }
    
    // Add regular messages
    result.push(message);
  }
  
  return result;
}

/**
 * Process messages to add agent identification (agentType, agentName, subagentType)
 * Based on the existing logic from useSessionState.ts loadSessionHistory()
 */
export function processMessagesWithAgentInfo(messages: any[]): ClaudeStreamMessage[] {
  let currentSubagentType: string | undefined;
  // logger.debug('🔍 Processing messages with agent info, count:', messages.length);
  
  const processedMessages = messages.map((entry, index) => {
    const isSidechain = entry.isSidechain === true;
    let agentType: "main" | "subagent" = isSidechain ? "subagent" : "main";
    let agentName: string | undefined;
    let subagentType: string | undefined;
    
    // Check for Task tool usage to identify subagent type
    if (!isSidechain && entry.message?.content && Array.isArray(entry.message.content)) {
      const taskTool = entry.message.content.find(
        (c: any) => c.type === "tool_use" && c.name === "Task"
      );
      if (taskTool?.input?.subagent_type) {
        // Store the subagent type for upcoming sidechain messages
        currentSubagentType = taskTool.input.subagent_type;
        logger.debug('🤖 Found Task tool call with subagent_type:', currentSubagentType);
      }
    }
    
    // Set agent name and type based on context
    if (isSidechain && currentSubagentType) {
      // Use the stored subagent type for all sidechain messages
      agentName = currentSubagentType;
      subagentType = currentSubagentType;
      logger.debug('🔗 Set sidechain message agent info:', { agentName, subagentType, uuid: entry.uuid });
    } else if (!isSidechain) {
      // Reset when back to main chain
      if (entry.type === "user" && entry.message?.content) {
        // Check if this is a tool result returning from sidechain
        const hasToolResult = Array.isArray(entry.message.content) && 
          entry.message.content.some((c: any) => c.type === "tool_result");
        if (hasToolResult && entry.uuid && !globalProcessedResets.has(entry.uuid)) {
          // logger.debug('🔄 Resetting subagent context - returning to main conversation', { 
          //   messageIndex: index, 
          //   uuid: entry.uuid,
          //   totalMessages: messages.length
          // });
          globalProcessedResets.add(entry.uuid); // Mark this message as processed globally
          currentSubagentType = undefined;
        }
      }
      
      // Main conversation messages
      agentName = agentName || "CloCo";
    }
    
    return {
      ...entry,
      type: entry.type || "assistant",
      agentType,
      agentName,
      subagentType,
      isSidechain,
      parentUuid: entry.parentUuid,
      messageNumber: index + 1
    } as ClaudeStreamMessage;
  });

  // Bundle fake user tool results with their corresponding tool use messages
  return bundleToolResults(processedMessages);
}