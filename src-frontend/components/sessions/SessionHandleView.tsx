import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { DebugLabel } from '@/components/ui/atoms';
import { SessionHandleManager, SessionHandle, SessionState, StreamedMessage } from '@/lib/sessionHandleApi';
import { SessionHeader } from './SessionHeader';
import { SessionMessages } from './SessionMessages';
import { VirtuosoChatMessages } from './VirtuosoChatMessages';
import { PromptInput } from './PromptInput';
import type { Session } from '@/lib/api';
import type { ClaudeStreamMessage } from '@/components/agents';

interface SessionHandleViewProps {
  session: Session;
  projectPath: string;
  onBack: () => void;
  onSessionsDeleted?: () => void;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

/**
 * Simplified session view using the new SessionHandle architecture
 * This replaces the complex ClaudeCodeSession with a clean, handle-based approach
 */
export const SessionHandleView: React.FC<SessionHandleViewProps> = ({
  session,
  projectPath,
  onBack,
  onSessionsDeleted,
  onToast,
}) => {
  // DEBUG: Test if logging works at all
  logger.info('🚀 SessionHandleView mounting with session:', session?.id, 'projectPath:', projectPath);
  
  // Simple state - just what we need for the UI
  const [sessionHandle, setSessionHandle] = useState<SessionHandle | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and navigation
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef<any>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [collapsedMessageUuids, setCollapsedMessageUuids] = useState<string[]>([]);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  // Process messages with UI sugar - REVERSED for better chat UX
  const displayableMessages = useMemo(() => {
    const startTime = performance.now();
    
    const processedMessages: ClaudeStreamMessage[] = [];
    const skipIndexes = new Set<number>();
    const filteredUuids: string[] = [];
    let filteredCount = 0;

    // REVERSED: Process from last to first for better chat UX (show recent messages first)
    for (let index = messages.length - 1; index >= 0; index--) {
      // Skip if already processed as part of a bundle
      if (skipIndexes.has(index)) {
        continue;
      }

      const message = messages[index];

      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        filteredCount++;
        if (message.uuid) filteredUuids.push(message.uuid);
        continue;
      }

      // Skip artificial user messages created by sub-agent system
      // These are internal system artifacts that just repeat task prompts
      if (message.isSidechain && message.type === "user") {
        filteredCount++;
        if (message.uuid) filteredUuids.push(message.uuid);
        continue;
      }

      // Handle command bundling for user messages
      if (message.type === "user" && message.message) {
        if (message.isMeta) {
          filteredCount++;
          if (message.uuid) filteredUuids.push(message.uuid);
          continue;
        }

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          filteredCount++;
          if (message.uuid) filteredUuids.push(message.uuid);
          continue;
        }

        // Check for command pattern in string content
        if (typeof msg.content === "string") {
          const contentStr = msg.content as string;
          const commandMatch = contentStr.match(
            /<command-name>(.+?)<\/command-name>[\s\S]*?<command-message>(.+?)<\/command-message>[\s\S]*?<command-args>(.*?)<\/command-args>/,
          );
          
          if (commandMatch) {
            const [, commandName, commandMessage, commandArgs] = commandMatch;
            
            // Look for the stdout message (when going backwards, it's at index - 1)
            let stdout = "";
            if (index - 1 >= 0) {
              const stdoutMessage = messages[index - 1];
              if (stdoutMessage.type === "user" && typeof stdoutMessage.message?.content === "string") {
                const stdoutContentStr = stdoutMessage.message.content as string;
                const stdoutMatch = stdoutContentStr.match(
                  /<local-command-stdout>(.*?)<\/local-command-stdout>/s
                );
                if (stdoutMatch) {
                  stdout = stdoutMatch[1];
                  skipIndexes.add(index - 1); // Mark stdout message as processed
                  // Add the stdout message UUID to filtered list since it's bundled
                  if (stdoutMessage.uuid) filteredUuids.push(stdoutMessage.uuid);
                }
              }
            }

            // Create bundled command message with all contributing UUIDs
            const contributingUuids = [message.uuid];
            if (index - 1 >= 0 && skipIndexes.has(index - 1)) {
              // Include the stdout message UUID that was bundled
              const stdoutMessage = messages[index - 1];
              if (stdoutMessage.uuid) contributingUuids.push(stdoutMessage.uuid);
            }
            
            const bundledMessage: ClaudeStreamMessage = {
              ...message,
              _bundledCommand: {
                commandName: commandName.trim(),
                commandMessage: commandMessage.trim(),
                commandArgs: commandArgs?.trim(),
                output: stdout
              },
              _contributingMessageUuids: contributingUuids.filter(Boolean)
            };
            
            processedMessages.push(bundledMessage);
            continue;
          }
        }

        // Handle regular user messages with tool results filtering
        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;
          for (const content of msg.content) {
            if (content.type === "text") {
              hasVisibleContent = true;
              break;
            }
            if (content.type === "tool_result") {
              let willBeSkipped = false;
              if (content.tool_use_id) {
                // Look for the matching tool_use in previous assistant messages
                for (let i = index - 1; i >= 0; i--) {
                  const prevMsg = messages[i];
                  if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
                    const toolUse = prevMsg.message.content.find((c: any) => 
                      c.type === 'tool_use' && c.id === content.tool_use_id
                    );
                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();
                      const toolsWithWidgets = [
                        'task', 'edit', 'multiedit', 'todowrite', 'ls', 'read', 
                        'glob', 'bash', 'write', 'grep'
                      ];
                      if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                        willBeSkipped = true;
                      }
                      break;
                    }
                  }
                }
              }
              if (!willBeSkipped) {
                hasVisibleContent = true;
                break;
              }
            }
          }
          if (!hasVisibleContent) {
            filteredCount++;
            if (message.uuid) filteredUuids.push(message.uuid);
            continue;
          }
        }
      }

      // Add message to processed list with contributing UUIDs
      const messageWithUuids = {
        ...message,
        _contributingMessageUuids: message.uuid ? [message.uuid] : []
      };
      processedMessages.push(messageWithUuids);
    }

    // Reverse messages back to chronological order (oldest first, newest last) 
    // and renumber sequentially for display
    const renumberedMessages = processedMessages.reverse().map((msg, index) => ({
      ...msg,
      messageNumber: index + 1 // Sequential numbering starting from 1
    }));

    // Store filtered UUIDs for debugging purposes
    setCollapsedMessageUuids(filteredUuids);
    
    const totalTime = performance.now() - startTime;
    logger.info(`🔄 Processed ${messages.length} raw messages into ${renumberedMessages.length} displayable (${totalTime.toFixed(2)}ms)`);
    
    return renumberedMessages;
  }, [messages]);

  // Determine session type and get handle
  // Use useMemo to create stable session ID to prevent unnecessary re-initializations
  const sessionId = useMemo(() => {
    return session ? ((session as any)?.claudio?.claudio_id || session.id) : null;
  }, [session?.id, (session as any)?.claudio?.claudio_id]);

  useEffect(() => {
    // Skip re-initialization if we already have the same session initialized
    if (sessionHandle && sessionState && sessionId === sessionState.handle_id) {
      logger.info('🔄 Skipping re-initialization - same session already loaded:', sessionId);
      return;
    }

    const initializeHandle = async () => {
      try {
        setError(null);
        
        if (sessionId) {
          logger.info('🔗 Resuming existing session:', { sessionId, projectPath });
        } else {
          logger.info('🆕 Creating new session:', { sessionId: 'null', projectPath });
        }
        
        logger.info('🔗 Initializing session handle:', { sessionId, projectPath });
        
        // Get session handle from manager
        logger.info('📞 Calling SessionHandleManager.getHandle...');
        const handle = await SessionHandleManager.getHandle(sessionId, projectPath);
        logger.info('✅ Got session handle from manager');
        
        // Get initial state 
        logger.info('📞 Getting initial state from handle...');
        const state = await handle.getState();
        logger.info('✅ Got initial state:', state);
        
        // For new sessions (no current Claude session), skip loading messages entirely
        // They don't exist yet and we should show empty UI immediately
        let initialMessages: any[] = [];
        if (state.current_claude_session_id) {
          // Only load messages for existing sessions that have Claude sessions
          try {
            logger.info('📞 Loading messages for existing session...');
            initialMessages = await handle.getMessages();
            logger.info('📥 Loaded existing messages for resumed session:', initialMessages.length);
          } catch (err) {
            logger.error('❌ Failed to load messages for existing session:', err);
            initialMessages = [];
          }
        } else {
          logger.info('🆕 New session - no messages to load, showing empty UI');
        }
        
        logger.info('🔄 Setting session handle and state...');
        
        // Batch state updates to prevent multiple re-renders
        setSessionHandle(handle);
        setSessionState(state);
        setMessages(initialMessages);
        
        logger.info('✅ Session handle initialized:', {
          handleId: state.handle_id,
          messageCount: state.message_count,
          sessionType: state.session_type.type,
        });
        
        // Setup real-time message listener for live streaming
        try {
          logger.info('🔗 Setting up message listener for handle:', state.handle_id);
          const unsubscribe = handle.onMessagesUpdate((allMessages: any[]) => {
            logger.info('📨 SessionHandleView received message list update:', { 
              handleId: state.handle_id,
              totalMessages: allMessages.length,
              receivedAt: new Date().toISOString()
            });
            
            // Replace the entire message list with the updated one from SessionHandle
            logger.info('📝 Setting complete message list, new count:', allMessages.length);
            setMessages(allMessages);
            
            // Check if the last message is an assistant message to stop streaming
            if (allMessages.length > 0) {
              const lastMessage = allMessages[allMessages.length - 1];
              if (lastMessage?.type === 'assistant') {
                logger.info('🛑 Setting isStreaming to false (assistant message in update)');
                setIsStreaming(false);
              }
            }
          });
          
          messageUnsubscribeRef.current = unsubscribe;
          logger.info('✅ Message listener setup complete for handle:', state.handle_id);
        } catch (err) {
          logger.error('❌ Failed to setup message listener:', err);
        }
      } catch (err) {
        logger.error('Failed to initialize session handle:', { 
          error: err, 
          errorMessage: err instanceof Error ? err.message : String(err),
          errorType: typeof err,
          sessionId: sessionId ?? 'unknown',
          projectPath 
        });
        setError(err instanceof Error ? err.message : `Failed to initialize session: ${String(err)}`);
      }
    };

    initializeHandle();

    return () => {
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
    };
  }, [sessionId, projectPath, sessionHandle, sessionState]);

  // Simple cleanup - make SessionHandleManager.destroyHandle idempotent instead of trying to detect StrictMode
  useEffect(() => {
    return () => {
      if (sessionHandle && sessionState) {
        logger.info('🗑️ Component unmounting - requesting handle cleanup:', sessionState.handle_id);
        // Let the SessionHandleManager decide if it should actually destroy or keep the handle
        SessionHandleManager.destroyHandle(sessionState.handle_id, projectPath);
      }
    };
  }, [sessionHandle, sessionState, projectPath]);

  // Navigation handlers
  const handleScrollToTop = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollToTop();
    }
  }, []);

  const handleScrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollToBottom();
    }
  }, []);

  // Handle prompt submission
  const handlePromptSubmit = useCallback(async (prompt: string, model: "sonnet" | "opus") => {
    if (!sessionHandle) {
      logger.error('Cannot send prompt: no session handle available');
      return;
    }

    try {
      setIsStreaming(true);
      setError(null);
      
      logger.info('🚀 Sending prompt to session handle:', { prompt: prompt.substring(0, 50) });
      
      // Send prompt to backend - all messages (including user message) come via streaming
      await sessionHandle.sendPrompt(prompt);
      
    } catch (err) {
      logger.error('Failed to send prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to send prompt');
      setIsStreaming(false);
    }
  }, [sessionHandle]);

  // Loading state
  if (!sessionHandle || !sessionState) {
    logger.info('🔄 SessionHandleView in loading state:', { 
      hasSessionHandle: !!sessionHandle, 
      hasSessionState: !!sessionState,
      error: error 
    });
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    logger.info('❌ SessionHandleView in error state:', { error });
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load session</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={onBack} variant="outline">
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  const isReadOnly = sessionState.session_type.type === 'Native';
  const totalTokens = displayableMessages.reduce((sum, msg) => {
    if (msg.message?.usage) {
      return sum + msg.message.usage.input_tokens + msg.message.usage.output_tokens;
    }
    return sum;
  }, 0);

  logger.info('✨ SessionHandleView rendering main component:', {
    hasSessionHandle: !!sessionHandle,
    hasSessionState: !!sessionState,
    displayableMessagesCount: displayableMessages.length,
    rawMessagesCount: messages.length,
    isReadOnly,
    totalTokens
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full relative"
    >
      <DebugLabel label="SessionHandleView" />
      
      <SessionHeader
        projectPath={projectPath}
        claudeSessionId={sessionState.current_claude_session_id}
        sessionId={sessionState.handle_id}
        claudioId={sessionState.session_type.type === 'Claudio' ? (sessionState.session_type.data as any)?.claudio_id : null}
        totalTokens={totalTokens}
        isStreaming={isStreaming}
        hasMessages={displayableMessages.length > 0}
        showTimeline={false}
        copyPopoverOpen={false}
        onBack={onBack}
        onExportAsJson={() => logger.info('Export as JSON (not implemented yet)')}
        onExportAsMarkdown={() => logger.info('Export as Markdown (not implemented yet)')}
        onToggleTimeline={() => logger.info('Toggle timeline (not implemented yet)')}
        isReadOnly={isReadOnly}
        setCopyPopoverOpen={() => {}}
        sessionData={session}
        displayableMessageCount={displayableMessages.length}
        collapsedMessageUuids={collapsedMessageUuids}
        showNavigation={displayableMessages.length > 0}
        isPinnedToBottom={isPinnedToBottom}
        onScrollToTop={handleScrollToTop}
        onScrollToBottom={handleScrollToBottom}
        sessionFilePath={sessionState.session_file_path || undefined}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <VirtuosoChatMessages 
          ref={messagesRef}
          displayableMessages={displayableMessages}
          messages={messages}
          isLoading={isStreaming}
          error={error}
          sessionId={sessionState.handle_id}
          projectId={sessionState.project_path}
          onPinnedStateChange={setIsPinnedToBottom}
        />
        
        {!isReadOnly && (
          <PromptInput
            onSend={handlePromptSubmit}
            isLoading={isStreaming}
            disabled={false}
            projectPath={projectPath}
          />
        )}
      </div>

    </motion.div>
  );
};