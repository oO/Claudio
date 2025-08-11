import { useState, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ClaudeStreamMessage } from "./useAgentExecution";

interface UseExecutionOutputProps {
  messages: ClaudeStreamMessage[];
  rawJsonlOutput: string[];
  isFullscreenModalOpen: boolean;
}

export const useExecutionOutput = ({
  messages,
  rawJsonlOutput,
  isFullscreenModalOpen,
}: UseExecutionOutputProps) => {
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  
  // Refs for scroll containers
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fullscreenMessagesEndRef = useRef<HTMLDivElement>(null);

  // Virtualizers for efficient, smooth scrolling of potentially very long outputs
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 150, // fallback estimate; dynamically measured afterwards
    overscan: 5,
  });

  const fullscreenRowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => fullscreenScrollRef.current,
    estimateSize: () => 150,
    overscan: 5,
  });

  // Check if user is at the very bottom of the scrollable container
  const isAtBottom = () => {
    const container = isFullscreenModalOpen ? fullscreenScrollRef.current : scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom < 1;
    }
    return true;
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;

    // Auto-scroll only if the user has not manually scrolled OR they are still at the bottom
    const shouldAutoScroll = !hasUserScrolled || isAtBottom();

    if (shouldAutoScroll) {
      if (isFullscreenModalOpen) {
        fullscreenRowVirtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "smooth" });
      } else {
        rowVirtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "smooth" });
      }
    }
  }, [messages.length, hasUserScrolled, isFullscreenModalOpen, rowVirtualizer, fullscreenRowVirtualizer]);

  const handleScroll = () => {
    // Mark that user has scrolled manually
    if (!hasUserScrolled) {
      setHasUserScrolled(true);
    }
    
    // If user scrolls back to bottom, re-enable auto-scroll
    if (isAtBottom()) {
      setHasUserScrolled(false);
    }
  };

  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
    setCopyPopoverOpen(false);
  };

  const handleCopyAsMarkdown = async (agent: any) => {
    let markdown = `# Agent Execution: ${agent.name}\n\n`;
    markdown += `**Task:** ${agent.task || 'N/A'}\n`;
    markdown += `**Model:** ${agent.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}\n`;
    markdown += `**Date:** ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      if (msg.type === "system" && msg.subtype === "init") {
        markdown += `## System Initialization\n\n`;
        markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
        markdown += `- Model: \`${msg.model || 'default'}\`\n`;
        if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
        if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
        markdown += `\n`;
      } else if (msg.type === "assistant" && msg.message) {
        markdown += `## Assistant\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_use") {
            markdown += `### Tool: ${content.name}\n\n`;
            markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
          }
        }
        if (msg.message.usage) {
          markdown += `*Tokens: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
        }
      } else if (msg.type === "user" && msg.message) {
        markdown += `## User\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_result") {
            markdown += `### Tool Result\n\n`;
            markdown += `\`\`\`\n${content.content}\n\`\`\`\n\n`;
          }
        }
      } else if (msg.type === "result") {
        markdown += `## Execution Result\n\n`;
        if (msg.result) {
          markdown += `${msg.result}\n\n`;
        }
        if (msg.error) {
          markdown += `**Error:** ${msg.error}\n\n`;
        }
        if (msg.cost_usd !== undefined) {
          markdown += `- **Cost:** $${msg.cost_usd.toFixed(4)} USD\n`;
        }
        if (msg.duration_ms !== undefined) {
          markdown += `- **Duration:** ${(msg.duration_ms / 1000).toFixed(2)}s\n`;
        }
        if (msg.num_turns !== undefined) {
          markdown += `- **Turns:** ${msg.num_turns}\n`;
        }
        if (msg.usage) {
          const total = msg.usage.input_tokens + msg.usage.output_tokens;
          markdown += `- **Total Tokens:** ${total} (${msg.usage.input_tokens} in, ${msg.usage.output_tokens} out)\n`;
        }
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
  };

  return {
    // State
    hasUserScrolled,
    copyPopoverOpen,
    setCopyPopoverOpen,
    
    // Refs
    scrollContainerRef,
    fullscreenScrollRef,
    messagesEndRef,
    fullscreenMessagesEndRef,
    
    // Virtualizers
    rowVirtualizer,
    fullscreenRowVirtualizer,
    
    // Actions
    handleScroll,
    handleCopyAsJsonl,
    handleCopyAsMarkdown,
    isAtBottom,
  };
};