import React, { useState, useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api, type Agent } from "@/lib/api";
import { useTrackEvent, useFeatureAdoptionTracking } from "@/hooks";

export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  message?: {
    content?: any[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  // Agent identification fields
  agentType?: "main" | "subagent";
  agentName?: string; // "CloCo" (or user-configured) for main, subagent_type for subagents
  subagentType?: string; // Only for subagents (e.g., "commit-expert")
  isSidechain?: boolean; // True for subagent execution
  parentUuid?: string; // Links messages in execution chain
  messageNumber?: number; // Line number in original JSONL file for debugging
  // Command bundling for native Claude Code commands
  _bundledCommand?: {
    commandName: string;
    commandMessage: string;
    commandArgs?: string;
    output?: string;
  };
  // Array of UUIDs for all messages that contribute to this displayed card
  _contributingMessageUuids?: string[];
  [key: string]: any;
}

interface UseAgentExecutionProps {
  agent: Agent;
}

export const useAgentExecution = ({ agent }: UseAgentExecutionProps) => {
  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  
  // Execution configuration
  const [projectPath, setProjectPath] = useState("");
  const [task, setTask] = useState(agent.default_task || "");
  const [model, setModel] = useState(agent.model || "sonnet");
  
  // Execution stats
  const [executionStartTime, setExecutionStartTime] = useState<number | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs for cleanup
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const elapsedTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Analytics tracking
  const trackEvent = useTrackEvent();
  const agentFeatureTracking = useFeatureAdoptionTracking(`agent_${agent.name || 'custom'}`);

  // Filter out messages that shouldn't be displayed
  const displayableMessages = React.useMemo(() => {
    return messages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        return false;
      }

      // Skip empty user messages
      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;
        
        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          return false;
        }
        
        // Check if user message has visible content by checking its parts
        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") {
              hasVisibleContent = true;
              break;
            } else if (content.type === "tool_result") {
              // Check if this tool result will be skipped by a widget
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Look for the matching tool_use in previous assistant messages
                for (let i = index - 1; i >= 0; i--) {
                  const prevMsg = messages[i];
                  if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                    const toolUse = prevMsg.message.content.find((c: any) => 
                      c.type === 'tool_use' && c.id === content.tool_use_id
                    );
                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();
                      const toolsWithWidgets = [
                        'task', 'edit', 'multiedit', 'todowrite', 'ls', 'read', 
                        'glob', 'bash', 'write', 'grep'
                      ];
                      if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                        willBeSkipped = true;
                      }
                      break;
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
            return false;
          }
        }
      }

      return true;
    });
  }, [messages]);

  // Update elapsed time while running
  useEffect(() => {
    if (isRunning && executionStartTime) {
      elapsedTimeIntervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - executionStartTime) / 1000));
      }, 100);
    } else {
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    }
    
    return () => {
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    };
  }, [isRunning, executionStartTime]);

  // Calculate total tokens from messages
  useEffect(() => {
    const tokens = messages.reduce((total, msg) => {
      if (msg.message?.usage) {
        return total + msg.message.usage.input_tokens + msg.message.usage.output_tokens;
      }
      if (msg.usage) {
        return total + msg.usage.input_tokens + msg.usage.output_tokens;
      }
      return total;
    }, 0);
    setTotalTokens(tokens);
  }, [messages]);

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    };
  }, []);

  const handleExecute = async () => {
    try {
      setIsRunning(true);
      setExecutionStartTime(Date.now());
      setMessages([]);
      setRawJsonlOutput([]);
      setRunId(null);
      
      // Clear any existing listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Execute the agent and get the run ID
      const executionRunId = await api.executeAgent(agent.id!, projectPath, task, model);
      setRunId(executionRunId);
      
      // Track agent execution start
      trackEvent.agentStarted({
        agent_type: agent.name || 'custom',
        agent_name: agent.name,
        has_custom_prompt: task !== agent.default_task
      });
      
      // Track feature adoption
      agentFeatureTracking.trackUsage();
      
      // Set up event listeners with run ID isolation
      const outputUnlisten = await listen<string>(`agent-output:${executionRunId}`, (event) => {
        try {
          // Store raw JSONL
          setRawJsonlOutput(prev => [...prev, event.payload]);
          
          // Parse and display
          const message = JSON.parse(event.payload) as ClaudeStreamMessage;
          setMessages(prev => [...prev, message]);
        } catch (err) {
        }
      });

      const errorUnlisten = await listen<string>(`agent-error:${executionRunId}`, (event) => {
        setError(event.payload);
        
        // Track agent error
        trackEvent.agentError({
          error_type: 'runtime_error',
          error_stage: 'execution',
          retry_count: 0,
          agent_type: agent.name || 'custom'
        });
      });

      const completeUnlisten = await listen<boolean>(`agent-complete:${executionRunId}`, (event) => {
        setIsRunning(false);
        const duration = executionStartTime ? Date.now() - executionStartTime : undefined;
        setExecutionStartTime(null);
        if (!event.payload) {
          setError("Agent execution failed");
          // Track both the old event for compatibility and the new error event
          trackEvent.agentExecuted(agent.name || 'custom', false, agent.name, duration);
          trackEvent.agentError({
            error_type: 'execution_failed',
            error_stage: 'completion',
            retry_count: 0,
            agent_type: agent.name || 'custom'
          });
        } else {
          trackEvent.agentExecuted(agent.name || 'custom', true, agent.name, duration);
        }
      });

      const cancelUnlisten = await listen<boolean>(`agent-cancelled:${executionRunId}`, () => {
        setIsRunning(false);
        setExecutionStartTime(null);
        setError("Agent execution was cancelled");
      });

      unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten, cancelUnlisten];
    } catch (err) {
      setIsRunning(false);
      setExecutionStartTime(null);
      setRunId(null);
      // Show error in messages
      setMessages(prev => [...prev, {
        type: "result",
        subtype: "error",
        is_error: true,
        result: `Failed to execute agent: ${err instanceof Error ? err.message : 'Unknown error'}`,
        duration_ms: 0,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      }]);
    }
  };

  const handleStop = async () => {
    try {
      if (!runId) {
        return;
      }

      // Call the API to kill the agent session
      const success = await api.killAgentSession(runId);
      
      if (success) {
      } else {
      }
      
      // Update UI state
      setIsRunning(false);
      setExecutionStartTime(null);
      
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Add a message indicating execution was stopped
      setMessages(prev => [...prev, {
        type: "result",
        subtype: "error",
        is_error: true,
        result: "Execution stopped by user",
        duration_ms: elapsedTime * 1000,
        usage: {
          input_tokens: totalTokens,
          output_tokens: 0
        }
      }]);
    } catch (err) {
      // Still update UI state even if the backend call failed
      setIsRunning(false);
      setExecutionStartTime(null);
      
      // Show error message
      setMessages(prev => [...prev, {
        type: "result",
        subtype: "error",
        is_error: true,
        result: `Failed to stop execution: ${err instanceof Error ? err.message : 'Unknown error'}`,
        duration_ms: elapsedTime * 1000,
        usage: {
          input_tokens: totalTokens,
          output_tokens: 0
        }
      }]);
    }
  };

  const cleanupExecution = () => {
    // Clean up listeners but don't stop the actual agent process
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
  };

  return {
    // State
    isRunning,
    messages,
    displayableMessages,
    rawJsonlOutput,
    error,
    runId,
    
    // Configuration
    projectPath,
    setProjectPath,
    task,
    setTask,
    model,
    setModel,
    
    // Stats
    executionStartTime,
    totalTokens,
    elapsedTime,
    
    // Actions
    handleExecute,
    handleStop,
    cleanupExecution,
    setError,
  };
};