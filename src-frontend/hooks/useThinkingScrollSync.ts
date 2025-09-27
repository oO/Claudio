import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

interface UseThinkingScrollSyncOptions {
  isThinking: boolean;
  isPinnedToBottom: boolean;
  messagesRef: React.RefObject<any>;
  messageCount: number;
}

/**
 * Hook to sync scroll position when thinking indicator appears/disappears
 * 
 * Problem: When ThinkingIndicator appears, it shifts layout but Virtuoso doesn't know.
 * The user might be pinned to bottom, but when ThinkingIndicator renders, it pushes
 * the message container up, making new messages appear below the viewport.
 * 
 * Solution: Detect thinking state changes and force Virtuoso to scroll if user was at bottom.
 * This bridges the gap between Virtuoso's internal scrolling and the external layout changes.
 */
export const useThinkingScrollSync = ({
  isThinking,
  isPinnedToBottom,
  messagesRef,
  messageCount,
}: UseThinkingScrollSyncOptions) => {
  const wasThinkingRef = useRef(isThinking);
  const wasPinnedRef = useRef(isPinnedToBottom);

  useEffect(() => {
    const wasThinking = wasThinkingRef.current;
    const wasPinned = wasPinnedRef.current;

    // Detect thinking state transitions
    const thinkingStarted = !wasThinking && isThinking;
    const thinkingStopped = wasThinking && !isThinking;
    
    // Only auto-scroll if user was near bottom before the transition
    const shouldAutoScroll = wasPinned && (thinkingStarted || thinkingStopped);

    if (shouldAutoScroll && messagesRef.current?.forceScrollToBottom) {
      const action = thinkingStarted ? 'started' : 'stopped';
      logger.info(`🧠 Thinking ${action}, user was pinned to bottom, force scrolling to maintain position`);
      
      // Delay ensures DOM has updated with ThinkingIndicator changes
      // 150ms gives enough time for animations and layout shifts
      setTimeout(() => {
        // Removed debug logging - internal scroll mechanics are not user-relevant
        
        if (messagesRef.current?.forceScrollToBottom) {
          messagesRef.current.forceScrollToBottom();
          // Scroll completed successfully
        } else {
          logger.error(`❌ forceScrollToBottom method not found on messagesRef.current`);
          // Fallback to regular scrollToBottom if it exists
          if (messagesRef.current?.scrollToBottom) {
            logger.info(`🔄 Falling back to regular scrollToBottom`);
            messagesRef.current.scrollToBottom();
          }
        }
      }, 150);
    } else if ((thinkingStarted || thinkingStopped) && !wasPinned) {
      // Thinking state changed but preserving user's scroll position
    }

    // Update refs for next comparison
    wasThinkingRef.current = isThinking;
    wasPinnedRef.current = isPinnedToBottom;
  }, [isThinking, isPinnedToBottom, messagesRef, messageCount]);

  // Also handle the case where component mounts with thinking already active
  useEffect(() => {
    // If we mount with thinking active and we're pinned, ensure we're at bottom
    if (isThinking && isPinnedToBottom && messagesRef.current?.forceScrollToBottom) {
      logger.info('🧠 Mounted with thinking active and pinned, ensuring scroll position');
      setTimeout(() => {
        messagesRef.current?.forceScrollToBottom();
      }, 100);
    }
  }, []); // Only run on mount
};