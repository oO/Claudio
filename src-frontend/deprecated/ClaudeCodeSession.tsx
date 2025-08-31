import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FolderOpen,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Session } from "@/lib/api";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { ErrorBoundary } from "@/components/common";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';
import { api } from '@/lib/api';
import { invoke } from '@tauri-apps/api/core';

// Import extracted components
import { useSessionState } from "@/hooks/useSessionState";
import { SessionMessageHandler } from "./SessionMessageHandler";
import { useSessionActions } from "./SessionActions";
import { SessionPreview } from "./SessionPreview";
import { SessionSettings } from "./SessionSettings";
import { SessionTimeline } from "./SessionTimeline";
import { SessionMessages, type SessionMessagesRef } from "./SessionMessages";
import { SessionHeader } from "./SessionHeader";
import { PromptInput, type PromptInputRef } from "./PromptInput";
import { useSessionFileWatcher } from "@/hooks/useSessionFileWatcher";
import { useScrollPinning } from "@/hooks/useScrollPinning";
import { isEditorSession } from "@/lib/sessionUtils";
import type { ClaudeStreamMessage } from "@/lib/outputCache";

// Backend process event types
interface ClaudeProcessEvent {
  claudio_session_id: string;
  claude_session_id: string;
  process_id?: number;
  status: {
    type: 'Starting' | 'Running' | 'Completed' | 'Failed';
    data?: { action?: string; reason?: string };
  };
  timestamp: number;
  title?: string;
  message?: string;
}

interface ClaudeCodeSessionProps {
  /**
   * Optional session to continue (contains session history and metadata)
   */
  session?: Session;
  /**
   * Claudio session ID for editor mode detection
   */
  sessionId?: string;
  /**
   * Initial project path (for new sessions)
   */
  initialProjectPath?: string;
  /**
   * Callback to go back
   */
  onBack: () => void;
  /**
   * Callback to open hooks configuration
   */
  onProjectSettings?: (projectPath: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when streaming state changes
   */
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
}

/**
 * ClaudeCodeSession component for interactive Claude Code sessions
 * 
 * @example
 * <ClaudeCodeSession onBack={() => setView('projects')} />
 */
export const ClaudeCodeSession: React.FC<ClaudeCodeSessionProps> = ({
  session,
  sessionId,
  initialProjectPath = "",
  onBack,
  onProjectSettings,
  className,
  onStreamingChange,
}) => {
  // Use the extracted session state hook
  const sessionState = useSessionState({
    session,
    initialProjectPath,
    onStreamingChange,
  });
  
  
  const {
    // Core state
    projectPath,
    setProjectPath,
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    error,
    setError,
    rawJsonlOutput,
    setRawJsonlOutput,
    claudeSessionId,
    setClaudeSessionId,
    extractedSessionInfo: _extractedSessionInfo,
    setExtractedSessionInfo,
    isFirstPrompt,
    setIsFirstPrompt,
    totalTokens,
    
    // UI state
    showTimeline,
    setShowTimeline,
    timelineVersion,
    setTimelineVersion,
    showSettings,
    setShowSettings,
    showPreview,
    setShowPreview,
    previewUrl,
    setPreviewUrl,
    showPreviewPrompt,
    setShowPreviewPrompt,
    splitPosition,
    setSplitPosition,
    isPreviewMaximized,
    setIsPreviewMaximized,
    showForkDialog,
    setShowForkDialog,
    forkCheckpointId,
    setForkCheckpointId,
    forkSessionName,
    setForkSessionName,
    queuedPrompts,
    setQueuedPrompts,
    queuedPromptsCollapsed,
    setQueuedPromptsCollapsed,
    
    // Computed values
    effectiveSession,
    displayableMessages,
    collapsedMessageUuids,
    sessionFilePath,
    
    // Refs
    isMountedRef,
    hasActiveSessionRef,
    isListeningRef,
    queuedPromptsRef,
    sessionMetrics,
    
    // Methods and analytics
    trackEvent,
    workflowTracking,
    loadSessionHistory,
    checkForActiveSession,
    updateSessionMetrics,
  } = sessionState;
  
  const promptRef = useRef<PromptInputRef>(null);
  const sessionMessagesRef = useRef<SessionMessagesRef>(null);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [actualDisplayedMessageCount, setActualDisplayedMessageCount] = useState(0);
  const [actualTokenCount, setActualTokenCount] = useState(0);
  const [isCompactMode, setIsCompactMode] = useState(false);
  
  // Debug logging
  useEffect(() => {
    logger.log(`ClaudeCodeSession DEBUG:
      - raw messages.length: ${messages.length}
      - displayableMessages.length: ${displayableMessages.length} 
      - actualDisplayedMessageCount from SessionMessages: ${actualDisplayedMessageCount}`);
  }, [messages.length, displayableMessages.length, actualDisplayedMessageCount]);
  
  // Initialize session actions hook
  const sessionActions = useSessionActions({
    messages,
    rawJsonlOutput,
    projectPath,
    effectiveSession,
    onError: setError,
    onLoading: setIsLoading,
  });

  // Simplified session management - single source of truth
  const [activeClaudeSessionId, setActiveClaudeSessionId] = useState<string | null>(null);
  const [claudioId, setClaudioId] = useState<string | null>(null);
  
  // Determine session type and initialize state
  const isReadOnlyClaudeSession = useMemo(() => {
    return session && !(session as any)?.claudio?.claudio_id;
  }, [session]);

  // Initialize session state from props (unified for both fresh and continued sessions)
  useEffect(() => {
    if (session) {
      // Extract claudio ID and current session ID from session metadata
      const claudioSessionId = (session as any)?.claudio?.claudio_id;
      const currentSessionId = (session as any)?.claudio?.session_id || session.id;
      
      if (claudioSessionId && !claudioId) {
        setClaudioId(claudioSessionId);
        logger.info('🔗 Initialized claudio session:', claudioSessionId);
      }
      
      // Only set activeClaudeSessionId for read-only sessions or when we don't have a claudio ID
      // For interactive Claudio sessions, wait for authoritative backend event
      if (currentSessionId && currentSessionId !== activeClaudeSessionId) {
        if (isReadOnlyClaudeSession || !claudioSessionId) {
          setActiveClaudeSessionId(currentSessionId);
          if (isReadOnlyClaudeSession) {
            logger.info('📖 Read-only Claude Code session loaded:', currentSessionId);
          } else {
            logger.info('📍 Interactive Claudio session loaded:', currentSessionId);
          }
        } else {
          logger.info('🔄 Interactive Claudio session - waiting for backend session ID event');
        }
      }
    }
  }, [session, claudioId, activeClaudeSessionId, isReadOnlyClaudeSession]);
  
  // Load session history when we have an active session ID
  useEffect(() => {
    if (activeClaudeSessionId) {
      setClaudeSessionId(activeClaudeSessionId);
      
      const initializeSession = async () => {
        try {
          await loadSessionHistory();
          if (isMountedRef.current) {
            await checkForActiveSession();
          }
        } catch (error) {
          logger.error('Failed to initialize session:', error);
          setError(error instanceof Error ? error.message : 'Failed to initialize session');
        }
      };
      
      initializeSession();
    }
  }, [activeClaudeSessionId, loadSessionHistory, checkForActiveSession, isMountedRef]);

  // Note: History loading is now handled by file watcher events in useSessionFileWatcher
  // When Claude writes the .jsonl file, the watcher will emit a 'session-file-changed' event
  // and useSessionFileWatcher will call onSessionChanged which triggers loadSessionHistory

  // Listen for new Claude sessions created by backend
  useEffect(() => {
    if (!claudioId) return;

    const setupSessionListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      
      const unlisten = await listen<any>('claude_session_ready', (event) => {
        const { session_id, claudio_id: eventClaudioId } = event.payload;
        
        // Only handle events for our claudio session
        if (eventClaudioId === claudioId) {
          logger.info('🎯 Backend created new Claude session:', { session_id, claudio_id: eventClaudioId });
          setActiveClaudeSessionId(session_id);
        }
      });

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setupSessionListener().then(unlisten => {
      cleanup = unlisten;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [claudioId]);

  // Create Claudio session on mount for new interactive sessions only
  const isCreatingRef = useRef(false);
  useEffect(() => {
    const createClaudioSession = async () => {
      // Only create Claudio sessions for new interactive sessions (not read-only Claude Code sessions)
      if (!claudioId && !session && !isCreatingRef.current) {
        isCreatingRef.current = true;
        try {
          logger.info('🆕 Creating new interactive Claudio session for project:', projectPath);
          const newClaudioId = await api.createClaudioSession(projectPath, {});
          setClaudioId(newClaudioId);
          logger.info('✨ Created interactive Claudio session:', newClaudioId);
        } catch (error) {
          logger.error('Failed to create Claudio session:', error);
          setError(error instanceof Error ? error.message : 'Failed to create session');
        } finally {
          isCreatingRef.current = false;
        }
      }
    };

    createClaudioSession();
  }, [projectPath, claudioId, session]);

  // Simple handlers that delegate to the extracted components
  // handleSelectPath removed - no longer needed

  const handleSendPrompt = async (prompt: string, model: "sonnet" | "opus") => {
    if (!prompt.trim() || isLoading || isReadOnlyClaudeSession) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Resume detection removed - let file watcher handle updates naturally like fresh sessions
      
      // Add the user message immediately to the UI for responsiveness
      const userMessage: ClaudeStreamMessage = {
        type: "user",
        message: {
          content: [
            {
              type: "text",
              text: prompt
            }
          ]
        },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
      
      logger.info('🚀 Executing prompt with Claudio session management:', { 
        prompt: prompt.substring(0, 50),
        model,
        claudioId,
        activeSessionId: activeClaudeSessionId,
        willResume: activeClaudeSessionId !== null
      });
      
      // Generate a new session ID for this prompt
      const newSessionId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;
      
      // Execute using our direct session approach
      await invoke('start_claude_direct_session', {
        tempSessionId: newSessionId,
        projectPath,
        prompt,
        options: {
          session_id: activeClaudeSessionId, // For --resume (null for first message)
          claudio_id: claudioId, // Claudio wrapper session ID
          working_directory: projectPath,
          max_turns: 5,
          custom_system_prompt: undefined,
          allowed_tools: ["Bash", "Read", "Write", "Edit", "LS", "Grep"]
        }
      });
      
      // Backend will notify us of new session via the global claude_session_ready event listener
      // established in the useEffect above - no need for manual refetching or temporary listeners
      
    } catch (error) {
      logger.error('Failed to send prompt:', error);
      setError(error instanceof Error ? error.message : 'Failed to send prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelExecution = async () => {
    try {
      if (claudeSessionId) {
        // Import the SDK dynamically
        const { claudeCodeSDK } = await import('@/lib/claudeCodeSdk');
        
        logger.info('Cancelling SDK session:', claudeSessionId);
        await claudeCodeSDK.terminateSession(claudeSessionId);
      }
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to cancel execution:', error);
      setError(error instanceof Error ? error.message : 'Failed to cancel execution');
    }
  };

  const handleCheckpointSelect = async () => {
    await loadSessionHistory();
    setTimelineVersion((v) => v + 1);
  };
  
  const handleRefresh = useCallback(async () => {
    if (!effectiveSession) return; // Need either session or effectiveSession
    
    // Resume detection logic removed - just refresh like fresh sessions do
    
    try {
      // Reload session data
      await loadSessionHistory();
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      setError('Failed to refresh session data');
    }
  }, [effectiveSession, loadSessionHistory, setError, api]);
  

  // Status message handling for Claude process events
  const addStatusMessage = useCallback((title: string, message?: string) => {
    const statusMessage = {
      type: "status",
      uuid: `status-${claudioId}-${Date.now()}`,
      message: { 
        content: [{ type: "text", text: message || title }] 
      },
      title,
      timestamp: new Date().toISOString(),
      isTemporary: true,
      claudio_session_id: claudioId
    } as ClaudeStreamMessage & { type: "status"; isTemporary: boolean; title: string };
    
    // Remove any existing status messages and add the new one
    setMessages(prev => {
      const nonStatusMessages = prev.filter(m => (m as any).type !== "status");
      const newMessages = [...nonStatusMessages, statusMessage as any];
      return newMessages;
    });
  }, [claudioId]);

  const removeStatusMessage = useCallback(() => {
    setMessages(prev => {
      const nonStatusMessages = prev.filter(m => (m as any).type !== "status");
      return nonStatusMessages;
    });
  }, []);

  // Listen for Claude process events
  useEffect(() => {
    if (!claudioId) return;

    const setupEventListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      
      const unlisten = await listen<ClaudeProcessEvent>('claude-process-event', (event) => {
        const { claudio_session_id, status, title, message } = event.payload;
        
        // Only handle events for our session
        if (claudio_session_id !== claudioId) return;
        
        
        switch (status.type) {
          case 'Starting':
            if (title) {
              addStatusMessage(title, message);
            }
            break;
            
          case 'Running':
            if (title) {
              addStatusMessage(title, message);
            }
            break;
            
          case 'Completed':
            removeStatusMessage();
            break;
            
          case 'Failed':
            if (title || message) {
              addStatusMessage(title || "❌ Error", message);
              // Keep error messages visible for a bit longer
              setTimeout(removeStatusMessage, 5000);
            }
            break;
        }
      });
      
      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setupEventListener().then(unlisten => {
      cleanup = unlisten;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [claudioId, addStatusMessage, removeStatusMessage]);

  // Generate a unique tab ID for this session tab
  const tabId = useRef(`session-tab-${Math.random().toString(36).substr(2, 9)}`);
  
  // Create current session object for file watcher
  const currentSessionForWatcher = useMemo(() => {
    if (!effectiveSession || !activeClaudeSessionId) return undefined;
    
    return {
      ...effectiveSession,
      id: activeClaudeSessionId
    };
  }, [effectiveSession, activeClaudeSessionId]);

  // File watching for session changes (replaces polling)
  const { isWatching, forceRefresh } = useSessionFileWatcher({
    session: currentSessionForWatcher,
    projectId: effectiveSession?.project_id,
    onSessionChanged: handleRefresh,
    enabled: true,
    tabId: tabId.current
  });
  
  // Scroll navigation for virtualized messages
  const scrollToTop = useCallback(() => {
    logger.log('Scrolling to top via SessionMessages ref');
    sessionMessagesRef.current?.scrollToTop();
  }, []);
  
  const scrollToBottom = useCallback(() => {
    logger.log('Scrolling to bottom via SessionMessages ref');
    sessionMessagesRef.current?.scrollToBottom();
  }, []);
  
  // Track pinned state from SessionMessages component
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  
  const handleCheckpointCreated = () => {
    sessionMetrics.current.checkpointCount += 1;
  };

  const handleFork = (checkpointId: string) => {
    setForkCheckpointId(checkpointId);
    setForkSessionName(`Fork-${new Date().toISOString().slice(0, 10)}`);
    setShowForkDialog(true);
  };

  const handleConfirmFork = async () => {
    if (!forkCheckpointId || !forkSessionName.trim()) return;
    
    try {
      const newSessionId = await sessionActions.forkFromCheckpoint(
        forkCheckpointId,
        forkSessionName
      );
      
      // Fork operation completed
      setShowForkDialog(false);
      setForkCheckpointId(null);
      setForkSessionName("");
    } catch (err) {
      // Error handling is done in sessionActions
    }
  };

  // Handle URL detection from terminal output
  const handleLinkDetected = (url: string) => {
    if (!showPreview && !showPreviewPrompt) {
      setPreviewUrl(url);
      setShowPreviewPrompt(true);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setIsPreviewMaximized(false);
  };

  const handlePreviewUrlChange = (url: string) => {
    setPreviewUrl(url);
  };

  const handleTogglePreviewMaximize = () => {
    setIsPreviewMaximized(!isPreviewMaximized);
    if (isPreviewMaximized) {
      setSplitPosition(50);
    }
  };

  // Project path input component
  // Project path input removed - no longer needed

  // Main content with messages
  const mainContent = (
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      <SessionMessages
        ref={sessionMessagesRef}
        displayableMessages={displayableMessages}
        messages={messages}
        isLoading={isLoading}
        error={error}
        onLinkDetected={handleLinkDetected}
        onDisplayedCountChange={setActualDisplayedMessageCount}
        onTokenCountChange={setActualTokenCount}
        onPinnedStateChange={setIsPinnedToBottom}
        sessionFilePath={sessionFilePath}
        projectId={effectiveSession?.project_id}
        sessionId={effectiveSession?.id}
      />
      
      {isLoading && messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-3">
            <div className="rotating-symbol text-primary" />
            <span className="text-sm text-muted-foreground">
              {session ? "Loading session history..." : "Initializing Claude Code..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <DebugLabel label="ClaudeCodeSession" />
      
      
      <div className={cn("relative flex flex-col h-full bg-background", className)}>
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <SessionHeader
          projectPath={projectPath}
          claudeSessionId={claudeSessionId}
          sessionId={sessionId}
          claudioId={claudioId}
          totalTokens={actualTokenCount}
          isStreaming={isLoading}
          hasMessages={displayableMessages.length > 0}
          showTimeline={showTimeline}
          copyPopoverOpen={copyPopoverOpen}
          onBack={onBack}
          onExportAsJson={() => sessionActions.exportSession('json')}
          onExportAsMarkdown={() => sessionActions.exportSession('markdown')}
          onToggleTimeline={() => setShowTimeline(!showTimeline)}
          setCopyPopoverOpen={setCopyPopoverOpen}
          sessionData={session}
          isReadOnly={isReadOnlyClaudeSession}
          sessionFilePath={sessionFilePath}
          displayableMessageCount={actualDisplayedMessageCount}
          collapsedMessageUuids={collapsedMessageUuids}
          isRefreshing={false} // File watching doesn't show a "refreshing" state
          // Navigation
          showNavigation={displayableMessages.length > 3}
          isPinnedToBottom={isPinnedToBottom}
          onScrollToTop={scrollToTop}
          onScrollToBottom={scrollToBottom}
          // Compact mode
          isCompactMode={isCompactMode}
          onToggleCompactMode={() => setIsCompactMode(!isCompactMode)}
        />

        {/* Main Content Area - Messages */}
        <div className={cn(
          "flex-1 overflow-hidden transition-all duration-300",
          showTimeline && "sm:mr-96"
        )}>
          <SessionPreview
            showPreview={showPreview}
            previewUrl={previewUrl}
            showPreviewPrompt={showPreviewPrompt}
            splitPosition={splitPosition}
            isPreviewMaximized={isPreviewMaximized}
            onClose={handleClosePreview}
            onToggleMaximize={handleTogglePreviewMaximize}
            onUrlChange={handlePreviewUrlChange}
            onSplitChange={setSplitPosition}
            onShowPreviewPrompt={setShowPreviewPrompt}
          >
            {mainContent}
          </SessionPreview>
        </div>

        {/* Prompt Controls - Part of layout flow */}
        <ErrorBoundary>
          {/* All prompt controls - Only show for editor sessions that can be interacted with */}
          {!isReadOnlyClaudeSession && ((sessionId ? isEditorSession({ id: sessionId }) : !session) || (session as any)?.claudio) && (
            <div className={cn(
              "transition-all duration-300",
              showTimeline && "sm:mr-96"
            )}>
              <PromptInput
                ref={promptRef}
                onSend={handleSendPrompt}
                onCancel={handleCancelExecution}
                isLoading={isLoading}
                disabled={!projectPath}
                projectPath={projectPath}
                queuedPrompts={queuedPrompts}
                queuedPromptsCollapsed={queuedPromptsCollapsed}
                onToggleQueuedPromptsCollapsed={() => setQueuedPromptsCollapsed(!queuedPromptsCollapsed)}
                onRemovePrompt={(id) => setQueuedPrompts(prev => prev.filter(p => p.id !== id))}
              />
            </div>
          )}
        </ErrorBoundary>

        {/* Timeline */}
        <SessionTimeline
          showTimeline={showTimeline}
          onToggleTimeline={setShowTimeline}
          effectiveSession={effectiveSession}
          projectPath={projectPath}
          currentMessageIndex={messages.length - 1}
          timelineVersion={timelineVersion}
          onCheckpointSelect={handleCheckpointSelect}
          onFork={handleFork}
          onCheckpointCreated={handleCheckpointCreated}
        />

        {/* Message Handler Component - handles all streaming logic */}
        <SessionMessageHandler
          claudeSessionId={claudeSessionId}
          effectiveSession={effectiveSession}
          claudioId={claudioId}
          currentClaudeSessionId={activeClaudeSessionId}
          loadSessionHistory={loadSessionHistory}
          projectPath={projectPath}
          isFirstPrompt={isFirstPrompt}
          isLoading={isLoading}
          isMountedRef={isMountedRef}
          isListeningRef={isListeningRef}
          hasActiveSessionRef={hasActiveSessionRef}
          queuedPromptsRef={queuedPromptsRef}
          sessionMetrics={sessionMetrics}
          messages={messages}
          totalTokens={totalTokens}
          queuedPrompts={queuedPrompts}
          setIsLoading={setIsLoading}
          setError={setError}
          setMessages={setMessages}
          setRawJsonlOutput={setRawJsonlOutput}
          setClaudeSessionId={setClaudeSessionId}
          setExtractedSessionInfo={setExtractedSessionInfo}
          setIsFirstPrompt={setIsFirstPrompt}
          setQueuedPrompts={setQueuedPrompts}
          setTimelineVersion={setTimelineVersion}
          trackEvent={trackEvent}
          workflowTracking={workflowTracking}
          updateSessionMetrics={updateSessionMetrics}
        />
      </div>

      {/* Settings Dialogs */}
      <SessionSettings
        showForkDialog={showForkDialog}
        forkCheckpointId={forkCheckpointId}
        forkSessionName={forkSessionName}
        onForkDialogChange={setShowForkDialog}
        onForkSessionNameChange={setForkSessionName}
        onConfirmFork={handleConfirmFork}
        showSettings={showSettings}
        onSettingsChange={setShowSettings}
        effectiveSession={effectiveSession}
        projectPath={projectPath}
        isLoading={isLoading}
      />
    </div>
    </>
  );
};