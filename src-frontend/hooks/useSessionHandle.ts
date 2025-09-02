import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";
import {
  SessionHandleManager,
  SessionHandle,
  SessionState,
  ClaudeProcessEvent,
  SESSION_TYPES,
} from "@/lib/sessionHandleApi";
import type { Session } from "@/lib/api";
import type { ClaudeStreamMessage } from "@/lib/outputCache";

/**
 * Hook for managing session handle lifecycle and operations
 * Handles session initialization, cleanup, message streaming, and prompt submission
 */
export const useSessionHandle = (
  session: Session,
  projectPath: string,
  setIsStreaming: (streaming: boolean) => void
) => {
  // Simple state - just what we need for the UI
  const [sessionHandle, setSessionHandle] = useState<SessionHandle | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs for cleanup and navigation
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use useMemo to create stable session ID to prevent unnecessary re-initializations
  const sessionId = useMemo(() => {
    return session ? (session as any)?.claudio?.claudio_id || session.id : null;
  }, [session?.id, (session as any)?.claudio?.claudio_id]);

  // Session initialization effect
  useEffect(() => {
    // Skip re-initialization if we already have the same session initialized
    if (sessionHandle && sessionState && sessionId === sessionState.handle_id) {
      logger.info(
        "🔄 Skipping re-initialization - same session already loaded:",
        sessionId,
      );
      return;
    }

    const initializeHandle = async () => {
      try {
        setError(null);
        setLoading(true);

        if (sessionId) {
          logger.info("🔗 Resuming existing session:", {
            sessionId,
            projectPath,
          });
        } else {
          logger.info("🆕 Creating new session:", {
            sessionId: "null",
            projectPath,
          });
        }

        logger.info("🔗 Initializing session handle:", {
          sessionId,
          projectPath,
        });

        // Get session handle from manager
        logger.info("📞 Calling SessionHandleManager.getHandle...");
        const handle = await SessionHandleManager.getHandle(sessionId, projectPath);
        logger.info("✅ Got session handle from manager");

        // Get initial state
        logger.info("📞 Getting initial state from handle...");
        const state = await handle.getState();
        logger.info("✅ Got initial state:", state);

        // For new sessions (no current Claude session), skip loading messages entirely
        // They don't exist yet and we should show empty UI immediately
        let initialMessages: any[] = [];
        if (state.current_claude_session_id) {
          // Only load messages for existing sessions that have Claude sessions
          try {
            logger.info("📞 Loading messages for existing session...");
            initialMessages = await handle.getMessages();
            logger.info(
              "📥 Loaded existing messages for resumed session:",
              initialMessages.length,
            );
          } catch (err) {
            logger.error("❌ Failed to load messages for existing session:", err);
            initialMessages = [];
          }
        } else {
          logger.info("🆕 New session - no messages to load, showing empty UI");
        }

        logger.info("🔄 Setting session handle and state...");

        // Batch state updates to prevent multiple re-renders
        setSessionHandle(handle);
        setSessionState(state);
        setMessages(initialMessages);
        setLoading(false);

        logger.info("✅ Session handle initialized:", {
          handleId: state.handle_id,
          messageCount: state.message_count,
          sessionType: state.session_type.type,
        });

        // Setup real-time message listener for live streaming
        try {
          logger.info("🔗 Setting up message listener for handle:", state.handle_id);
          const unsubscribe = handle.onMessagesUpdate((allMessages: any[]) => {
            logger.info("📨 SessionDetail received message list update:", {
              handleId: state.handle_id,
              totalMessages: allMessages.length,
              receivedAt: new Date().toISOString(),
            });

            // Simple message replacement - just use the real messages from backend
            logger.info(
              "📝 Setting complete message list, new count:",
              allMessages.length,
            );
            setMessages((prev) => {
              // Remove fake user messages that have been replaced by real ones
              const realUserMessages = allMessages.filter((msg) => msg.type === "user");
              const onlyFakeUserMessages = prev.filter((msg) => {
                const isFake = (msg as any).isFake;
                if (!isFake) return false; // Remove all non-fake messages - they'll be replaced by allMessages

                // For fake user messages, remove if we now have a real user message with same content
                if (msg.type === "user") {
                  const fakeText = msg.message?.content?.[0]?.text;
                  const hasRealMatch = realUserMessages.some(
                    (realMsg) => realMsg.message?.content?.[0]?.text === fakeText,
                  );
                  return !hasRealMatch; // Remove if we have a real match
                }

                return false; // Don't keep other fake messages - status messages handled by render-time component
              });

              // Simple combine - fake user messages that don't have real replacements + all real messages
              const combined = [...onlyFakeUserMessages, ...allMessages].sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
              );

              return combined;
            });

            // Check if the last message is an assistant message to stop streaming
            if (allMessages.length > 0) {
              const lastMessage = allMessages[allMessages.length - 1];
              if (lastMessage?.type === "assistant") {
                logger.info(
                  "🛑 Setting isStreaming to false (assistant message in update)",
                );
                setIsStreaming(false);
              }
            }
          });

          messageUnsubscribeRef.current = unsubscribe;
          logger.info("✅ Message listener setup complete for handle:", state.handle_id);

          // Setup process event listener for thinking messages
          try {
            logger.info("🔗 Setting up process event listener for handle:", state.handle_id);
            const processUnsubscribe = handle.onProcessEvent(
              (processEvent: ClaudeProcessEvent) => {
                logger.info("📻 SessionDetail received process event:", {
                  handleId: state.handle_id,
                  status: processEvent.status.type,
                  title: processEvent.title,
                  message: processEvent.message,
                  timestamp: new Date().toISOString(),
                });

                // Note: We handle 'Starting' status immediately in handlePromptSubmit for snappy UX
                // Only handle completion/failure events from backend
                if (
                  processEvent.status.type === "Completed" ||
                  processEvent.status.type === "Failed"
                ) {
                  logger.info(
                    "✅ Process completed/failed - thinking message handled by render state",
                  );
                  // Note: don't set isStreaming to false here - let message updates handle that
                }
              },
            );

            // Store the unsubscribe function (we'll need to modify cleanup later)
            logger.info(
              "✅ Process event listener setup complete for handle:",
              state.handle_id,
            );
          } catch (err) {
            logger.error("❌ Failed to setup process event listener:", err);
          }
        } catch (err) {
          logger.error("❌ Failed to setup message listener:", err);
        }
      } catch (err) {
        logger.error("Failed to initialize session handle:", {
          error: err,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorType: typeof err,
          sessionId: sessionId ?? "unknown",
          projectPath,
        });
        setError(
          err instanceof Error
            ? err.message
            : `Failed to initialize session: ${String(err)}`,
        );
        setLoading(false);
      }
    };

    initializeHandle();

    return () => {
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
    };
  }, [sessionId, projectPath, setIsStreaming]);

  // Simple cleanup - make SessionHandleManager.destroyHandle idempotent instead of trying to detect StrictMode
  useEffect(() => {
    return () => {
      if (sessionHandle && sessionState) {
        logger.info(
          "🗑️ Component unmounting - requesting handle cleanup:",
          sessionState.handle_id,
        );
        // Let the SessionHandleManager decide if it should actually destroy or keep the handle
        SessionHandleManager.destroyHandle(sessionState.handle_id, projectPath);
      }
    };
  }, [sessionHandle, sessionState, projectPath]);

  // Handle prompt submission
  const handlePromptSubmit = useCallback(
    async (prompt: string, model: "sonnet" | "opus") => {
      if (!sessionHandle) {
        logger.error("Cannot send prompt: no session handle available");
        return;
      }

      try {
        setIsStreaming(true);
        setError(null);

        logger.info("🚀 Sending prompt to session handle:", {
          prompt: prompt.substring(0, 50),
        });

        // Immediately add fake user message for instant feedback
        const fakeUserMessage = {
          type: "user",
          uuid: `fake-user-${Date.now()}`,
          message: {
            content: [{ type: "text", text: prompt }],
          },
          timestamp: new Date().toISOString(),
          isFake: true, // Mark as fake so we can remove it later
        } as ClaudeStreamMessage & { isFake: boolean };

        setMessages((prev) => [...prev, fakeUserMessage as any]);

        // Send prompt to backend - all messages (including user message) come via streaming
        await sessionHandle.sendPrompt(prompt);
      } catch (err) {
        logger.error("Failed to send prompt:", err);
        setError(err instanceof Error ? err.message : "Failed to send prompt");
        setIsStreaming(false);
      }
    },
    [sessionHandle, setIsStreaming],
  );

  // Computed properties
  const isReadOnly = sessionState?.session_type.type === SESSION_TYPES.NATIVE;

  return {
    sessionHandle,
    sessionState,
    messages,
    setMessages,
    error,
    loading,
    handlePromptSubmit,
    isReadOnly,
  };
};