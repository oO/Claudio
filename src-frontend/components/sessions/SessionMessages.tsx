import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageRouter } from '../messages';
import { SessionProvider } from '@/contexts/SessionContext';
import { StreamDataProvider } from '@/contexts/StreamDataContext';
import { LinkNotificationProvider } from '@/contexts/LinkNotificationContext';
import { DebugLabel } from '@/components/ui/atoms';
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
    estimateSize: () => 150, // Estimate, will be dynamically measured
    overscan: 5,
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
      console.log('Scrolling virtualizer to top (index 0)');
      if (displayableMessages.length > 0) {
        rowVirtualizer.scrollToIndex(0, { align: 'start' });
        setIsPinnedToBottom(false);
      }
    },
    scrollToBottom: () => {
      console.log('Scrolling virtualizer to bottom (index', displayableMessages.length - 1, ')');
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
    
    console.log(`SessionMessages DEBUG:
      - displayableMessages.length: ${totalDisplayableCount}
      - virtual items rendered: ${actualRenderedCount}
      - virtual items range: ${virtualItems.length > 0 ? `${virtualItems[0].index}-${virtualItems[virtualItems.length - 1].index}` : 'none'}
      - rowVirtualizer.count: ${rowVirtualizer.options.count}
      - message numbers: ${firstMsgNum} to ${lastMsgNum} (${messageNumbers.length} total)`);
    
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
    
    if (hasNewMessages && isPinnedToBottom && !isLoading) {
      console.log(`Auto-scrolling to new message: ${displayableMessages.length}`);
      setTimeout(() => {
        rowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: 'end' });
      }, 100); // Small delay to ensure content is rendered
    }
    
    previousMessageCountRef.current = displayableMessages.length;
  }, [displayableMessages.length, isPinnedToBottom, isLoading, rowVirtualizer]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (displayableMessages.length > 0) {
      setTimeout(() => {
        rowVirtualizer.scrollToIndex(displayableMessages.length - 1, { align: 'end' });
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
    <SessionProvider 
      projectId={projectId} 
      sessionId={sessionId} 
      sessionFilePath={sessionFilePath}
    >
      <StreamDataProvider streamMessages={messages}>
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
                      sessionFilePath={sessionFilePath}
                      projectId={projectId}
                      sessionId={sessionId}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Loading indicator under the latest message */}
          {isLoading && (
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
      </StreamDataProvider>
    </SessionProvider>
  );
});

SessionMessages.displayName = 'SessionMessages';

export default SessionMessages;