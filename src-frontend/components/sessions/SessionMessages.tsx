import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageRouter } from '../messages';
import { StreamDataProvider } from '@/contexts/StreamDataContext';
import { LinkNotificationProvider } from '@/contexts/LinkNotificationContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { DebugLabel } from '@/components/ui/atoms';
import { logger } from '@/lib/logger';
import type { ClaudeStreamMessage } from '@/components/agents';

interface SessionMessagesProps {
  displayableMessages: ClaudeStreamMessage[];
  messages: ClaudeStreamMessage[];
  isLoading: boolean;
  error: string | null;
  onLinkDetected?: (url: string) => void;
  onDisplayedCountChange?: (count: number) => void;
  onTokenCountChange?: (tokens: number) => void;
  onPinnedStateChange?: (isPinned: boolean) => void;
  sessionFilePath?: string;
  projectId?: string;
  sessionId?: string;
}

export interface SessionMessagesRef {
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export const SessionMessages = forwardRef<SessionMessagesRef, SessionMessagesProps>(({
  displayableMessages,
  messages,
  isLoading,
  error,
  onLinkDetected,
  onDisplayedCountChange,
  onTokenCountChange,
  onPinnedStateChange,
  sessionFilePath,
  projectId,
  sessionId,
}, ref) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const previousMessageCountRef = useRef(displayableMessages.length);

  const rowVirtualizer = useVirtualizer({
    count: displayableMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Better estimate for typical message height
    overscan: 20, // Increased from 5 to 20 to reduce gaps during scroll jumps
  });

  // Track scroll position to detect if user is pinned to bottom
  const handleScroll = () => {
    const element = parentRef.current;
    if (!element) return;
    
    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isAtBottom = distanceFromBottom < 50; // 50px threshold
    
    setIsPinnedToBottom(isAtBottom);
    onPinnedStateChange?.(isAtBottom);
  };

  // Expose scroll methods via ref
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (displayableMessages.length > 0) {
        rowVirtualizer.scrollToIndex(0, { align: 'start' });
        setIsPinnedToBottom(false);
      }
    },
    scrollToBottom: () => {
      if (displayableMessages.length > 0) {
        rowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: 'end' });
        setIsPinnedToBottom(true);
      }
    }
  }), [rowVirtualizer, displayableMessages.length]);

  // Report the actual displayed count and tokens to parent
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    const actualRenderedCount = virtualItems.length;
    const totalDisplayableCount = displayableMessages.length;
    
    const messageNumbers = displayableMessages.map(msg => msg.messageNumber).filter(Boolean);
    const firstMsgNum = messageNumbers[0];
    const lastMsgNum = messageNumbers[messageNumbers.length - 1];
    
    // Report the count we're supposed to display (not what's currently rendered)
    onDisplayedCountChange?.(totalDisplayableCount);
    
    // Calculate tokens from actually displayed messages
    const tokens = displayableMessages.reduce((total, msg) => {
      if (msg.message?.usage) {
        return total + msg.message.usage.input_tokens + msg.message.usage.output_tokens;
      }
      if (msg.usage) {
        return total + msg.usage.input_tokens + msg.usage.output_tokens;
      }
      return total;
    }, 0);
    
    onTokenCountChange?.(tokens);
  }, [displayableMessages, rowVirtualizer, onDisplayedCountChange, onTokenCountChange]);

  // Auto-scroll to bottom when new messages arrive (if pinned)
  useEffect(() => {
    const hasNewMessages = displayableMessages.length > previousMessageCountRef.current;
    const hasStatusMessage = displayableMessages.some(m => (m as any).type === "status");
    
    // Allow auto-scroll if not loading OR if we have a status message (even while loading)
    if (hasNewMessages && isPinnedToBottom && (!isLoading || hasStatusMessage)) {
      setTimeout(() => {
        rowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: 'end' });
      }, 100); // Small delay to ensure content is rendered
    }
    
    previousMessageCountRef.current = displayableMessages.length;
  }, [displayableMessages.length, isPinnedToBottom, isLoading, rowVirtualizer]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (displayableMessages.length > 0) {
      // Try scrolling to element manually instead of using scrollToIndex
      setTimeout(() => {
        const element = parentRef.current;
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      }, 100);
    }
  }, [displayableMessages.length > 0 ? displayableMessages.length : 0]);

  // Set up scroll listener
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <StreamDataProvider streamMessages={messages}>
      <SessionProvider 
        projectId={projectId}
        sessionId={sessionId}
        sessionFilePath={sessionFilePath}
      >
        <LinkNotificationProvider onLinkDetected={onLinkDetected || (() => {})}>
          <DebugLabel label="SessionMessages" />
        <div
          ref={parentRef}
          className="relative flex-1 overflow-y-auto pb-40"
          style={{
            contain: 'strict',
          }}
        >
          <div
            className="relative w-full max-w-5xl mx-auto px-4 pt-8 pb-4"
            style={{
              height: `${Math.max(rowVirtualizer.getTotalSize(), 100)}px`,
              minHeight: '100px',
            }}
          >
            <AnimatePresence>
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const message = displayableMessages[virtualItem.index];
                return (
                  <motion.div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={(el) => el && rowVirtualizer.measureElement(el)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-x-4 pb-4"
                    style={{
                      top: virtualItem.start,
                    }}
                  >
                    <MessageRouter 
                      message={message} 
                      streamMessages={messages}
                      messageIndex={virtualItem.index}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Loading indicator under the latest message - only show if no status message present */}
          {isLoading && !displayableMessages.some(m => (m as any).type === "status") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-4 mb-40"
            >
              <div className="rotating-symbol text-primary" />
            </motion.div>
          )}

          {/* Error indicator */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive mb-40 w-full max-w-5xl mx-auto"
            >
              {error}
            </motion.div>
          )}
        </div>
        </LinkNotificationProvider>
      </SessionProvider>
      </StreamDataProvider>
  );
});

SessionMessages.displayName = 'SessionMessages';

export default SessionMessages;