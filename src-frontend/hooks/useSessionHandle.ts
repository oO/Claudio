import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { listen } from '@tauri-apps/api/event';
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
 * Event payload when Claude session is ready with new session ID
 */
interface ClaudeSessionReadyEvent {
  type: "session_started";
  session_id: string;    // Claude's native session ID
  claudio_id: string;    // Our Claudio session pointer ID
  project_path: string;
}

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
  const sessionUnlistenRef = useRef<(() => void) | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use useMemo to create stable session ID to prevent unnecessary re-initializations
  const sessionId = useMemo(() => {
    // For Claudio sessions, session.id is already the claudio_id (e.g., "claudio-1234567890")
    // For native sessions, session.id is the native session UUID
    // Backend will determine session type based on ID format
    return session ? session.id : null;
  }, [session?.id]);

  // Session initialization effect
  useEffect(() => {
    // Skip re-initialization if we already have the same session initialized
    if (sessionHandle && sessionState && sessionId === sessionState.handle_id) {
      return;
    }

    const initializeHandle = async () => {
      try {
        setError(null);
        setLoading(true);

        if (sessionId) {
        } else {
        }


        // Get session handle from manager
        const handle = await SessionHandleManager.getHandle(sessionId, projectPath);

        // Get initial state
        const state = await handle.getState();
        logger.info("🔍 useSessionHandle received sessionState:", {
          sessionId: sessionId,
          handleId: state.handle_id,
          sessionType: state.session_type,
          sessionTypeType: state.session_type?.type,
          isClaudiaSession: state.session_type?.type === SESSION_TYPES.CLAUDIO
        });

        // For new sessions (no current Claude session), skip loading messages entirely
        // They don't exist yet and we should show empty UI immediately
        let initialMessages: any[] = [];
        if (state.current_claude_session_id) {
          // Only load messages for existing sessions that have Claude sessions
          try {
            initialMessages = await handle.getMessages();
          } catch (err) {
            logger.error("❌ Failed to load messages for existing session:", err);
            initialMessages = [];
          }
        } else {
        }


        // Batch state updates to prevent multiple re-renders
        setSessionHandle(handle);
        setSessionState(state);
        setMessages(initialMessages);
        setLoading(false);


        // Setup real-time message listener for live streaming
        try {
          const unsubscribe = handle.onMessagesUpdate((allMessages: any[]) => {

            // Simple fake message cleanup: remove all fake messages when real ones arrive
            setMessages((prev) => {
              const fakeMessages = prev.filter((msg) => (msg as any).isFake);

              logger.info("🔄 Processing message update:", {
                totalReal: allMessages.length,
                totalFake: fakeMessages.length,
                action: allMessages.length > 0 ? "removing all fake messages" : "keeping fake messages"
              });

              // If we have real messages coming in, remove ALL fake messages
              if (allMessages.length > 0 && fakeMessages.length > 0) {
                logger.info("🧹 Removing all fake messages - real messages arrived:", {
                  removedFakeCount: fakeMessages.length,
                  fakeUuids: fakeMessages.map(msg => (msg as any).uuid)
                });
                return allMessages; // Just use real messages, discard all fake ones
              }

              // No real messages yet, keep existing messages (including fakes)
              return prev;
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

          // Setup listener for Claude session ready events (new session ID notifications)
          try {
            const sessionReadyUnlisten = await listen<ClaudeSessionReadyEvent>('claude_session_ready', (event) => {
              const { session_id, claudio_id, project_path } = event.payload;
              
              // Only handle events for our specific session and project
              if (claudio_id === sessionId && project_path === projectPath) {
                logger.info("🔄 Claude session ready - updating session state with native session ID:", {
                  claudio_id,
                  session_id,
                  project_path
                });
                
                // Update the session state with the new Claude session ID
                setSessionState(prevState => {
                  if (!prevState) return prevState;
                  return {
                    ...prevState,
                    current_claude_session_id: session_id
                  };
                });
              }
            });
            
            // Store cleanup function
            sessionUnlistenRef.current = sessionReadyUnlisten;
            logger.info("✅ Claude session ready listener setup complete");
          } catch (err) {
            logger.error("❌ Failed to setup Claude session ready listener:", err);
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
      if (sessionUnlistenRef.current) {
        sessionUnlistenRef.current();
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
      try {
        
        if (!sessionHandle) {
          logger.error("❌ Cannot send prompt: no session handle available");
          return;
        }
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
          isFake: true, // Mark as fake - will be removed when real messages arrive
        } as ClaudeStreamMessage & { isFake: boolean };

        logger.info("🎭 Creating fake user message for optimistic UI:", {
          uuid: fakeUserMessage.uuid,
          promptLength: prompt.length
        });

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