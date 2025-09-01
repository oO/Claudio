import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessageRouter } from '../messages';
import { StreamDataProvider } from '@/contexts/StreamDataContext';
import { LinkNotificationProvider } from '@/contexts/LinkNotificationContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { DebugLabel } from '@/components/ui/atoms';
import { logger } from '@/lib/logger';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

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
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const previousMessageCountRef = useRef(displayableMessages.length);

  // Expose scroll methods via ref
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (displayableMessages.length > 0) {
        virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
        setIsPinnedToBottom(false);
      }
    },
    scrollToBottom: () => {
      if (displayableMessages.length > 0) {
        virtuosoRef.current?.scrollToIndex({ index: displayableMessages.length - 1, align: 'end' });
        setIsPinnedToBottom(true);
      }
    }
  }), [displayableMessages.length]);

  // Report the actual displayed count and tokens to parent
  useEffect(() => {
    const totalDisplayableCount = displayableMessages.length;
    
    const messageNumbers = displayableMessages.map(msg => msg.messageNumber).filter(Boolean);
    const firstMsgNum = messageNumbers[0];
    const lastMsgNum = messageNumbers[messageNumbers.length - 1];
    
    // Report the count we're supposed to display
    onDisplayedCountChange?.(totalDisplayableCount);
    
    // Calculate tokens from displayed messages
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
  }, [displayableMessages, onDisplayedCountChange, onTokenCountChange]);

  // Handle scroll state changes
  const handleAtBottomChange = (atBottom: boolean) => {
    setIsPinnedToBottom(atBottom);
    onPinnedStateChange?.(atBottom);
  };

  // Auto-scroll to bottom when new messages arrive (if pinned)
  useEffect(() => {
    const hasNewMessages = displayableMessages.length > previousMessageCountRef.current;
    const hasStatusMessage = displayableMessages.some(m => (m as any).type === "status");
    
    // Allow auto-scroll if not loading OR if we have a status message (even while loading)
    if (hasNewMessages && isPinnedToBottom && (!isLoading || hasStatusMessage)) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: displayableMessages.length - 1, align: 'end' });
      }, 100); // Small delay to ensure content is rendered
    }
    
    previousMessageCountRef.current = displayableMessages.length;
  }, [displayableMessages.length, isPinnedToBottom, isLoading]);

  return (
    <StreamDataProvider streamMessages={messages}>
      <SessionProvider 
        projectId={projectId}
        sessionId={sessionId}
        sessionFilePath={sessionFilePath}
      >
        <LinkNotificationProvider onLinkDetected={onLinkDetected || (() => {})}>
          <DebugLabel label="SessionMessages" />
          <div className="relative flex-1 overflow-hidden">
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              totalCount={displayableMessages.length}
              data={displayableMessages}
              alignToBottom
              followOutput="smooth"
              overscan={20}
              atBottomStateChange={handleAtBottomChange}
              itemContent={(index, message) => {
                return (
                  <motion.div
                    key={`message-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="px-4 pb-4 max-w-5xl mx-auto"
                  >
                    <MessageRouter 
                      message={message} 
                      streamMessages={messages}
                      messageIndex={index}
                    />
                  </motion.div>
                );
              }}
            />
            
            {/* Loading indicator under the latest message - only show if no status message present */}
            {isLoading && !displayableMessages.some(m => (m as any).type === "status") && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none"
              >
                <div className="flex items-center justify-center py-4">
                  <div className="rotating-symbol text-primary" />
                </div>
              </motion.div>
            )}

            {/* Error indicator */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none"
              >
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg">
                  Error: {error}
                </div>
              </motion.div>
            )}
          </div>
        </LinkNotificationProvider>
      </SessionProvider>
    </StreamDataProvider>
  );
});

SessionMessages.displayName = 'SessionMessages';