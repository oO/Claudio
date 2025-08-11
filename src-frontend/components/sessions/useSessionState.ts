import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { api, type Session } from '@/lib/api';
import type { ClaudeStreamMessage } from '@/components/agents';
import { useTrackEvent, useComponentMetrics, useWorkflowTracking } from '@/hooks';

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
  const [queuedPrompts, setQueuedPrompts] = useState<Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>>([]);
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

  // Filter out messages that shouldn't be displayed
  const displayableMessages = useMemo(() => {
    return messages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        return false;
      }

      // Skip user messages that only contain tool results that are already displayed
      if (message.type === "user" && message.message) {
        if (message.isMeta) return false;

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          return false;
        }

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
            return false;
          }
        }
      }
      return true;
    });
  }, [messages]);

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

  // Report streaming state changes
  useEffect(() => {
    onStreamingChange?.(isLoading, claudeSessionId);
  }, [isLoading, claudeSessionId, onStreamingChange]);

  // Load session history if resuming
  const loadSessionHistory = useCallback(async () => {
    if (!session) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const history = await api.loadSessionHistory(session.id, session.project_id);
      
      // Convert history to messages format
      const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
        ...entry,
        type: entry.type || "assistant"
      }));
      
      setMessages(loadedMessages);
      setRawJsonlOutput(history.map(h => JSON.stringify(h)));
      
      // After loading history, we're continuing a conversation
      setIsFirstPrompt(false);
    } catch (err) {
      console.error("Failed to load session history:", err);
      setError("Failed to load session history");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

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
        console.error('Failed to check for active sessions:', err);
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
          console.error("Failed to clear checkpoint manager:", err);
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