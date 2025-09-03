import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";
import { SESSION_TYPES, type SessionState } from "@/lib/sessionHandleApi";

/**
 * Hook for managing streaming state and thinking content
 * Handles native session thinking state and random thinking content
 */
export const useStreamingState = (
  sessionState: SessionState | null,
  isSessionThinking: (sessionId: string) => boolean
) => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  // State for random thinking content
  const [thinkingContent, setThinkingContent] = useState({
    title: "Claude is thinking...",
    message: "Code flows like water — Through circuits of thought and dream — Beauty takes its form",
  });

  // Compute effective streaming state - for native sessions, use thinking state
  const effectiveIsStreaming = useMemo(() => {
    if (sessionState?.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      const isThinking = claudeSessionId ? isSessionThinking(claudeSessionId) : false;
      
      return isThinking;
    }
    return isStreaming;
  }, [
    sessionState?.session_type.type,
    sessionState?.current_claude_session_id,
    isSessionThinking,
    isStreaming,
  ]);

  // Fetch random thinking content when streaming starts
  useEffect(() => {
    if (
      effectiveIsStreaming &&
      sessionState?.session_type.type === SESSION_TYPES.NATIVE
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