import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { api, type Session, type SessionWithContent } from '@/lib/api';
import type { ClaudeStreamMessage } from '@/components/agents';
import { useTrackEvent, useComponentMetrics, useWorkflowTracking } from '@/hooks';
import { logger } from '@/lib/logger';

// Queued prompt type for external use
export interface QueuedPrompt {
  id: string;
  prompt: string;
  model: "sonnet" | "opus";
}

interface UseSessionStateOptions {
  session?: Session;
  initialProjectPath?: string;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
}

export function useSessionState({
  session,
  initialProjectPath = "",
  onStreamingChange
}: UseSessionStateOptions) {
  // Core session state
  const [projectPath, setProjectPath] = useState(initialProjectPath || session?.project_path || "");
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [extractedSessionInfo, setExtractedSessionInfo] = useState<{ sessionId: string; projectId: string } | null>(null);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [isFirstPrompt, setIsFirstPrompt] = useState(!session);
  const [totalTokens, setTotalTokens] = useState(0);
  const [collapsedMessageUuids, setCollapsedMessageUuids] = useState<string[]>([]);
  const [sessionFilePath, setSessionFilePath] = useState<string | undefined>(undefined);
  
  // Timeline and UI state
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  
  // Fork dialog state
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [forkCheckpointId, setForkCheckpointId] = useState<string | null>(null);
  const [forkSessionName, setForkSessionName] = useState("");
  
  
  // Queued prompts state
  const [queuedPrompts, setQueuedPrompts] = useState<QueuedPrompt[]>([]);
  const [queuedPromptsCollapsed, setQueuedPromptsCollapsed] = useState(false);
  
  // Refs for managing component lifecycle
  const isMountedRef = useRef(true);
  const hasActiveSessionRef = useRef(false);
  const isListeningRef = useRef(false);
  const sessionStartTime = useRef<number>(Date.now());
  const queuedPromptsRef = useRef<Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>>([]);
  
  // Session metrics for analytics
  const sessionMetrics = useRef({
    firstMessageTime: null as number | null,
    promptsSent: 0,
    toolsExecuted: 0,
    toolsFailed: 0,
    filesCreated: 0,
    filesModified: 0,
    filesDeleted: 0,
    codeBlocksGenerated: 0,
    errorsEncountered: 0,
    lastActivityTime: Date.now(),
    toolExecutionTimes: [] as number[],
    checkpointCount: 0,
    wasResumed: !!session,
    modelChanges: [] as Array<{ from: string; to: string; timestamp: number }>,
  });

  // Analytics tracking
  const trackEvent = useTrackEvent();
  useComponentMetrics('ClaudeCodeSession');
  const workflowTracking = useWorkflowTracking('claude_session');

  // Keep ref in sync with state
  useEffect(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);

  // Get effective session info (from prop or extracted)
  const effectiveSession = useMemo(() => {
    if (session) return session;
    if (extractedSessionInfo) {
      return {
        id: extractedSessionInfo.sessionId,
        project_id: extractedSessionInfo.projectId,
        project_path: projectPath,
        created_at: Date.now(),
      } as Session;
    }
    return null;
  }, [session, extractedSessionInfo, projectPath]);

  // Filter and bundle messages that should be displayed
  const displayableMessages = useMemo(() => {
    const processedMessages: ClaudeStreamMessage[] = [];
    const skipIndexes = new Set<number>();
    const filteredUuids: string[] = [];
    let filteredCount = 0;


    for (let index = 0; index < messages.length; index++) {
      // Skip if already processed as part of a bundle
      if (skipIndexes.has(index)) {
        continue;
      }

      const message = messages[index];

      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        filteredCount++;
        if (message.uuid) filteredUuids.push(message.uuid);
        continue;
      }

      // Skip artificial user messages created by sub-agent system
      // These are internal system artifacts that just repeat task prompts
      if (message.isSidechain && message.type === "user") {
        filteredCount++;
        if (message.uuid) filteredUuids.push(message.uuid);
        continue;
      }

      // Handle command bundling for user messages
      if (message.type === "user" && message.message) {
        if (message.isMeta) {
          filteredCount++;
          if (message.uuid) filteredUuids.push(message.uuid);
          continue;
        }

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          filteredCount++;
          if (message.uuid) filteredUuids.push(message.uuid);
          continue;
        }

        // Check for command pattern in string content
        if (typeof msg.content === "string") {
          const contentStr = msg.content as string;
          const commandMatch = contentStr.match(
            /<command-name>(.+?)<\/command-name>[\s\S]*?<command-message>(.+?)<\/command-message>[\s\S]*?<command-args>(.*?)<\/command-args>/,
          );
          
          if (commandMatch) {
            const [, commandName, commandMessage, commandArgs] = commandMatch;
            
            // Look for the next message with stdout
            let stdout = "";
            if (index + 1 < messages.length) {
              const nextMessage = messages[index + 1];
              if (nextMessage.type === "user" && typeof nextMessage.message?.content === "string") {
                const nextContentStr = nextMessage.message.content as string;
                const stdoutMatch = nextContentStr.match(
                  /<local-command-stdout>(.*?)<\/local-command-stdout>/s
                );
                if (stdoutMatch) {
                  stdout = stdoutMatch[1];
                  skipIndexes.add(index + 1); // Mark next message as processed
                  // Add the stdout message UUID to filtered list since it's bundled
                  if (nextMessage.uuid) filteredUuids.push(nextMessage.uuid);
                }
              }
            }

            // Create bundled command message with all contributing UUIDs
            const contributingUuids = [message.uuid];
            if (index + 1 < messages.length && skipIndexes.has(index + 1)) {
              // Include the stdout message UUID that was bundled
              const stdoutMessage = messages[index + 1];
              if (stdoutMessage.uuid) contributingUuids.push(stdoutMessage.uuid);
            }
            
            const bundledMessage: ClaudeStreamMessage = {
              ...message,
              _bundledCommand: {
                commandName: commandName.trim(),
                commandMessage: commandMessage.trim(),
                commandArgs: commandArgs?.trim(),
                output: stdout
              },
              _contributingMessageUuids: contributingUuids.filter(Boolean)
            };
            
            processedMessages.push(bundledMessage);
            continue;
          }
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
            filteredCount++;
            if (message.uuid) filteredUuids.push(message.uuid);
            continue;
          }
        }
      }

      // Add message to processed list with contributing UUIDs
      const messageWithUuids = {
        ...message,
        _contributingMessageUuids: message.uuid ? [message.uuid] : []
      };
      processedMessages.push(messageWithUuids);
    }

    // Renumber messages sequentially for display
    const renumberedMessages = processedMessages.map((msg, index) => ({
      ...msg,
      messageNumber: index + 1 // Sequential numbering starting from 1
    }));

    
    // Store filtered UUIDs for debugging purposes
    setCollapsedMessageUuids(filteredUuids);
    
    return renumberedMessages;
  }, [messages]);

  // Note: Token calculation moved to SessionMessages for single source of truth

  // Report streaming state changes
  useEffect(() => {
    onStreamingChange?.(isLoading, claudeSessionId);
  }, [isLoading, claudeSessionId, onStreamingChange]);

  // Load session history if resuming
  const loadSessionHistory = useCallback(async () => {
    const sessionToLoad = session || effectiveSession;
    if (!sessionToLoad) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const sessionWithContent = await api.loadSessionHistory(sessionToLoad.id, sessionToLoad.project_id);
      const history = sessionWithContent.content;
      
      // Store the file path from the API response
      setSessionFilePath(sessionWithContent.file_path);
      
      // Convert history to messages format with agent identification
      let currentSubagentType: string | undefined;
      
      const loadedMessages: ClaudeStreamMessage[] = history.map((entry, index) => {
        const isSidechain = entry.isSidechain === true;
        let agentType: "main" | "subagent" = isSidechain ? "subagent" : "main";
        let agentName: string | undefined;
        
        // Check for Task tool usage to identify subagent type
        if (!isSidechain && entry.message?.content && Array.isArray(entry.message.content)) {
          const taskTool = entry.message.content.find(
            (c: any) => c.type === "tool_use" && c.name === "Task"
          );
          if (taskTool?.input?.subagent_type) {
            // Store the subagent type for upcoming sidechain messages
            currentSubagentType = taskTool.input.subagent_type;
          }
        }
        
        // Set agent name based on context
        if (isSidechain && currentSubagentType) {
          // Use the stored subagent type for all sidechain messages
          agentName = currentSubagentType;
        } else if (!isSidechain) {
          // Reset when back to main chain
          if (entry.type === "user" && entry.message?.content) {
            // Check if this is a tool result returning from sidechain
            const hasToolResult = Array.isArray(entry.message.content) && 
              entry.message.content.some((c: any) => c.type === "tool_result");
            if (hasToolResult) {
              currentSubagentType = undefined;
            }
          }
        }
        
        return {
          ...entry,
          type: entry.type || "assistant",
          agentType,
          agentName,
          isSidechain,
          parentUuid: entry.parentUuid,
          messageNumber: index + 1 // JSONL line number (1-based)
        };
      });
      
      setMessages(loadedMessages);
      setRawJsonlOutput(history.map(h => JSON.stringify(h)));
      
      // After loading history, we're continuing a conversation
      setIsFirstPrompt(false);
    } catch (err) {
      logger.error("Failed to load session history:", err);
      setError("Failed to load session history");
    } finally {
      setIsLoading(false);
    }
  }, [session, effectiveSession]);

  // Check for active session
  const checkForActiveSession = useCallback(async () => {
    if (session) {
      try {
        const activeSessions = await api.listRunningClaudeSessions();
        const activeSession = activeSessions.find((s: any) => {
          if ('process_type' in s && s.process_type && 'ClaudeSession' in s.process_type) {
            return (s.process_type as any).ClaudeSession.session_id === session.id;
          }
          return false;
        });
        
        if (activeSession) {
          setClaudeSessionId(session.id);
          return true;
        }
      } catch (err) {
        logger.error('Failed to check for active sessions:', err);
      }
    }
    return false;
  }, [session]);

  // Update session metrics
  const updateSessionMetrics = useCallback((message: ClaudeStreamMessage) => {
    // Track enhanced tool execution
    if (message.type === 'assistant' && message.message?.content) {
      const toolUses = message.message.content.filter((c: any) => c.type === 'tool_use');
      toolUses.forEach((toolUse: any) => {
        sessionMetrics.current.toolsExecuted += 1;
        sessionMetrics.current.lastActivityTime = Date.now();
        
        // Track file operations
        const toolName = toolUse.name?.toLowerCase() || '';
        if (toolName.includes('create') || toolName.includes('write')) {
          sessionMetrics.current.filesCreated += 1;
        } else if (toolName.includes('edit') || toolName.includes('multiedit') || toolName.includes('search_replace')) {
          sessionMetrics.current.filesModified += 1;
        } else if (toolName.includes('delete')) {
          sessionMetrics.current.filesDeleted += 1;
        }
        
        // Track tool start
        workflowTracking.trackStep(toolUse.name);
      });
    }
    
    // Track tool results
    if (message.type === 'user' && message.message?.content) {
      const toolResults = message.message.content.filter((c: any) => c.type === 'tool_result');
      toolResults.forEach((result: any) => {
        const isError = result.is_error || false;
        if (isError) {
          sessionMetrics.current.toolsFailed += 1;
          sessionMetrics.current.errorsEncountered += 1;
          
          trackEvent.enhancedError({
            error_type: 'tool_execution',
            error_code: 'tool_failed',
            error_message: result.content,
            context: `Tool execution failed`,
            user_action_before_error: 'executing_tool',
            recovery_attempted: false,
            recovery_successful: false,
            error_frequency: 1,
            stack_trace_hash: undefined
          });
        }
      });
    }
    
    // Track code blocks generated
    if (message.type === 'assistant' && message.message?.content) {
      const codeBlocks = message.message.content.filter((c: any) => 
        c.type === 'text' && c.text?.includes('```')
      );
      if (codeBlocks.length > 0) {
        codeBlocks.forEach((block: any) => {
          const matches = (block.text.match(/```/g) || []).length;
          sessionMetrics.current.codeBlocksGenerated += Math.floor(matches / 2);
        });
      }
    }
    
    // Track errors in system messages
    if (message.type === 'system' && (message.subtype === 'error' || message.error)) {
      sessionMetrics.current.errorsEncountered += 1;
    }
  }, [trackEvent, workflowTracking]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      isListeningRef.current = false;
      
      // Track session completion metrics
      if (effectiveSession) {
        trackEvent.sessionCompleted();
        
        const sessionDuration = sessionStartTime.current ? Date.now() - sessionStartTime.current : 0;
        const messageCount = messages.filter(m => m.user_message).length;
        const toolsUsed = new Set<string>();
        messages.forEach(msg => {
          if (msg.type === 'assistant' && msg.message?.content) {
            const tools = msg.message.content.filter((c: any) => c.type === 'tool_use');
            tools.forEach((tool: any) => toolsUsed.add(tool.name));
          }
        });
        
        // Calculate engagement score (0-100)
        const engagementScore = Math.min(100, 
          (messageCount * 10) + 
          (toolsUsed.size * 5) + 
          (sessionDuration > 300000 ? 20 : sessionDuration / 15000)
        );
        
        trackEvent.sessionEngagement({
          session_duration_ms: sessionDuration,
          messages_sent: messageCount,
          tools_used: Array.from(toolsUsed),
          files_modified: 0,
          engagement_score: Math.round(engagementScore)
        });
      }
      
      // Clear checkpoint manager when session ends
      if (effectiveSession) {
        api.clearCheckpointManager(effectiveSession.id).catch(err => {
          logger.error("Failed to clear checkpoint manager:", err);
        });
      }
    };
  }, [effectiveSession, messages, trackEvent]);

  return {
    // Core session state
    projectPath,
    setProjectPath,
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    error,
    setError,
    rawJsonlOutput,
    setRawJsonlOutput,
    extractedSessionInfo,
    setExtractedSessionInfo,
    claudeSessionId,
    setClaudeSessionId,
    isFirstPrompt,
    setIsFirstPrompt,
    totalTokens,
    setTotalTokens,
    
    // UI state
    showTimeline,
    setShowTimeline,
    timelineVersion,
    setTimelineVersion,
    showSettings,
    setShowSettings,
    showPreview,
    setShowPreview,
    previewUrl,
    setPreviewUrl,
    showPreviewPrompt,
    setShowPreviewPrompt,
    splitPosition,
    setSplitPosition,
    isPreviewMaximized,
    setIsPreviewMaximized,
    showForkDialog,
    setShowForkDialog,
    forkCheckpointId,
    setForkCheckpointId,
    forkSessionName,
    setForkSessionName,
    
    // Queue state
    queuedPrompts,
    setQueuedPrompts,
    queuedPromptsCollapsed,
    setQueuedPromptsCollapsed,
    
    // Computed values
    effectiveSession,
    displayableMessages,
    collapsedMessageUuids,
    sessionFilePath,
    
    // Refs
    isMountedRef,
    hasActiveSessionRef,
    isListeningRef,
    sessionStartTime,
    queuedPromptsRef,
    sessionMetrics,
    
    // Analytics
    trackEvent,
    workflowTracking,
    
    // Methods
    loadSessionHistory,
    checkForActiveSession,
    updateSessionMetrics,
  };
}