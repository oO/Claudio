import { useRef, useEffect, useCallback } from 'react';
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import type { ClaudeStreamMessage } from "@/components/agents";

interface SessionMessageHandlerProps {
  claudeSessionId: string | null;
  effectiveSession: any;
  projectPath: string;
  isFirstPrompt: boolean;
  isLoading: boolean;
  isMountedRef: React.RefObject<boolean>;
  isListeningRef: React.MutableRefObject<boolean>;
  hasActiveSessionRef: React.MutableRefObject<boolean>;
  queuedPromptsRef: React.MutableRefObject<Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>>;
  sessionMetrics: React.MutableRefObject<any>;
  messages: ClaudeStreamMessage[];
  totalTokens: number;
  queuedPrompts: Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>;
  
  // State setters
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMessages: (updater: (prev: ClaudeStreamMessage[]) => ClaudeStreamMessage[]) => void;
  setRawJsonlOutput: (updater: (prev: string[]) => string[]) => void;
  setClaudeSessionId: (id: string | null) => void;
  setExtractedSessionInfo: (info: { sessionId: string; projectId: string } | null) => void;
  setIsFirstPrompt: (first: boolean) => void;
  setQueuedPrompts: (updater: (prev: Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>) => Array<{ id: string; prompt: string; model: "sonnet" | "opus" }>) => void;
  setTimelineVersion: (updater: (v: number) => number) => void;
  
  // Analytics callbacks
  trackEvent: any;
  workflowTracking: any;
  updateSessionMetrics: (message: ClaudeStreamMessage) => void;
}

const SessionMessageHandlerComponent: React.FC<SessionMessageHandlerProps> = ({
  claudeSessionId,
  effectiveSession,
  projectPath,
  isFirstPrompt,
  isLoading,
  isMountedRef,
  isListeningRef,
  hasActiveSessionRef,
  queuedPromptsRef,
  sessionMetrics,
  messages,
  totalTokens,
  queuedPrompts,
  setIsLoading,
  setError,
  setMessages,
  setRawJsonlOutput,
  setClaudeSessionId,
  setExtractedSessionInfo,
  setIsFirstPrompt,
  setQueuedPrompts,
  setTimelineVersion,
  trackEvent,
  workflowTracking: _workflowTracking,
  updateSessionMetrics,
}) => {
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // Reconnect to existing session
  const _reconnectToSession = useCallback(async (sessionId: string) => {
    
    // Prevent duplicate listeners
    if (isListeningRef.current) {
      return;
    }
    
    // Clean up previous listeners
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
    
    setClaudeSessionId(sessionId);
    isListeningRef.current = true;
    
    // Set up session-specific listeners
    const outputUnlisten = await listen<string>(`claude-output:${sessionId}`, async (event) => {
      try {
        
        if (!isMountedRef.current) return;
        
        setRawJsonlOutput(prev => [...prev, event.payload]);
        
        const message = JSON.parse(event.payload) as ClaudeStreamMessage;
        updateSessionMetrics(message);
        setMessages(prev => [...prev, message]);
      } catch (err) {
        console.error("Failed to parse message:", err, event.payload);
      }
    });

    const errorUnlisten = await listen<string>(`claude-error:${sessionId}`, (event) => {
      console.error("Claude error:", event.payload);
      if (isMountedRef.current) {
        setError(event.payload);
      }
    });

    const completeUnlisten = await listen<boolean>(`claude-complete:${sessionId}`, async (event) => {
        if (isMountedRef.current) {
        setIsLoading(false);
        hasActiveSessionRef.current = false;
      }
    });

    unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten];
    
    // Mark as loading to show the session is active
    if (isMountedRef.current) {
      setIsLoading(true);
      hasActiveSessionRef.current = true;
    }
  }, [
    isListeningRef,
    isMountedRef,
    setClaudeSessionId,
    setRawJsonlOutput,
    setMessages,
    setError,
    setIsLoading,
    hasActiveSessionRef,
    updateSessionMetrics
  ]);

  // Send prompt to Claude
  const sendPrompt = useCallback(async (prompt: string, model: "sonnet" | "opus") => {
    
    if (!projectPath) {
      setError("Please select a project directory first");
      return;
    }

    // If already loading, queue the prompt
    if (isLoading) {
      const newPrompt = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        model
      };
      setQueuedPrompts(prev => [...prev, newPrompt]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      hasActiveSessionRef.current = true;
      
      // For resuming sessions, ensure we have the session ID
      if (effectiveSession && !claudeSessionId) {
        setClaudeSessionId(effectiveSession.id);
      }
      
      // Only clean up and set up new listeners if not already listening
      if (!isListeningRef.current) {
        // Clean up previous listeners
        unlistenRefs.current.forEach(unlisten => unlisten());
        unlistenRefs.current = [];
        
        // Mark as setting up listeners
        isListeningRef.current = true;
        

        let currentSessionId: string | null = claudeSessionId || effectiveSession?.id || null;

        // Helper to attach session-specific listeners
        const attachSessionSpecificListeners = async (sid: string) => {

          const specificOutputUnlisten = await listen<string>(`claude-output:${sid}`, (evt) => {
            handleStreamMessage(evt.payload);
          });

          const specificErrorUnlisten = await listen<string>(`claude-error:${sid}`, (evt) => {
            setError(evt.payload);
          });

          const specificCompleteUnlisten = await listen<boolean>(`claude-complete:${sid}`, (evt) => {
            processComplete(evt.payload);
          });

          // Replace existing unlisten refs with these new ones (after cleaning up)
          unlistenRefs.current.forEach((u) => u());
          unlistenRefs.current = [specificOutputUnlisten, specificErrorUnlisten, specificCompleteUnlisten];
        };

        // Generic listeners (catch-all)
        const genericOutputUnlisten = await listen<string>('claude-output', async (event) => {
          handleStreamMessage(event.payload);

          // Attempt to extract session_id on the fly (for the very first init)
          try {
            const msg = JSON.parse(event.payload) as ClaudeStreamMessage;
            if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
              if (!currentSessionId || currentSessionId !== msg.session_id) {
                currentSessionId = msg.session_id;
                setClaudeSessionId(msg.session_id);

                // If we haven't extracted session info before, do it now
                const projectId = projectPath.replace(/[^a-zA-Z0-9]/g, '-');
                setExtractedSessionInfo({ sessionId: msg.session_id, projectId });

                // Switch to session-specific listeners
                await attachSessionSpecificListeners(msg.session_id);
              }
            }
          } catch {
            /* ignore parse errors */
          }
        });

        // Helper to process any JSONL stream message string
        function handleStreamMessage(payload: string) {
          try {
            // Don't process if component unmounted
            if (!isMountedRef.current) return;
            
            setRawJsonlOutput((prev) => [...prev, payload]);

            const message = JSON.parse(payload) as ClaudeStreamMessage;
            
            // Update session metrics
            updateSessionMetrics(message);
            
            setMessages((prev) => [...prev, message]);
          } catch (err) {
            console.error('Failed to parse message:', err, payload);
          }
        }

        // Helper to handle completion events
        const processComplete = async (success: boolean) => {
          setIsLoading(false);
          hasActiveSessionRef.current = false;
          isListeningRef.current = false;
          
          // Track enhanced session stopped metrics
          if (effectiveSession && claudeSessionId) {
            const sessionStartTimeValue = messages.length > 0 ? messages[0].timestamp || Date.now() : Date.now();
            const duration = Date.now() - sessionStartTimeValue;
            const metrics = sessionMetrics.current;
            const timeToFirstMessage = metrics.firstMessageTime 
              ? metrics.firstMessageTime - sessionStartTimeValue
              : undefined;
            const idleTime = Date.now() - metrics.lastActivityTime;
            const avgResponseTime = metrics.toolExecutionTimes.length > 0
              ? metrics.toolExecutionTimes.reduce((a: number, b: number) => a + b, 0) / metrics.toolExecutionTimes.length
              : undefined;
            
            trackEvent.enhancedSessionStopped({
              duration_ms: duration,
              messages_count: messages.length,
              reason: success ? 'completed' : 'error',
              time_to_first_message_ms: timeToFirstMessage,
              average_response_time_ms: avgResponseTime,
              idle_time_ms: idleTime,
              prompts_sent: metrics.promptsSent,
              tools_executed: metrics.toolsExecuted,
              tools_failed: metrics.toolsFailed,
              files_created: metrics.filesCreated,
              files_modified: metrics.filesModified,
              files_deleted: metrics.filesDeleted,
              total_tokens_used: totalTokens,
              code_blocks_generated: metrics.codeBlocksGenerated,
              errors_encountered: metrics.errorsEncountered,
              model: metrics.modelChanges.length > 0 
                ? metrics.modelChanges[metrics.modelChanges.length - 1].to 
                : 'sonnet',
              has_checkpoints: metrics.checkpointCount > 0,
              checkpoint_count: metrics.checkpointCount,
              was_resumed: metrics.wasResumed,
              agent_type: undefined,
              agent_name: undefined,
              agent_success: success,
              stop_source: 'completed',
              final_state: success ? 'success' : 'failed',
              has_pending_prompts: queuedPrompts.length > 0,
              pending_prompts_count: queuedPrompts.length,
            });
          }

          if (effectiveSession && success) {
            try {
              const settings = await api.getCheckpointSettings(
                effectiveSession.id,
                effectiveSession.project_id,
                projectPath
              );

              if (settings.auto_checkpoint_enabled) {
                await api.checkAutoCheckpoint(
                  effectiveSession.id,
                  effectiveSession.project_id,
                  projectPath,
                  prompt
                );
                setTimelineVersion((v) => v + 1);
              }
            } catch (err) {
              console.error('Failed to check auto checkpoint:', err);
            }
          }

          // Process queued prompts after completion
          if (queuedPromptsRef.current && queuedPromptsRef.current.length > 0) {
            const [nextPrompt, ...remainingPrompts] = queuedPromptsRef.current;
            setQueuedPrompts(() => remainingPrompts);
            
            setTimeout(() => {
              sendPrompt(nextPrompt.prompt, nextPrompt.model);
            }, 100);
          }
        };

        const genericErrorUnlisten = await listen<string>('claude-error', (evt) => {
          setError(evt.payload);
        });

        const genericCompleteUnlisten = await listen<boolean>('claude-complete', (evt) => {
          processComplete(evt.payload);
        });

        // Store the generic unlisteners for now
        unlistenRefs.current = [genericOutputUnlisten, genericErrorUnlisten, genericCompleteUnlisten];

        // Add the user message immediately to the UI
        const userMessage: ClaudeStreamMessage = {
          type: "user",
          message: {
            content: [
              {
                type: "text",
                text: prompt
              }
            ]
          }
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Update session metrics
        sessionMetrics.current.promptsSent += 1;
        sessionMetrics.current.lastActivityTime = Date.now();
        if (!sessionMetrics.current.firstMessageTime) {
          sessionMetrics.current.firstMessageTime = Date.now();
        }
        
        // Track model changes
        const lastModel = sessionMetrics.current.modelChanges.length > 0 
          ? sessionMetrics.current.modelChanges[sessionMetrics.current.modelChanges.length - 1].to
          : (sessionMetrics.current.wasResumed ? 'sonnet' : model);
        
        if (lastModel !== model) {
          sessionMetrics.current.modelChanges.push({
            from: lastModel,
            to: model,
            timestamp: Date.now()
          });
        }
        
        // Track enhanced prompt submission
        const codeBlockMatches = prompt.match(/```[\s\S]*?```/g) || [];
        const hasCode = codeBlockMatches.length > 0;
        const conversationDepth = messages.filter(m => m.user_message).length;
        const sessionAge = Date.now() - (sessionMetrics.current.firstMessageTime || Date.now());
        const wordCount = prompt.split(/\s+/).filter(word => word.length > 0).length;
        
        trackEvent.enhancedPromptSubmitted({
          prompt_length: prompt.length,
          model: model,
          has_attachments: false,
          source: 'keyboard',
          word_count: wordCount,
          conversation_depth: conversationDepth,
          prompt_complexity: wordCount < 20 ? 'simple' : wordCount < 100 ? 'moderate' : 'complex',
          contains_code: hasCode,
          language_detected: hasCode ? codeBlockMatches?.[0]?.match(/```(\w+)/)?.[1] : undefined,
          session_age_ms: sessionAge
        });

        // Execute the appropriate command
        if (effectiveSession && !isFirstPrompt) {
          trackEvent.sessionResumed(effectiveSession.id);
          trackEvent.modelSelected(model);
          await api.resumeClaudeCode(projectPath, effectiveSession.id, prompt, model);
        } else {
          setIsFirstPrompt(false);
          trackEvent.sessionCreated(model, 'prompt_input');
          trackEvent.modelSelected(model);
          await api.executeClaudeCode(projectPath, prompt, model);
        }
      }
    } catch (err) {
      console.error("Failed to send prompt:", err);
      setError("Failed to send prompt");
      setIsLoading(false);
      hasActiveSessionRef.current = false;
    }
  }, [
    projectPath,
    claudeSessionId,
    effectiveSession,
    isLoading,
    isFirstPrompt,
    isMountedRef,
    isListeningRef,
    hasActiveSessionRef,
    sessionMetrics,
    messages,
    totalTokens,
    queuedPrompts,
    queuedPromptsRef,
    setIsLoading,
    setError,
    setQueuedPrompts,
    setClaudeSessionId,
    setExtractedSessionInfo,
    setRawJsonlOutput,
    setMessages,
    setIsFirstPrompt,
    setTimelineVersion,
    trackEvent,
    updateSessionMetrics
  ]);

  // Cancel execution
  const _cancelExecution = useCallback(async () => {
    if (!claudeSessionId || !isLoading) return;
    
    try {
      const sessionStartTimeValue = messages.length > 0 ? messages[0].timestamp || Date.now() : Date.now();
      const duration = Date.now() - sessionStartTimeValue;
      
      await api.cancelClaudeExecution(claudeSessionId);
      
      // Calculate metrics for enhanced analytics
      const metrics = sessionMetrics.current;
      const timeToFirstMessage = metrics.firstMessageTime 
        ? metrics.firstMessageTime - sessionStartTimeValue
        : undefined;
      const idleTime = Date.now() - metrics.lastActivityTime;
      const avgResponseTime = metrics.toolExecutionTimes.length > 0
        ? metrics.toolExecutionTimes.reduce((a: number, b: number) => a + b, 0) / metrics.toolExecutionTimes.length
        : undefined;
      
      // Track enhanced session stopped
      trackEvent.enhancedSessionStopped({
        duration_ms: duration,
        messages_count: messages.length,
        reason: 'user_stopped',
        time_to_first_message_ms: timeToFirstMessage,
        average_response_time_ms: avgResponseTime,
        idle_time_ms: idleTime,
        prompts_sent: metrics.promptsSent,
        tools_executed: metrics.toolsExecuted,
        tools_failed: metrics.toolsFailed,
        files_created: metrics.filesCreated,
        files_modified: metrics.filesModified,
        files_deleted: metrics.filesDeleted,
        total_tokens_used: totalTokens,
        code_blocks_generated: metrics.codeBlocksGenerated,
        errors_encountered: metrics.errorsEncountered,
        model: metrics.modelChanges.length > 0 
          ? metrics.modelChanges[metrics.modelChanges.length - 1].to 
          : 'sonnet',
        has_checkpoints: metrics.checkpointCount > 0,
        checkpoint_count: metrics.checkpointCount,
        was_resumed: metrics.wasResumed,
        agent_type: undefined,
        agent_name: undefined,
        agent_success: undefined,
        stop_source: 'user_button',
        final_state: 'cancelled',
        has_pending_prompts: queuedPrompts.length > 0,
        pending_prompts_count: queuedPrompts.length,
      });
      
      // Clean up listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Reset states
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
      
      // Clear queued prompts
      setQueuedPrompts(() => []);
      
      // Add a message indicating the session was cancelled
      const cancelMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "info",
        result: "Session cancelled by user",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, cancelMessage]);
    } catch (err) {
      console.error("Failed to cancel execution:", err);
      
      // Even if backend fails, update UI to reflect stopped state
      const errorMessage: ClaudeStreamMessage = {
        type: "system",
        subtype: "error",
        result: `Failed to cancel execution: ${err instanceof Error ? err.message : 'Unknown error'}. The process may still be running in the background.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Clean up listeners anyway
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      
      // Reset states to allow user to continue
      setIsLoading(false);
      hasActiveSessionRef.current = false;
      isListeningRef.current = false;
      setError(null);
    }
  }, [
    claudeSessionId,
    isLoading,
    messages,
    sessionMetrics,
    totalTokens,
    queuedPrompts,
    setIsLoading,
    setError,
    setQueuedPrompts,
    setMessages,
    trackEvent
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, [isListeningRef]);

  // This component doesn't render anything, it only manages message handling
  return null;
};

// Export the methods for external use
export const SessionMessageHandler = SessionMessageHandlerComponent;

// Custom hook to use the message handler
export function useSessionMessageHandler(props: Omit<SessionMessageHandlerProps, 'children'>) {
  const _messageHandlerRef = useRef<{
    sendPrompt: (prompt: string, model: "sonnet" | "opus") => Promise<void>;
    cancelExecution: () => Promise<void>;
    reconnectToSession: (sessionId: string) => Promise<void>;
  }>();

  return {
    MessageHandlerComponent: () => <SessionMessageHandler {...props} />,
    sendPrompt: (_prompt: string, _model: "sonnet" | "opus") => {
      // We'll need to pass these methods through props or use a different pattern
    },
    cancelExecution: () => {
    },
    reconnectToSession: (_sessionId: string) => {
    }
  };
}