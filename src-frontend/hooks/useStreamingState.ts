import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";
import { SESSION_TYPES, type SessionState } from "@/lib/sessionHandleApi";

/**
 * Hook for managing streaming state and thinking content
 * Handles native session thinking state and random thinking content
 */
interface UseStreamingStateReturn {
  effectiveIsStreaming: boolean;
  thinkingContent: { title: string; message: string };
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;
  nativeSessionHook: Record<string, any> | null; // Hook data from thinking events
}

export const useStreamingState = (
  sessionState: SessionState | null,
  isSessionThinking: (sessionId: string) => boolean,
  queryInitialSessionState?: (sessionId: string) => Promise<void>,
  getSessionThinkingEvent?: (sessionId: string) => { hook?: Record<string, any> | null } | null
): UseStreamingStateReturn => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  // State for random thinking content
  const [thinkingContent, setThinkingContent] = useState({
    title: "Claude is thinking...",
    message: "Code flows like water — Through circuits of thought and dream — Beauty takes its form",
  });

  // Extract hook data from thinking events for native sessions
  const nativeSessionHook = useMemo((): Record<string, any> | null => {
    if (!getSessionThinkingEvent || !sessionState) return null;

    if (sessionState.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      if (claudeSessionId) {
        const thinkingEvent = getSessionThinkingEvent(claudeSessionId);
        return thinkingEvent?.hook || null;
      }
    }
    return null;
  }, [
    sessionState?.session_type.type,
    sessionState?.current_claude_session_id,
    getSessionThinkingEvent,
  ]);

  // Compute effective streaming state - for native and Claudio sessions, use thinking state
  const effectiveIsStreaming = useMemo((): boolean => {
    if (sessionState?.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      const isThinking = claudeSessionId ? isSessionThinking(claudeSessionId) : false;

      return Boolean(isThinking);
    } else if (sessionState?.session_type.type === SESSION_TYPES.CLAUDIO) {
      // For Claudio sessions, use the claudio_id to check thinking state
      const claudeSessionId = sessionState.current_claude_session_id;
      const claudiaId = (sessionState.session_type.data as any)?.claudio_id;
      // Check both the current Claude session and the Claudio wrapper ID
      const isThinkingClaude = claudeSessionId ? isSessionThinking(claudeSessionId) : false;
      const isThinkingClaudio = claudiaId ? isSessionThinking(claudiaId) : false;

      return Boolean(isThinkingClaude || isThinkingClaudio);
    }
    return Boolean(isStreaming);
  }, [
    sessionState?.session_type.type,
    sessionState?.current_claude_session_id,
    sessionState?.claudio_id,
    isSessionThinking,
    isStreaming,
  ]);

  // Query initial session state when a native or Claudio session first loads
  useEffect(() => {
    if (queryInitialSessionState) {
      if (
        sessionState?.session_type.type === SESSION_TYPES.NATIVE &&
        sessionState.current_claude_session_id
      ) {
        const claudeSessionId = sessionState.current_claude_session_id;
        queryInitialSessionState(claudeSessionId);
      } else if (
        sessionState?.session_type.type === SESSION_TYPES.CLAUDIO &&
        (sessionState.session_type.data as any)?.claudio_id
      ) {
        const claudiaId = (sessionState.session_type.data as any)?.claudio_id;
        queryInitialSessionState(claudiaId);
      }
    }
  }, [sessionState?.session_type.type, sessionState?.current_claude_session_id, sessionState?.claudio_id, queryInitialSessionState]);
  
  // Fetch random thinking content when streaming starts
  useEffect(() => {
    if (
      effectiveIsStreaming &&
      (sessionState?.session_type.type === SESSION_TYPES.NATIVE || 
       sessionState?.session_type.type === SESSION_TYPES.CLAUDIO)
    ) {
      const fetchThinkingContent = async () => {
        try {
          const [title, message] = await invoke<[string, string]>(
            "get_random_thinking_content",
          );
          setThinkingContent({ title, message });
        } catch (error) {
          logger.error("Failed to fetch thinking content:", error);
          // Keep default content on error
        }
      };

      fetchThinkingContent();
    }
  }, [effectiveIsStreaming, sessionState?.session_type.type]);

  // Debug: Log streaming state changes
  useEffect(() => {
    if (sessionState?.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      // Only log when state actually changes, not on every render
      if (effectiveIsStreaming) {
      }
    }
  }, [
    effectiveIsStreaming,
    sessionState?.session_type.type,
    sessionState?.current_claude_session_id,
  ]);

  return {
    effectiveIsStreaming,
    thinkingContent,
    isStreaming,
    setIsStreaming,
    nativeSessionHook, // Hook data from thinking events (for native sessions)
  };
};