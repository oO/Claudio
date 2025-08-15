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

interface ClaudeCodeSessionProps {
  /**
   * Optional session to resume (when clicking from SessionList)
   */
  session?: Session;
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
    console.log(`ClaudeCodeSession DEBUG:
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

  // Simple handlers that delegate to the extracted components
  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory"
      });
      
      if (selected) {
        setProjectPath(selected as string);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to select directory: ${errorMessage}`);
    }
  };

  const handleSendPrompt = async (_prompt: string, _model: "sonnet" | "opus") => {
    // This will be handled by the SessionMessageHandler component
    // Delegated to SessionMessageHandler
  };

  const handleCancelExecution = async () => {
    // This will be handled by the SessionMessageHandler component  
    // Delegated to SessionMessageHandler
  };

  const handleCheckpointSelect = async () => {
    await loadSessionHistory();
    setTimelineVersion((v) => v + 1);
  };
  
  const handleRefresh = useCallback(async () => {
    if (!session) return; // Only refresh existing sessions
    
    try {
      // Reload session data
      await loadSessionHistory();
    } catch (error) {
      console.error('Failed to refresh session:', error);
      setError('Failed to refresh session data');
    }
  }, [session, loadSessionHistory, setError]);
  
  // Generate a unique tab ID for this session tab
  const tabId = useRef(`session-tab-${Math.random().toString(36).substr(2, 9)}`);
  
  // File watching for session changes (replaces polling)
  const { isWatching, forceRefresh } = useSessionFileWatcher({
    session: effectiveSession || undefined,
    projectId: session?.project_id,
    onSessionChanged: handleRefresh,
    enabled: true,
    tabId: tabId.current
  });
  
  // Scroll navigation for virtualized messages
  const scrollToTop = useCallback(() => {
    console.log('Scrolling to top via SessionMessages ref');
    sessionMessagesRef.current?.scrollToTop();
  }, []);
  
  const scrollToBottom = useCallback(() => {
    console.log('Scrolling to bottom via SessionMessages ref');
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
  const projectPathInput = !session && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="p-4 border-b border-border flex-shrink-0"
    >
      <Label htmlFor="project-path" className="text-sm font-medium">
        Project Directory
      </Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          id="project-path"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          placeholder="/path/to/your/project"
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          onClick={handleSelectPath}
          size="icon"
          variant="outline"
          disabled={isLoading}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  // Main content with messages
  const mainContent = (
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      {projectPathInput}
      
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
          totalTokens={actualTokenCount}
          isStreaming={isLoading}
          hasMessages={displayableMessages.length > 0}
          showTimeline={showTimeline}
          copyPopoverOpen={copyPopoverOpen}
          onBack={onBack}
          onSelectPath={handleSelectPath}
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
          {/* All prompt controls - Only show for new sessions initiated by Claudio */}
          {!session && (
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