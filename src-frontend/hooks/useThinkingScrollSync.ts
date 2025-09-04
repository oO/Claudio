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
        logger.debug(`🔍 Attempting to force scroll, messagesRef.current:`, messagesRef.current);
        logger.debug(`🔍 Available methods:`, messagesRef.current ? Object.keys(messagesRef.current) : 'ref is null');
        
        if (messagesRef.current?.forceScrollToBottom) {
          messagesRef.current.forceScrollToBottom();
          logger.debug(`📜 Forced scroll to bottom after thinking ${action}`);
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
      logger.debug(`🧠 Thinking ${thinkingStarted ? 'started' : 'stopped'}, but user was not pinned to bottom - preserving scroll position`);
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