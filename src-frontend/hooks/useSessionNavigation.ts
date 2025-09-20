import { useRef, useCallback, useState, useMemo } from "react";
import { logger } from "@/lib/logger";
import type { SessionMessagesHandle } from "@/components/sessions/SessionMessages";

/**
 * Hook for managing session navigation and scrolling behavior
 * Handles message list navigation, pinning state, compact mode, and streaming state
 */
export const useSessionNavigation = () => {
  const messagesRef = useRef<SessionMessagesHandle>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
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


  // Navigation function that takes the stable ui_index (001, 022, etc.) that users see
  // This handles filtering by finding the message in the filtered array
  const navigateToMessage = useCallback((ui_index: number) => {
    if (!messagesRef.current) {
      logger.warn("Cannot navigate: messagesRef not available");
      return;
    }

    logger.log("🧭 Navigating to ui_index:", ui_index);

    // Use the scrollToMessage method that handles filtering
    messagesRef.current.scrollToMessage(ui_index);
    
    // Update pinned state - if we're navigating manually, we're not pinned to bottom
    setIsPinnedToBottom(false);
  }, []);

  return useMemo(() => ({
    messagesRef,
    isPinnedToBottom,
    setIsPinnedToBottom,
    handleScrollToTop,
    handleScrollToBottom,
    isStreaming,
    setIsStreaming,
    navigateToMessage,
  }), [
    isPinnedToBottom,
    handleScrollToTop,
    handleScrollToBottom,
    isStreaming,
    setIsStreaming,
    navigateToMessage,
  ]);
};