import { useAgentMetadata } from '@/hooks';
import { getAgentColor } from '@/lib/agentColors';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

interface AgentStyling {
  agentName: string;
  agentBackgroundClass: string;
}

/**
 * Get the agent background class for the general-purpose built-in subagent
 * This is the only built-in subagent type in Claude Code
 */
const getGeneralPurposeColorClass = (): string => {
  return "agent-bg-grey";
};

/**
 * Hook that processes agent metadata for assistant and subagent messages
 * Handles agent colors, names, and background styling
 */
export const useAgentStyling = (message: ClaudeStreamMessage): AgentStyling => {
  // Get agent info for display
  const agentName = message.agentName || "Assistant";

  // Load agent metadata for project/personal agents
  const effectiveSubagentType =
    message.agentType === "subagent"
      ? message.subagentType || message.agentName
      : undefined;
  const { metadata: agentMetadata } = useAgentMetadata(effectiveSubagentType);

  // Helper to get agent background class
  const getAgentBackgroundClass = (): string => {
    // For subagents
    if (message.agentType === "subagent") {
      // Built-in Claude Code subagents
      if (effectiveSubagentType === "general-purpose") {
        return getGeneralPurposeColorClass();
      }

      // All other subagents are project/personal agents with metadata
      if (agentMetadata?.color) {
        // Use existing color system but get background-only class
        const agentColor = getAgentColor(agentMetadata.color);
        // Convert agent-* class to agent-bg-* class
        return agentColor.cssClass.replace("agent-", "agent-bg-");
      }

      // Fallback for project/personal agents without color metadata
      return "agent-bg-grey";
    }

    // Main agent uses default border styling
    return "border-primary/20";
  };

  return {
    agentName,
    agentBackgroundClass: getAgentBackgroundClass(),
  };
};