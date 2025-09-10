import React, { useState } from "react";
import { motion } from "framer-motion";
import { logger } from "@/lib/logger";
import { DebugLabel } from "@/components/ui/atoms";
import { SESSION_TYPES } from "@/lib/sessionHandleApi";
import { SessionProvider } from "@/contexts/SessionContext";
import { SessionHeader } from "./SessionHeader";
import { SessionMessages } from "./SessionMessages";
import { PromptInput } from "./PromptInput";
import { SessionLoadingState } from "./SessionLoadingState";
import { SessionErrorState } from "./SessionErrorState";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useNativeClaudeSessions } from "@/hooks/useNativeClaudeSessions";
import { useSessionFileWatcher } from "@/hooks/useSessionFileWatcher";
import { useSessionHandle } from "@/hooks/useSessionHandle";
import { useMessageProcessing } from "@/hooks/useMessageProcessing";
import { useStreamingState } from "@/hooks/useStreamingState";
import { useSessionNavigation } from "@/hooks/useSessionNavigation";
import { useThinkingScrollSync } from "@/hooks/useThinkingScrollSync";
import type { Session } from "@/lib/api";

interface SessionDetailProps {
  session: Session;
  projectPath: string;
  onBack: () => void;
  onSessionsDeleted?: () => void;
  onToast?: (message: string, type: "success" | "error") => void;
  tabId?: string; // Tab ID for activity notifications
  isActive?: boolean; // Whether the tab is currently active
  onSetTabActivity?: () => void; // Callback to trigger tab activity flash
}

/**
 * Detailed session view using the new SessionHandle architecture
 * This replaces the complex ClaudeCodeSession with a clean, handle-based approach
 */
export const SessionDetail: React.FC<SessionDetailProps> = ({
  session,
  projectPath,
  onBack,
  onSessionsDeleted,
  onToast,
  tabId,
  isActive = true,
  onSetTabActivity,
}) => {

  // Native Claude session thinking state hook
  const { isSessionThinking, queryInitialSessionState } = useNativeClaudeSessions();

  // Navigation and UI state management
  const navigation = useSessionNavigation();

  // Tool visibility state management
  const [isToolsVisible, setIsToolsVisible] = useState(true);
  const toggleToolsVisibility = () => {
    logger.log("🔧 Toggling tools visibility:", !isToolsVisible);
    setIsToolsVisible(!isToolsVisible);
  };

  // System message visibility state management
  const [isSystemVisible, setIsSystemVisible] = useState(false);
  const toggleSystemVisibility = () => {
    logger.log("⚙️ Toggling system messages visibility:", !isSystemVisible);
    setIsSystemVisible(!isSystemVisible);
  };

  // Assistant filter state management
  const [isAssistantFilterLast, setIsAssistantFilterLast] = useState(false);
  const [toolsVisibilityBeforeAssistant, setToolsVisibilityBeforeAssistant] = useState(true);
  
  const toggleAssistantFilter = () => {
    const newMode = !isAssistantFilterLast;
    logger.log("🤖 Toggling assistant filter mode:", newMode);
    
    if (newMode) {
      // Switching to "last" mode - save current tool visibility and hide tools + system messages
      setToolsVisibilityBeforeAssistant(isToolsVisible);
      setIsToolsVisible(false);
      setIsSystemVisible(false);
    } else {
      // Switching to "all" mode - restore previous tool visibility
      setIsToolsVisible(toolsVisibilityBeforeAssistant);
      setIsSystemVisible(true);
    }
    
    setIsAssistantFilterLast(newMode);
  };

  // Session handle and core state management
  const sessionData = useSessionHandle(session, projectPath, navigation.setIsStreaming);

  // Message processing pipeline
  const messageData = useMessageProcessing(sessionData.messages);

  // Streaming state management
  const streamingData = useStreamingState(sessionData.sessionState, isSessionThinking, queryInitialSessionState);

  // Session file watcher - ensures backend watches this project for file changes
  const projectId = sessionData.sessionState?.project_id;
  useSessionFileWatcher({
    session,
    projectId,
    onSessionChanged: async () => {
      logger.info("📁 Session file changed, refreshing session handle");
      // The session orchestrator will handle the message updates automatically
      
      // Trigger flash animation for blinky-blinky action!
      if (onSetTabActivity && tabId) {
        logger.debug(`Triggering flash animation for session tab ${tabId} (blinky-blinky!)`);
        onSetTabActivity();
      }
    },
    enabled: !!projectId && !!session?.id,
    tabId: session?.id ? `session-handle-${session?.id}` : 'no-session',
  });

  // All streaming state logic is now handled by useStreamingState hook

  // All refs and navigation state are now handled by useSessionNavigation hook

  // All message processing logic is now handled by useMessageProcessing hook

  // All session initialization and management logic is now handled by useSessionHandle hook

  // All navigation handlers are now handled by useSessionNavigation hook

  // All prompt submission logic is now handled by useSessionHandle hook

  // Get computed values from hooks (must be before early returns for hook order)
  const { isReadOnly } = sessionData;
  const { displayableMessages, collapsedMessageUuids, totalTokens, userMessages, toolMessages, assistantMessages, systemMessages, lastInTurnCount } = messageData;
  const { effectiveIsStreaming, thinkingContent } = streamingData;

  // Sync scroll position when thinking state changes (must be before early returns)
  useThinkingScrollSync({
    isThinking: effectiveIsStreaming,
    isPinnedToBottom: navigation.isPinnedToBottom,
    messagesRef: navigation.messagesRef,
    messageCount: displayableMessages.length,
  });

  // Loading state
  if (sessionData.loading) {
    logger.info("🔄 SessionDetail in loading state");
    return <SessionLoadingState />;
  }

  // Error state
  if (sessionData.error) {
    logger.info("❌ SessionDetail in error state:", { error: sessionData.error });
    return <SessionErrorState error={sessionData.error} onBack={onBack} />;
  }

  logger.info("✨ SessionDetail rendering main component:", {
    hasSessionHandle: !!sessionData.sessionHandle,
    hasSessionState: !!sessionData.sessionState,
    hasHandlePromptSubmit: !!sessionData.handlePromptSubmit,
    handlePromptSubmitType: typeof sessionData.handlePromptSubmit,
    displayableMessagesCount: displayableMessages.length,
    rawMessagesCount: sessionData.messages.length,
    isReadOnly,
    totalTokens,
    // DEBUG: Check what we're getting for project data
    "sessionState.project_path": sessionData.sessionState?.project_path,
    "projectPath prop": projectPath,
  });

  return (
    <SessionProvider
      projectId={sessionData.sessionState?.project_id}
      sessionId={sessionData.sessionState?.handle_id}
      sessionFilePath={sessionData.sessionState?.session_file_path || undefined}
      projectPath={sessionData.sessionState?.project_path}
      sessionData={session}
      liveSessionType={sessionData.sessionState?.session_type.type}
      isStreaming={effectiveIsStreaming}
      userMessages={userMessages}
      toolMessages={toolMessages}
      assistantMessages={assistantMessages}
      systemMessages={systemMessages}
      lastInTurnCount={lastInTurnCount}
      isToolsVisible={isToolsVisible}
      isSystemVisible={isSystemVisible}
      isAssistantFilterLast={isAssistantFilterLast}
      toggleToolsVisibility={toggleToolsVisibility}
      toggleSystemVisibility={toggleSystemVisibility}
      toggleAssistantFilter={toggleAssistantFilter}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full relative"
      >
        <DebugLabel label="SessionDetail" />

        <SessionHeader
          claudeSessionId={sessionData.sessionState?.current_claude_session_id || null}
          claudioId={
            sessionData.sessionState?.session_type.type === SESSION_TYPES.CLAUDIO
              ? (sessionData.sessionState?.session_type.data as any)?.claudio_id
              : null
          }
          totalTokens={totalTokens}
          hasMessages={displayableMessages.length > 0}
          onBack={onBack}
          onExportAsJson={() =>
            logger.info("Export as JSON (not implemented yet)")
          }
          onExportAsMarkdown={() =>
            logger.info("Export as Markdown (not implemented yet)")
          }
          isReadOnly={isReadOnly}
          displayableMessageCount={displayableMessages.length}
          collapsedMessageUuids={collapsedMessageUuids}
          onNavigateToMessage={navigation.navigateToMessage}
        />

        <div className="flex-1 flex flex-col min-h-0">
          <SessionMessages
            ref={navigation.messagesRef}
            displayableMessages={displayableMessages}
            messages={sessionData.messages}
            isLoading={effectiveIsStreaming}
            error={sessionData.error}
            onPinnedStateChange={navigation.setIsPinnedToBottom}
            showNavigation={displayableMessages.length > 0}
          />

          <ThinkingIndicator content={thinkingContent} />

          {!isReadOnly && (
            <PromptInput
              onSend={sessionData.handlePromptSubmit}
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
