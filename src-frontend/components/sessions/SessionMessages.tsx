import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
} from "lucide-react";
import { MessageRouter } from "../messages";
import { DebugLabel } from "@/components/ui/atoms";
import { Button } from "@/components/ui/button";
import { StreamDataProvider } from "@/contexts/StreamDataContext";
import { LinkNotificationProvider } from "@/contexts/LinkNotificationContext";
import { useSessionContext } from "@/contexts/SessionContext";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from "@/lib/outputCache";

export interface SessionMessagesHandle {
  scrollToBottom: () => void;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
  forceScrollToBottom: () => void;
  scrollToPreviousUserMessage: () => void;
  scrollToNextUserMessage: () => void;
  scrollToMessage: (ui_index: number) => void;
}

interface SessionMessagesProps {
  displayableMessages: ClaudeStreamMessage[];
  messages: any[];
  isLoading?: boolean;
  error?: string | null;
  onLinkDetected?: (link: string) => void;
  onPinnedStateChange?: (isPinned: boolean) => void;
  showNavigation?: boolean;
}

export const SessionMessages = forwardRef<
  SessionMessagesHandle,
  SessionMessagesProps
>(
  (
    {
      displayableMessages,
      messages,
      isLoading = false,
      error = null,
      onLinkDetected,
      onPinnedStateChange,
      showNavigation = false,
    },
    ref,
  ) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Get filter states from context
    const {
      toolMessages = [],
      isToolsVisible = true,
      systemMessages = [],
      isSystemVisible = false,
      assistantMessages = [],
      isAssistantFilterLast = false,
      userMessages = []
    } = useSessionContext();

    // Filter displayable messages based on tool, system, and assistant visibility
    const filteredMessages = useMemo(() => {
      let filtered = displayableMessages;

      // Apply tool filtering
      if (!isToolsVisible) {
        // Hide tool messages - filter out messages that contain tools
        const toolMessageIndices = new Set(toolMessages.map(tool => tool.index));
        filtered = filtered.filter((_, index) => !toolMessageIndices.has(index));
      }

      // Apply system message filtering
      if (!isSystemVisible) {
        // Hide system messages AND summary messages
        filtered = filtered.filter(message => {
          // Filter out system type messages
          if (message.type === "system") return false;
          // Also filter out summary messages (Context Summary)
          if (message.summary) return false;
          return true;
        });
      }

      // Apply assistant filtering
      if (isAssistantFilterLast) {
        const lastAssistantMessages = assistantMessages
          .filter(a => a.isLastInTurn || a.isSubAgentTask)
          .filter(a => !a.isSubAgentResponse); // Hide ALL subagent responses
        
        filtered = filtered.filter((message, filteredIndex) => {
          if (message.type !== "assistant") {
            return true;
          }
          
          // Find this message in the original displayableMessages array
          const originalIndex = displayableMessages.findIndex(msg => msg === message);
          const shouldKeep = lastAssistantMessages.some(a => a.index === originalIndex);
          
          return shouldKeep;
        });
      }

      return filtered;
    }, [displayableMessages, toolMessages, isToolsVisible, systemMessages, isSystemVisible, assistantMessages, isAssistantFilterLast]);


    // Navigation state
    const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
    const [showScrollControls, setShowScrollControls] = useState(false);
    const [currentVisibleUiIndex, setCurrentVisibleUiIndex] = useState<number>(() => {
      // When starting pinned to bottom, we're at the last displayable message
      return displayableMessages.length > 0 ? displayableMessages.length : 1;
    });
    const [isAtTop, setIsAtTop] = useState(false);

    // Memoize the initial index to prevent React reconciliation issues
    const initialTopMostItemIndex = useMemo(() => {
      return Math.max(0, filteredMessages.length - 1);
    }, [filteredMessages.length]);



    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        virtuosoRef.current?.scrollToIndex({
          index: displayableMessages.length - 1,
          align: "end",
        });
        setIsPinnedToBottom(true);
      },
      scrollToIndex: (index: number) => {
        virtuosoRef.current?.scrollToIndex({ index, align: "center" });
        setIsPinnedToBottom(false);
      },
      scrollToTop: () => {
        virtuosoRef.current?.scrollToIndex({ index: 0, align: "start" });
        setIsPinnedToBottom(false);
      },
      forceScrollToBottom: () => {
        // Force scroll to bottom with smooth behavior, regardless of current position
        // This is used when layout changes (thinking indicator appears/disappears)
        virtuosoRef.current?.scrollToIndex({
          index: displayableMessages.length - 1,
          align: "end",
          behavior: "smooth",
        });
        setIsPinnedToBottom(true);
      },
      scrollToPreviousUserMessage: () => {
        if (userMessages.length === 0) return;

        // Find previous user message before current visible ui_index
        const prevUserMsg = userMessages
          .filter(msg => msg.ui_index < currentVisibleUiIndex)
          .pop(); // Last one = closest before current

        if (prevUserMsg) {
          // Use our working scrollToMessage function
          const filteredIndex = filteredMessages.findIndex(msg => msg.ui_index === prevUserMsg.ui_index);
          if (filteredIndex !== -1) {
            virtuosoRef.current?.scrollToIndex({
              index: filteredIndex,
              align: "center",
            });
            setCurrentVisibleUiIndex(prevUserMsg.ui_index);
            setIsPinnedToBottom(false);
            logger.log("🔼 Scrolled to previous user message ui_index:", prevUserMsg.ui_index);
          }
        }
      },
      scrollToNextUserMessage: () => {
        if (userMessages.length === 0) return;

        // Find next user message after current visible ui_index
        const nextUserMsg = userMessages
          .find(msg => msg.ui_index > currentVisibleUiIndex);

        if (nextUserMsg) {
          // Use our working scrollToMessage function
          const filteredIndex = filteredMessages.findIndex(msg => msg.ui_index === nextUserMsg.ui_index);
          if (filteredIndex !== -1) {
            virtuosoRef.current?.scrollToIndex({
              index: filteredIndex,
              align: "center",
            });
            setCurrentVisibleUiIndex(nextUserMsg.ui_index);

            // Check if this is the last message to determine pinned state
            const isLastMessage = filteredIndex === filteredMessages.length - 1;
            setIsPinnedToBottom(isLastMessage);
            logger.log("🔽 Scrolled to next user message ui_index:", nextUserMsg.ui_index);
          }
        }
      },
      scrollToMessage: (ui_index: number) => {
        // Find the message with this ui_index in the filtered array
        const filteredIndex = filteredMessages.findIndex(msg => {
          return msg.ui_index === ui_index;
        });

        if (filteredIndex === -1) {
          logger.warn(`Message with ui_index ${ui_index} not found in filtered messages`);
          return;
        }

        logger.log(`🎯 Scrolling to message ui_index ${ui_index} at filtered index ${filteredIndex}`);
        virtuosoRef.current?.scrollToIndex({
          index: filteredIndex,
          align: "center",
        });

        // Update current visible ui_index and pinned state
        setCurrentVisibleUiIndex(ui_index);
        const isLastMessage = filteredIndex === filteredMessages.length - 1;
        setIsPinnedToBottom(isLastMessage);
      },
    }));


    // Update scroll controls visibility based on message count
    useEffect(() => {
      setShowScrollControls(displayableMessages.length > 3);
    }, [displayableMessages.length]);

    // Navigation button handlers
    const scrollToTop = () => {
      virtuosoRef.current?.scrollToIndex({ index: 0, align: "start" });
      setIsPinnedToBottom(false);
      setIsAtTop(true);
    };

    const scrollToBottom = () => {
      virtuosoRef.current?.scrollToIndex({
        index: displayableMessages.length - 1,
        align: "end",
      });
      setIsPinnedToBottom(true);
      setIsAtTop(false);
    };

    const scrollToPrevUser = () => {
      if (userMessages.length === 0) return;

      // Find previous user message before current visible ui_index
      const prevUserMsg = userMessages
        .filter(msg => msg.ui_index < currentVisibleUiIndex)
        .pop(); // Last one = closest before current

      if (prevUserMsg) {
        // Use our working scrollToMessage function
        const filteredIndex = filteredMessages.findIndex(msg => msg.ui_index === prevUserMsg.ui_index);
        if (filteredIndex !== -1) {
          virtuosoRef.current?.scrollToIndex({
            index: filteredIndex,
            align: "center",
          });
          setCurrentVisibleUiIndex(prevUserMsg.ui_index);
          setIsPinnedToBottom(false);
          setIsAtTop(filteredIndex === 0);
          logger.log("🔼 Scrolled to previous user message ui_index:", prevUserMsg.ui_index);
        }
      }
    };

    const scrollToNextUser = () => {
      if (userMessages.length === 0) return;

      // Find next user message after current visible ui_index
      const nextUserMsg = userMessages
        .find(msg => msg.ui_index > currentVisibleUiIndex);

      if (nextUserMsg) {
        // Use our working scrollToMessage function
        const filteredIndex = filteredMessages.findIndex(msg => msg.ui_index === nextUserMsg.ui_index);
        if (filteredIndex !== -1) {
          virtuosoRef.current?.scrollToIndex({
            index: filteredIndex,
            align: "center",
          });
          setCurrentVisibleUiIndex(nextUserMsg.ui_index);

          // Check if this is the last message to determine pinned state
          const isLastMessage = filteredIndex === filteredMessages.length - 1;
          setIsPinnedToBottom(isLastMessage);
          setIsAtTop(false);
          logger.log("🔽 Scrolled to next user message ui_index:", nextUserMsg.ui_index);
        }
      }
    };

    return (
      <StreamDataProvider streamMessages={messages}>
        <LinkNotificationProvider onLinkDetected={onLinkDetected || (() => {})}>
          <DebugLabel label="SessionMessages" />
          <div className="relative flex-1 overflow-hidden cursor-default [&_[tabindex]:not([role])]:cursor-default">
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: "100%" }}
              totalCount={filteredMessages.length}
              data={filteredMessages}
              initialTopMostItemIndex={initialTopMostItemIndex}
              alignToBottom
              rangeChanged={(range) => {
                // Take the middle of the rendered range as most likely to be actually visible
                // Since overscan adds buffer on both sides, the middle should be in viewport
                const middleIndex = Math.floor((range.startIndex + range.endIndex) / 2);

                if (middleIndex < filteredMessages.length) {
                  const middleMessage = filteredMessages[middleIndex];
                  if (middleMessage?.ui_index) {
                    setCurrentVisibleUiIndex(middleMessage.ui_index);
                  }
                }
              }}
              itemContent={(index, message) => {
                // Number the message based on its actual UI position (index + 1)
                // Use original displayable message index for stable numbering
                const originalIndex = displayableMessages.findIndex(msg => msg === message);
                const numberedMessage = {
                  ...message,
                  ui_index: originalIndex + 1,
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
              atBottomStateChange={(atBottom) => {
                setIsPinnedToBottom(atBottom);
                // Notify parent when scroll position changes relative to bottom
                if (onPinnedStateChange) {
                  onPinnedStateChange(atBottom);
                }
              }}
              atTopStateChange={(atTop) => {
                setIsAtTop(atTop);
              }}
              overscan={40}
            />

            {/* Error indicator */}
            {error && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg">
                  Error: {error}
                </div>
              </div>
            )}

            {/* Navigation overlay */}
            <AnimatePresence>
              {showNavigation && showScrollControls && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-4 right-6 flex flex-col shadow-lg backdrop-blur-sm"
                >
                  {/* Jump to first message */}
                  <Button
                    onClick={scrollToTop}
                    size="icon"
                    variant="outline"
                    className={cn(
                      "h-10 w-10 rounded-t-full rounded-b-none border-b-0 bg-card transition-colors",
                      // Disabled only when actually at the top
                      !isAtTop
                        ? "hover:bg-accent"
                        : "opacity-50 cursor-not-allowed",
                    )}
                    disabled={isAtTop}
                    title="Jump to first message"
                  >
                    <ArrowUpToLine className="h-4 w-4" />
                  </Button>

                  {/* Previous user message */}
                  <Button
                    onClick={scrollToPrevUser}
                    size="icon"
                    variant="outline"
                    className={cn(
                      "h-10 w-10 rounded-none border-b-0 bg-card transition-colors",
                      isAtTop
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent",
                    )}
                    disabled={isAtTop}
                    title="Previous user message"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>

                  {/* Next user message */}
                  <Button
                    onClick={scrollToNextUser}
                    size="icon"
                    variant="outline"
                    className={cn(
                      "h-10 w-10 rounded-none border-b-0 bg-card transition-colors",
                      userMessages.length === 0 ||
                        isPinnedToBottom ||
                        !userMessages.find(msg => msg.ui_index > currentVisibleUiIndex)
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent",
                    )}
                    disabled={
                      userMessages.length === 0 ||
                      isPinnedToBottom ||
                      !userMessages.find(msg => msg.ui_index > currentVisibleUiIndex)
                    }
                    title="Next user message"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>

                  {/* Jump to last message (and pin) */}
                  <Button
                    onClick={scrollToBottom}
                    size="icon"
                    variant="outline"
                    className={cn(
                      "h-10 w-10 rounded-b-full rounded-t-none bg-card transition-colors",
                      isPinnedToBottom
                        ? "text-accent cursor-not-allowed"
                        : "text-foreground hover:bg-accent",
                    )}
                    disabled={isPinnedToBottom}
                    title={
                      isPinnedToBottom
                        ? "Following new messages"
                        : "Jump to latest message"
                    }
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </LinkNotificationProvider>
      </StreamDataProvider>
    );
  },
);

SessionMessages.displayName = "SessionMessages";
