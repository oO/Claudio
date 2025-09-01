import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { DebugLabel } from '@/components/ui/atoms';
import { SessionHandleManager, SessionHandle, SessionState, StreamedMessage, ClaudeProcessEvent, SESSION_TYPES } from '@/lib/sessionHandleApi';
import { SessionProvider } from '@/contexts/SessionContext';
import { SessionHeader } from './SessionHeader';
import { SessionMessages } from './SessionMessages';
import { VirtuosoChatMessages } from './VirtuosoChatMessages';
import { PromptInput } from './PromptInput';
import { useNativeClaudeSessions } from '@/hooks/useNativeClaudeSessions';
import { useSessionFileWatcher } from '@/hooks/useSessionFileWatcher';
import type { Session } from '@/lib/api';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

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

  // Native Claude session thinking state hook
  const { isSessionThinking } = useNativeClaudeSessions();

  // Session file watcher - ensures backend watches this project for file changes
  const projectId = sessionState?.project_id;
  useSessionFileWatcher({
    session,
    projectId, 
    onSessionChanged: async () => {
      logger.info('📁 Session file changed, refreshing session handle');
      // The session orchestrator will handle the message updates automatically
    },
    enabled: !!projectId,
    tabId: `session-handle-${session.id}`
  });

  // Compute effective streaming state - for native sessions, use thinking state
  const effectiveIsStreaming = useMemo(() => {
    if (sessionState?.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      return claudeSessionId ? isSessionThinking(claudeSessionId) : false;
    }
    return isStreaming;
  }, [sessionState?.session_type.type, sessionState?.current_claude_session_id, isSessionThinking, isStreaming]);

  // Debug: Log streaming state changes
  useEffect(() => {
    if (sessionState?.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      logger.log('🔄 Native session streaming state changed:', { 
        isStreaming, 
        effectiveIsStreaming,
        nativeThinking: claudeSessionId ? isSessionThinking(claudeSessionId) : false,
        claudeSessionId: claudeSessionId?.substring(0, 8),
        sessionId: sessionState.handle_id?.substring(0, 8),
        messageCount: messages.length 
      });
    }
  }, [isStreaming, effectiveIsStreaming, sessionState?.session_type.type, sessionState?.handle_id, sessionState?.current_claude_session_id, isSessionThinking, messages.length]);


  // Refs for cleanup and navigation
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef<any>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [collapsedMessageUuids, setCollapsedMessageUuids] = useState<string[]>([]);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [isCompactMode, setIsCompactMode] = useState(false);

  const toggleCompactMode = useCallback(() => {
    setIsCompactMode(prev => !prev);
  }, []);

  // Helper function: Filter unwanted messages
  const filterMessages = (rawMessages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    logger.info(`🔧 filterMessages starting with ${rawMessages.length} raw messages`);
    const filteredUuids: string[] = [];
    
    const filtered = rawMessages.filter((message, index) => {
      // Skip meta messages that don't have meaningful content
      if (message.isMeta && !message.leafUuid && !message.summary) {
        if (message.uuid) filteredUuids.push(message.uuid);
        return false;
      }

      // Skip artificial user messages created by sub-agent system
      // These are internal system artifacts that just repeat task prompts
      if (message.isSidechain && message.type === "user") {
        if (message.uuid) filteredUuids.push(message.uuid);
        return false;
      }

      // Handle user messages
      if (message.type === "user" && message.message) {
        // Skip user meta messages
        if (message.isMeta) {
          if (message.uuid) filteredUuids.push(message.uuid);
          return false;
        }

        const msg = message.message;
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          if (message.uuid) filteredUuids.push(message.uuid);
          return false;
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
                const matchingToolUse = rawMessages.find(prevMsg => 
                  prevMsg.type === 'assistant' && 
                  prevMsg.message?.content && 
                  Array.isArray(prevMsg.message.content) &&
                  prevMsg.message.content.some((c: any) => 
                    c.type === 'tool_use' && c.id === content.tool_use_id
                  )
                );
                if (matchingToolUse) {
                  const toolUse = (matchingToolUse.message!.content as any[]).find((c: any) => 
                    c.type === 'tool_use' && c.id === content.tool_use_id
                  );
                  if (toolUse) {
                    const toolName = toolUse.name?.toLowerCase();
                    const toolsWithWidgets = [
                      'task', 'edit', 'multiedit', 'todowrite', 'ls', 'read', 
                      'glob', 'bash', 'write', 'grep', 'exitplanmode'
                    ];
                    if (toolsWithWidgets.includes(toolName) || toolUse.name?.startsWith('mcp__')) {
                      willBeSkipped = true;
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
            if (message.uuid) filteredUuids.push(message.uuid);
            return false;
          }
        }
      }

      // Filter out system messages that MessageRouter won't handle
      if (message.type === "system" && !(message as any).subtype) {
        logger.info(`❌ Filtering out system message without subtype: uuid=${message.uuid?.substring(0, 8)}`);
        if (message.uuid) filteredUuids.push(message.uuid);
        return false;
      }

      return true; // Keep message
    });

    // Store filtered UUIDs for debugging purposes
    setCollapsedMessageUuids(filteredUuids);
    
    return filtered;
  };

  // Helper function: Bundle ALL related messages (summaries, commands+stdout)
  const bundleMessages = (filteredMessages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    // First bundle consecutive summary messages
    const summaryBundled = bundleSummaries(filteredMessages);
    // Then bundle command+output pairs
    return bundleCommands(summaryBundled);
  };

  // Helper function: Bundle consecutive summary messages  
  const bundleSummaries = (messages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    const result: ClaudeStreamMessage[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < messages.length; i++) {
      if (processed.has(i)) continue;

      const message = messages[i];
      
      if (message.leafUuid && message.summary && (message as any).type === "summary") {
        const summaries = [message.summary];
        const leafUuids = [message.leafUuid];
        
        // Look for consecutive summary messages
        let j = i + 1;
        while (j < messages.length) {
          const next = messages[j];
          if (next.leafUuid && next.summary && (next as any).type === "summary") {
            summaries.push(next.summary);
            leafUuids.push(next.leafUuid);
            processed.add(j);
            j++;
          } else {
            break;
          }
        }
        
        // For summary messages, use the leafUuids as contributing message identifiers
        // but also preserve the original message UUIDs if they exist
        const contributingUuids = leafUuids; // Use leafUuids for summary correlation
        
        result.push({
          ...message,
          summary: summaries,
          _contributingMessageUuids: contributingUuids,
          _isBundle: summaries.length > 1
        });
      } else {
        result.push(message);
      }
    }
    
    return result;
  };

  // Helper function: Bundle command messages with their stdout
  const bundleCommands = (filteredMessages: ClaudeStreamMessage[]): ClaudeStreamMessage[] => {
    // logger.info(`🔧 bundleCommandMessages starting with ${filteredMessages.length} filtered messages`);
    
    const bundledMessages: ClaudeStreamMessage[] = [];
    const processedIndices = new Set<number>();
    
    for (let i = 0; i < filteredMessages.length; i++) {
      if (processedIndices.has(i)) {
        // logger.info(`⏭️ Skipping index ${i} (already processed)`);
        continue;
      }
      
      const message = filteredMessages[i];
      // logger.info(`🔍 Processing message ${i}: type=${message.type}, uuid=${message.uuid?.substring(0, 8)}`);
      
      // Check if this is a command message
      if (message.type === "user" && message.message && typeof message.message.content === "string") {
        const contentStr = message.message.content as string;
        const commandMatch = contentStr.match(
          /<command-name>(.+?)<\/command-name>[\s\S]*?<command-message>(.+?)<\/command-message>[\s\S]*?<command-args>(.*?)<\/command-args>/
        );
        
        if (commandMatch) {
          const [, commandName, commandMessage, commandArgs] = commandMatch;
          // logger.info(`⚡ Found command: ${commandName} at index ${i}`);
          
          // Look for the stdout message by parentUuid (not just next message)
          let stdout = "";
          let contributingUuids = [message.uuid].filter(Boolean);
          
          // Find the stdout message that has this command as parent
          for (let j = i + 1; j < filteredMessages.length; j++) {
            const candidateMessage = filteredMessages[j];
            if (candidateMessage.parentUuid === message.uuid && 
                candidateMessage.type === "user" && 
                typeof candidateMessage.message?.content === "string") {
              const candidateContentStr = candidateMessage.message.content as string;
              const stdoutMatch = candidateContentStr.match(
                /<local-command-stdout>(.*?)<\/local-command-stdout>/s
              );
              if (stdoutMatch) {
                stdout = stdoutMatch[1];
                if (candidateMessage.uuid) contributingUuids.push(candidateMessage.uuid);
                processedIndices.add(j); // Mark stdout message as processed
                // logger.info(`📦 Bundled stdout from index ${j} (parentUuid match), marked as processed`);
                break; // Found the matching stdout, stop looking
              }
            }
          }

          // Create bundled command message and add it to results
          const bundledMessage: ClaudeStreamMessage = {
            ...message,
            _bundledCommand: {
              commandName: commandName.trim(),
              commandMessage: commandMessage.trim(),
              commandArgs: commandArgs?.trim(),
              output: stdout
            },
            _contributingMessageUuids: contributingUuids
          };
          
          bundledMessages.push(bundledMessage);
          // logger.info(`✅ Added bundled command message, total so far: ${bundledMessages.length}`);
          // Continue to next message - this command message is now bundled and processed
          continue;
        }
      }

      // Add non-command message with contributing UUIDs
      const messageWithUuids = {
        ...message,
        _contributingMessageUuids: message.uuid ? [message.uuid] : []
      };
      bundledMessages.push(messageWithUuids);
      // logger.info(`➕ Added regular message, total so far: ${bundledMessages.length}`);
    }
    
    // logger.info(`🏁 bundleCommandMessages completed: ${filteredMessages.length} → ${bundledMessages.length} messages`);
    return bundledMessages;
  };


  // Clean message processing pipeline: Filter -> Bundle -> Display
  const displayableMessages = useMemo(() => {
    const startTime = performance.now();
    
    // Step 1: Filter out unwanted messages (meta, sidechain, etc.)
    const filteredMessages = filterMessages(messages);
    
    // Step 2: Bundle related messages (summaries, commands + stdout, etc.) 
    const bundledMessages = bundleMessages(filteredMessages);
    
    // Step 3: Add contributing UUIDs but DON'T number yet - numbering happens after MessageRouter
    const messagesWithUuids = bundledMessages.map((msg) => ({
      ...msg,
      _contributingMessageUuids: msg._contributingMessageUuids || (msg.uuid ? [msg.uuid] : [])
    }));

    const totalTime = performance.now() - startTime;
    logger.info(`🔄 Processed ${messages.length} raw messages into ${messagesWithUuids.length} displayable (${totalTime.toFixed(2)}ms)`);
    
    return messagesWithUuids;
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
            
            // Merge real messages with any fake messages, removing duplicates
            logger.info('📝 Setting complete message list, new count:', allMessages.length);
            setMessages(prev => {
              // Remove fake messages that have been replaced by real ones
              const realUserMessages = allMessages.filter(msg => msg.type === 'user');
              const onlyFakeMessages = prev.filter(msg => {
                const isFake = (msg as any).isFake;
                if (!isFake) return false; // Remove all non-fake messages - they'll be replaced by allMessages
                
                // For fake user messages, remove if we now have a real user message with same content
                if (msg.type === 'user') {
                  const fakeText = msg.message?.content?.[0]?.text;
                  const hasRealMatch = realUserMessages.some(realMsg => 
                    realMsg.message?.content?.[0]?.text === fakeText
                  );
                  return !hasRealMatch; // Remove if we have a real match
                }
                
                return true; // Keep other fake messages (like thinking messages)
              });
              
              // Combine only fake messages with real messages, sort by timestamp
              const combined = [...onlyFakeMessages, ...allMessages].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              
              logger.info('📝 Merged messages: fake kept, real added. Total:', combined.length);
              return combined;
            });
            
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
          
          // Setup process event listener for thinking messages
          try {
            logger.info('🔗 Setting up process event listener for handle:', state.handle_id);
            const processUnsubscribe = handle.onProcessEvent((processEvent: ClaudeProcessEvent) => {
              logger.info('📻 SessionHandleView received process event:', {
                handleId: state.handle_id,
                status: processEvent.status.type,
                title: processEvent.title,
                message: processEvent.message,
                timestamp: new Date().toISOString()
              });
              
              // Note: We handle 'Starting' status immediately in handlePromptSubmit for snappy UX
              // Only handle completion/failure events from backend
              if (processEvent.status.type === 'Completed' || processEvent.status.type === 'Failed') {
                logger.info('✅ Removing thinking status message - process completed/failed');
                removeStatusMessage();
                // Note: don't set isStreaming to false here - let message updates handle that
              }
            });
            
            // Store the unsubscribe function (we'll need to modify cleanup later)
            logger.info('✅ Process event listener setup complete for handle:', state.handle_id);
          } catch (err) {
            logger.error('❌ Failed to setup process event listener:', err);
          }
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
  }, [sessionId, projectPath]);

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
      
      // Immediately add fake user message for instant feedback
      const fakeUserMessage = {
        type: "user",
        uuid: `fake-user-${Date.now()}`,
        message: {
          content: [{ type: "text", text: prompt }]
        },
        timestamp: new Date().toISOString(),
        isFake: true // Mark as fake so we can remove it later
      } as ClaudeStreamMessage & { isFake: boolean };
      
      setMessages(prev => [...prev, fakeUserMessage as any]);
      
      // Immediately add thinking message for snappy UX while backend processes
      // Get a random thinking haiku for immediate feedback
      const thinkingHaikus = [
        { title: "Claude is thinking...", message: "Code flows like water — Through circuits of thought and dream — Beauty takes its form" },
        { title: "Processing...", message: "Algorithms dance — In silicon valleys deep — Logic finds its way" },
        { title: "Analyzing...", message: "Bits and bytes align — Creating worlds from nothing — Magic in the machine" },
        { title: "Working...", message: "Functions intertwine — Like vines in digital gardens — Growth through iteration" },
        { title: "Computing...", message: "Variables shift — Like shadows in moonlit code — Truth emerges slowly" }
      ];
      const randomHaiku = thinkingHaikus[Math.floor(Math.random() * thinkingHaikus.length)];
      addStatusMessage(randomHaiku.title, randomHaiku.message);
      
      // Send prompt to backend - all messages (including user message) come via streaming
      await sessionHandle.sendPrompt(prompt);
      
    } catch (err) {
      logger.error('Failed to send prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to send prompt');
      setIsStreaming(false);
    }
  }, [sessionHandle]);

  // Status message handling for thinking messages (copied from ClaudeCodeSession)
  const addStatusMessage = useCallback((title: string, message?: string) => {
    const statusMessage = {
      type: "status",
      uuid: `status-${sessionState?.handle_id}-${Date.now()}`,
      message: { 
        content: [{ type: "text", text: message || title }] 
      },
      title,
      timestamp: new Date().toISOString(),
      isTemporary: true,
      claudio_session_id: sessionState?.handle_id
    } as ClaudeStreamMessage & { type: "status"; isTemporary: boolean; title: string };
    
    // Remove any existing status messages and add the new one
    setMessages(prev => {
      const nonStatusMessages = prev.filter(m => (m as any).type !== "status");
      const newMessages = [...nonStatusMessages, statusMessage as any];
      return newMessages;
    });
  }, [sessionState?.handle_id]);

  const removeStatusMessage = useCallback(() => {
    setMessages(prev => {
      const nonStatusMessages = prev.filter(m => (m as any).type !== "status");
      return nonStatusMessages;
    });
  }, []);

  // Handle native session thinking messages - add/remove thinking message when state changes
  useEffect(() => {
    if (sessionState?.session_type.type === SESSION_TYPES.NATIVE) {
      const claudeSessionId = sessionState.current_claude_session_id;
      if (claudeSessionId) {
        const isCurrentlyThinking = isSessionThinking(claudeSessionId);
        
        if (isCurrentlyThinking) {
          // Add thinking message for native sessions
          const thinkingHaikus = [
            { title: "Claude is thinking...", message: "Code flows like water — Through circuits of thought and dream — Beauty takes its form" },
            { title: "Processing...", message: "Algorithms dance — In silicon valleys deep — Logic finds its way" },
            { title: "Analyzing...", message: "Bits and bytes align — Creating worlds from nothing — Magic in the machine" },
            { title: "Working...", message: "Functions intertwine — Like vines in digital gardens — Growth through iteration" },
            { title: "Computing...", message: "Variables shift — Like shadows in moonlit code — Truth emerges slowly" }
          ];
          const randomHaiku = thinkingHaikus[Math.floor(Math.random() * thinkingHaikus.length)];
          addStatusMessage(randomHaiku.title, randomHaiku.message);
          logger.info('✨ Added thinking message for native session:', claudeSessionId.substring(0, 8));
        } else {
          // Remove thinking message when thinking stops
          removeStatusMessage();
          logger.info('🗑️ Removed thinking message for native session:', claudeSessionId.substring(0, 8));
        }
      }
    }
  }, [sessionState?.session_type.type, sessionState?.current_claude_session_id, isSessionThinking, addStatusMessage, removeStatusMessage]);

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

  const isReadOnly = sessionState.session_type.type === SESSION_TYPES.NATIVE;
  
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
    totalTokens,
    // DEBUG: Check what we're getting for project data
    'sessionState.project_path': sessionState.project_path,
    'projectPath prop': projectPath
  });

  return (
    <SessionProvider
      projectId={sessionState.project_id}
      sessionId={sessionState.handle_id}
      sessionFilePath={sessionState.session_file_path || undefined}
      projectPath={sessionState.project_path}
      sessionData={session}
      liveSessionType={sessionState.session_type.type}
      isStreaming={effectiveIsStreaming}
      isCompactMode={isCompactMode}
      setIsCompactMode={setIsCompactMode}
      toggleCompactMode={toggleCompactMode}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full relative"
      >
        <DebugLabel label="SessionHandleView" />
      
      <SessionHeader
        claudeSessionId={sessionState.current_claude_session_id}
        claudioId={sessionState.session_type.type === SESSION_TYPES.CLAUDIO ? (sessionState.session_type.data as any)?.claudio_id : null}
        totalTokens={totalTokens}
        hasMessages={displayableMessages.length > 0}
        showTimeline={false}
        copyPopoverOpen={false}
        onBack={onBack}
        onExportAsJson={() => logger.info('Export as JSON (not implemented yet)')}
        onExportAsMarkdown={() => logger.info('Export as Markdown (not implemented yet)')}
        onToggleTimeline={() => logger.info('Toggle timeline (not implemented yet)')}
        isReadOnly={isReadOnly}
        setCopyPopoverOpen={() => {}}
        displayableMessageCount={displayableMessages.length}
        collapsedMessageUuids={collapsedMessageUuids}
        showNavigation={displayableMessages.length > 0}
        isPinnedToBottom={isPinnedToBottom}
        onScrollToTop={handleScrollToTop}
        onScrollToBottom={handleScrollToBottom}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <VirtuosoChatMessages 
          ref={messagesRef}
          displayableMessages={displayableMessages}
          messages={messages}
          isLoading={effectiveIsStreaming}
          error={error}
          onPinnedStateChange={setIsPinnedToBottom}
        />
        
        {!isReadOnly && (
          <PromptInput
            onSend={handlePromptSubmit}
            isLoading={effectiveIsStreaming}
            disabled={false}
            projectPath={projectPath}
          />
        )}
      </div>

      </motion.div>
    </SessionProvider>
  );
};