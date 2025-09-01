import React, { forwardRef, useImperativeHandle, useRef, useEffect, useMemo } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessageRouter } from '../messages';
import { DebugLabel } from '@/components/ui/atoms';
import { StreamDataProvider } from '@/contexts/StreamDataContext';
import { LinkNotificationProvider } from '@/contexts/LinkNotificationContext';
import { logger } from '@/lib/logger';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

export interface VirtuosoChatMessagesHandle {
  scrollToBottom: () => void;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
}

interface VirtuosoChatMessagesProps {
  displayableMessages: ClaudeStreamMessage[];
  messages: any[];
  isLoading?: boolean;
  error?: string | null;
  onLinkDetected?: (link: string) => void;
  onPinnedStateChange?: (isPinned: boolean) => void;
}

export const VirtuosoChatMessages = forwardRef<VirtuosoChatMessagesHandle, VirtuosoChatMessagesProps>(({
  displayableMessages,
  messages,
  isLoading = false,
  error = null,
  onLinkDetected,
  onPinnedStateChange,
}, ref) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // Memoize the initial index to prevent React reconciliation issues
  const initialTopMostItemIndex = useMemo(() => {
    return Math.max(0, displayableMessages.length - 1);
  }, [displayableMessages.length]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      virtuosoRef.current?.scrollToIndex({ index: displayableMessages.length - 1, align: 'end' });
    },
    scrollToIndex: (index: number) => {
      virtuosoRef.current?.scrollToIndex({ index, align: 'end' });
    },
    scrollToTop: () => {
      virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
    }
  }));

  // Log for debugging
  logger.info('🎯 VirtuosoChatMessages props:', { 
    messageCount: displayableMessages.length,
    initialIndex: Math.max(0, displayableMessages.length - 1)
  });

  logger.info('🎯 VirtuosoChatMessages rendering with messages:', displayableMessages.length);

  return (
    <StreamDataProvider streamMessages={messages}>
      <LinkNotificationProvider onLinkDetected={onLinkDetected || (() => {})}>
        <DebugLabel label="VirtuosoChatMessages" />
        <div className="relative flex-1 overflow-hidden">
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              totalCount={displayableMessages.length}
              data={displayableMessages}
              initialTopMostItemIndex={Math.max(0, displayableMessages.length - 1)}
              alignToBottom
              itemContent={(index, message) => {
                // Number the message based on its actual UI position (index + 1)
                const numberedMessage = {
                  ...message,
                  messageNumber: index + 1
                };
                
                return (
                  <div className="px-4 pb-4">
                    <MessageRouter 
                      message={numberedMessage} 
                      streamMessages={displayableMessages}
                      messageIndex={index}
                    />
                  </div>
                );
              }}
              followOutput={true}
              overscan={20}
            />
            

            {/* Error indicator */}
            {error && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg">
                  Error: {error}
                </div>
              </div>
            )}
        </div>
      </LinkNotificationProvider>
    </StreamDataProvider>
  );
});

VirtuosoChatMessages.displayName = 'VirtuosoChatMessages';