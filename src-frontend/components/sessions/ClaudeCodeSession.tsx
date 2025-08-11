import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { 
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Session } from "@/lib/api";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { FloatingPromptInput, type FloatingPromptInputRef } from "./FloatingPromptInput";
import { ErrorBoundary } from "@/components/common";
import { DebugLabel } from "@/components/ui/atoms";

// Import extracted components
import { useSessionState } from "./useSessionState";
import { SessionMessageHandler } from "./SessionMessageHandler";
import { useSessionActions } from "./SessionActions";
import { SessionPreview } from "./SessionPreview";
import { SessionSettings } from "./SessionSettings";
import { SessionTimeline } from "./SessionTimeline";
import { SessionQueuedPrompts } from "./SessionQueuedPrompts";
import { SessionMessages } from "./SessionMessages";
import { SessionHeader } from "./SessionHeader";

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
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  
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
        displayableMessages={displayableMessages}
        messages={messages}
        isLoading={isLoading}
        error={error}
        onLinkDetected={handleLinkDetected}
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
          totalTokens={totalTokens}
          isStreaming={isLoading}
          hasMessages={messages.length > 0}
          showTimeline={showTimeline}
          copyPopoverOpen={copyPopoverOpen}
          onBack={onBack}
          onSelectPath={handleSelectPath}
          onCopyAsJsonl={sessionActions.copyAsJsonl}
          onCopyAsMarkdown={sessionActions.copyAsMarkdown}
          onToggleTimeline={() => setShowTimeline(!showTimeline)}
          setCopyPopoverOpen={setCopyPopoverOpen}
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
          {/* Queued Prompts Display */}
          <SessionQueuedPrompts
            queuedPrompts={queuedPrompts}
            queuedPromptsCollapsed={queuedPromptsCollapsed}
            onToggleCollapsed={() => setQueuedPromptsCollapsed(!queuedPromptsCollapsed)}
            onRemovePrompt={(id) => setQueuedPrompts(prev => prev.filter(p => p.id !== id))}
          />

          {/* Navigation Arrows - positioned above prompt bar with spacing */}
          {displayableMessages.length > 5 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.5 }}
              className="fixed bottom-32 right-6 z-50"
            >
              <div className="flex items-center bg-background/95 backdrop-blur-md border rounded-full shadow-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Simple scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3 py-2 hover:bg-accent rounded-none"
                  title="Scroll to top"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Simple scroll to bottom
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }}
                  className="px-3 py-2 hover:bg-accent rounded-none"
                  title="Scroll to bottom"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          <div className={cn(
            "fixed bottom-0 left-0 right-0 transition-all duration-300 z-50",
            showTimeline && "sm:right-96"
          )}>
            <FloatingPromptInput
              ref={floatingPromptRef}
              onSend={handleSendPrompt}
              onCancel={handleCancelExecution}
              isLoading={isLoading}
              disabled={!projectPath}
              projectPath={projectPath}
            />
          </div>

          {/* Token Counter - positioned under the Send button */}
          {totalTokens > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
              <div className="max-w-5xl mx-auto">
                <div className="flex justify-end px-4 pb-2">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-background/95 backdrop-blur-md border rounded-full px-3 py-1 shadow-lg pointer-events-auto"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{totalTokens.toLocaleString()}</span>
                      <span className="text-muted-foreground">tokens</span>
                    </div>
                  </motion.div>
                </div>
              </div>
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