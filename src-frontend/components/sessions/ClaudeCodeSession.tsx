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
import { type FloatingPromptInputRef } from "./FloatingPromptInput";
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
import { SessionPromptControls } from "./SessionPromptControls";
import { useSessionFileWatcher } from "@/hooks/useSessionFileWatcher";
import { useScrollPinning } from "@/hooks/useScrollPinning";
import { isEditorSession } from "@/lib/sessionUtils";

interface ClaudeCodeSessionProps {
  /**
   * Optional session to resume (when clicking from SessionList)
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
  
  const floatingPromptRef = useRef<FloatingPromptInputRef>(null);
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

  // Track Claude session state for proper --resume flow
  const [currentClaudeSessionId, setCurrentClaudeSessionId] = useState<string | null>(null);
  const [previousClaudeSessionId, setPreviousClaudeSessionId] = useState<string | null>(null);
  const [claudioId, setClaudioId] = useState<string | null>(null);
  
  // Load session history if resuming
  useEffect(() => {
    if (session) {
      setClaudeSessionId(session.id);
      
      const initializeSession = async () => {
        await loadSessionHistory();
        if (isMountedRef.current) {
          const isActive = await checkForActiveSession();
          if (isActive) {
            // Session is active, message handler will reconnect
          }
        }
      };
      
      initializeSession();
    }
  }, [session, loadSessionHistory, checkForActiveSession, setClaudeSessionId, isMountedRef]);

  // Note: History loading is now handled by file watcher events in useSessionFileWatcher
  // When Claude writes the .jsonl file, the watcher will emit a 'session-file-changed' event
  // and useSessionFileWatcher will call onSessionChanged which triggers loadSessionHistory

  // Listen for Claude session ID updates from backend events
  useEffect(() => {
    if (!claudeSessionId) return;

    const setupEventListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      
      const unlistenMessage = await listen(`claude-sdk-message:${claudeSessionId}`, (event: any) => {
        const payload = event.payload;
        if (payload && typeof payload === 'string') {
          try {
            const parsedPayload = JSON.parse(payload);
            // Extract Claude session ID from system messages
            if (parsedPayload.type === 'system' && parsedPayload.session_id) {
              const newClaudeSessionId = parsedPayload.session_id;
              logger.info('🎯 Captured Claude session ID from event:', newClaudeSessionId);
              setCurrentClaudeSessionId(newClaudeSessionId);
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      });

      return unlistenMessage;
    };

    let cleanup: (() => void) | undefined;
    setupEventListeners().then(unlisten => {
      cleanup = unlisten;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [claudeSessionId]);

  // Create Claudio session on mount (represents "New Session" click)
  const isCreatingRef = useRef(false);
  useEffect(() => {
    const createClaudioSession = async () => {
      if (!claudioId && !session && !isCreatingRef.current) {
        isCreatingRef.current = true;
        try {
          logger.info('🆕 Creating new Claudio session for project:', projectPath);
          const newClaudioId = await api.createClaudioSession(projectPath, {});
          setClaudioId(newClaudioId);
          logger.info('✨ Created Claudio session:', newClaudioId);
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
    if (!prompt.trim() || isLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      logger.info('🚀 Executing prompt with Claudio session management:', { 
        prompt: prompt.substring(0, 50),
        model,
        claudioId,
        currentClaudeSessionId
      });
      
      // Generate a new session ID for this prompt
      const newSessionId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;
      
      // Execute using our direct session approach
      await invoke('start_claude_direct_session', {
        tempSessionId: newSessionId,
        projectPath,
        prompt,
        options: {
          session_id: currentClaudeSessionId, // For --resume (null for first message)
          claudio_id: claudioId, // Claudio wrapper session ID
          working_directory: projectPath,
          max_turns: 5,
          custom_system_prompt: undefined,
          allowed_tools: ["Bash", "Read", "Write", "Edit", "LS", "Grep"]
        }
      });
      
      // Refetch Claudio session to get updated Claude session ID
      if (claudioId) {
        try {
          logger.info('🔄 Refetching Claudio session after execution');
          const updatedSession = await api.getClaudioSession(claudioId, projectPath);
          
          if (updatedSession.session_id && updatedSession.session_id !== currentClaudeSessionId) {
            setCurrentClaudeSessionId(updatedSession.session_id);
            logger.info('🆔 Updated Claude session ID for continuation:', updatedSession.session_id);
          }
        } catch (error) {
          logger.warn('Failed to refetch Claudio session:', error);
        }
      }
      
      // Set up listener for immediate session ready event  
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<any>('claude_session_ready', async (event) => {
        const { session_id, claudio_id: eventClaudioId } = event.payload;
        
        // Only handle events for our current Claudio pointer  
        if (eventClaudioId === claudioId) {
          logger.info('🎯 New Claude session created:', { session_id, claudio_id: eventClaudioId });
          
          // Update the current session_id (this is the NEW session for this turn)
          setCurrentClaudeSessionId(session_id);
          
          // Update extractedSessionInfo to track the latest Claude session_id
          const project_id = effectiveSession?.project_id || projectPath.replace(/\//g, '-').replace(/\s+/g, '-');
          setExtractedSessionInfo({ 
            sessionId: session_id, 
            projectId: project_id
          });
          
          // Update session state so file watcher switches to the new session file  
          setClaudeSessionId(session_id);
          
          logger.info('👀 File watcher will now watch new session file:', `${session_id}.jsonl`);
          // loadSessionHistory will be called automatically by useEffect when effectiveSession updates
        }
      });
      
      // Clean up listener when component unmounts or new prompt starts
      setTimeout(() => unlisten(), 30000); // Auto cleanup after 30s
      
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
    
    try {
      // Reload session data
      await loadSessionHistory();
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      setError('Failed to refresh session data');
    }
  }, [effectiveSession, loadSessionHistory, setError]);
  
  // Generate a unique tab ID for this session tab
  const tabId = useRef(`session-tab-${Math.random().toString(36).substr(2, 9)}`);
  
  // File watching for session changes (replaces polling)
  const { isWatching, forceRefresh } = useSessionFileWatcher({
    session: effectiveSession || undefined,
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

        {/* Main Content Area */}
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

        {/* Floating Prompt Input and Overlays */}
        <ErrorBoundary>
          {/* All prompt controls - Only show for editor sessions that can be interacted with */}
          {(sessionId ? isEditorSession({ id: sessionId }) : !session) && (
            <SessionPromptControls
              floatingPromptRef={floatingPromptRef}
              onSend={handleSendPrompt}
              onCancel={handleCancelExecution}
              isLoading={isLoading}
              projectPath={projectPath}
              queuedPrompts={queuedPrompts}
              queuedPromptsCollapsed={queuedPromptsCollapsed}
              onToggleQueuedPromptsCollapsed={() => setQueuedPromptsCollapsed(!queuedPromptsCollapsed)}
              onRemovePrompt={(id) => setQueuedPrompts(prev => prev.filter(p => p.id !== id))}
              totalTokens={totalTokens}
              displayableMessagesLength={displayableMessages.length}
              onNavigateToTop={scrollToTop}
              onNavigateToBottom={scrollToBottom}
              showTimeline={showTimeline}
            />
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
          currentClaudeSessionId={currentClaudeSessionId}
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