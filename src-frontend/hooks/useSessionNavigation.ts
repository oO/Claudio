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


  // Navigation function that takes the stable message number (001, 022, etc.) that users see
  // This handles filtering by finding the message in the filtered array
  const navigateToMessage = useCallback((messageNumber: number) => {
    if (!messagesRef.current) {
      logger.warn("Cannot navigate: messagesRef not available");
      return;
    }

    logger.log("🧭 Navigating to message number:", messageNumber);
    
    // Use the new scrollToMessage method that handles filtering
    messagesRef.current.scrollToMessage(messageNumber);
    
    // Update pinned state - if we're navigating manually, we're not pinned to bottom
    setIsPinnedToBottom(false);
  }, []);

  return {
    messagesRef,
    isPinnedToBottom,
    setIsPinnedToBottom,
    handleScrollToTop,
    handleScrollToBottom,
    isStreaming,
    setIsStreaming,
    navigateToMessage,
  };
};