import { useRef, useCallback, useState } from "react";
import { logger } from "@/lib/logger";
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

  // Shared navigation function for consistent behavior across all navigation methods
  // Uses the same logic as the prev/next user message buttons for consistent UX
  const navigateToMessage = useCallback((messageIndex: number) => {
    if (!messagesRef.current) {
      logger.warn("Cannot navigate: messagesRef not available");
      return;
    }

    logger.log("🧭 Navigating to message at index:", messageIndex);
    
    // Use the same navigation method as SessionMessages user navigation buttons
    // This calls virtuosoRef.current?.scrollToIndex({ index: messageIndex, align: "center" })
    // which is consistent with scrollToPreviousUserMessage/scrollToNextUserMessage
    messagesRef.current.scrollToIndex(messageIndex);
    
    // Update pinned state - if we're navigating manually, we're not pinned to bottom
    setIsPinnedToBottom(false);
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
    navigateToMessage,
  };
};