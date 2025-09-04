import { useRef, useCallback, useState } from "react";
import type { SessionMessagesHandle } from "@/components/sessions/SessionMessages";

/**
 * Hook for managing session navigation and scrolling behavior
 * Handles message list navigation, pinning state, compact mode, and streaming state
 */
export const useSessionNavigation = () => {
  const messagesRef = useRef<SessionMessagesHandle>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Navigation handlers
  const handleScrollToTop = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollToTop();
    }
  }, []);

  const handleScrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollToBottom();
    }
  }, []);

  const toggleCompactMode = useCallback(() => {
    setIsCompactMode((prev) => !prev);
  }, []);

  return {
    messagesRef,
    isPinnedToBottom,
    setIsPinnedToBottom,
    isCompactMode,
    setIsCompactMode,
    toggleCompactMode,
    handleScrollToTop,
    handleScrollToBottom,
    isStreaming,
    setIsStreaming,
  };
};