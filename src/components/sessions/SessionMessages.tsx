import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { StreamMessage } from './StreamMessage';
import { DebugLabel } from '@/components/ui/atoms';
import type { ClaudeStreamMessage } from '@/components/agents';

interface SessionMessagesProps {
  displayableMessages: ClaudeStreamMessage[];
  messages: ClaudeStreamMessage[];
  isLoading: boolean;
  error: string | null;
  onLinkDetected?: (url: string) => void;
}

export const SessionMessages: React.FC<SessionMessagesProps> = ({
  displayableMessages,
  messages,
  isLoading,
  error,
  onLinkDetected,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: displayableMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Estimate, will be dynamically measured
    overscan: 5,
  });

  return (
    <>
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
                <StreamMessage 
                  message={message} 
                  streamMessages={messages}
                  onLinkDetected={onLinkDetected}
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
    </>
  );
};

export default SessionMessages;