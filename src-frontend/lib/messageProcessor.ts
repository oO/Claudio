import { logger } from '@/lib/logger';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

// Global tracking of which messages have already triggered resets to prevent spam
const globalProcessedResets = new Set<string>();

/**
 * Process messages to add agent identification (agentType, agentName, subagentType)
 * Based on the existing logic from useSessionState.ts loadSessionHistory()
 */
export function processMessagesWithAgentInfo(messages: any[]): ClaudeStreamMessage[] {
  let currentSubagentType: string | undefined;
  // logger.debug('🔍 Processing messages with agent info, count:', messages.length);
  
  return messages.map((entry, index) => {
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
}