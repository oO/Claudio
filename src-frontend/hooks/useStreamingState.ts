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
}

export const useStreamingState = (
  sessionState: SessionState | null,
  isSessionThinking: (sessionId: string) => boolean,
  queryInitialSessionState?: (sessionId: string) => Promise<void>
): UseStreamingStateReturn => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  // State for random thinking content
  const [thinkingContent, setThinkingContent] = useState({
    title: "Claude is thinking...",
    message: "Code flows like water — Through circuits of thought and dream — Beauty takes its form",
  });

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
        logger.info(`🔍 Querying initial state for native session: ${claudeSessionId?.substring(0, 8)}`);
        queryInitialSessionState(claudeSessionId);
      } else if (
        sessionState?.session_type.type === SESSION_TYPES.CLAUDIO &&
        (sessionState.session_type.data as any)?.claudio_id
      ) {
        const claudiaId = (sessionState.session_type.data as any)?.claudio_id;
        logger.info(`🔍 Querying initial state for Claudio session: ${claudiaId?.substring(0, 8)}`);
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
          logger.debug("🧠 Fetched random thinking content:", {
            title,
            message,
          });
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
        logger.log(
          "🧠 Native session THINKING:",
          claudeSessionId?.substring(0, 8),
        );
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
  };
};