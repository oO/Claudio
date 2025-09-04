import React from "react";
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
import type { Session } from "@/lib/api";

interface SessionDetailProps {
  session: Session;
  projectPath: string;
  onBack: () => void;
  onSessionsDeleted?: () => void;
  onToast?: (message: string, type: "success" | "error") => void;
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
}) => {
  // DEBUG: Test if logging works at all
  logger.info(
    "🚀 SessionDetail mounting with session:",
    session?.id,
    "projectPath:",
    projectPath,
    "session object structure:",
    session
  );

  // Native Claude session thinking state hook
  const { isSessionThinking, queryInitialSessionState } = useNativeClaudeSessions();

  // Navigation and UI state management
  const navigation = useSessionNavigation();

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

  // Get computed values from hooks
  const { isReadOnly } = sessionData;
  const { displayableMessages, collapsedMessageUuids, totalTokens } = messageData;
  const { effectiveIsStreaming, thinkingContent } = streamingData;

  logger.info("✨ SessionDetail rendering main component:", {
    hasSessionHandle: !!sessionData.sessionHandle,
    hasSessionState: !!sessionData.sessionState,
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
      isCompactMode={navigation.isCompactMode}
      setIsCompactMode={navigation.setIsCompactMode}
      toggleCompactMode={navigation.toggleCompactMode}
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
          showTimeline={false}
          copyPopoverOpen={false}
          onBack={onBack}
          onExportAsJson={() =>
            logger.info("Export as JSON (not implemented yet)")
          }
          onExportAsMarkdown={() =>
            logger.info("Export as Markdown (not implemented yet)")
          }
          onToggleTimeline={() =>
            logger.info("Toggle timeline (not implemented yet)")
          }
          isReadOnly={isReadOnly}
          setCopyPopoverOpen={() => {}}
          displayableMessageCount={displayableMessages.length}
          collapsedMessageUuids={collapsedMessageUuids}
          showNavigation={displayableMessages.length > 0}
          isPinnedToBottom={navigation.isPinnedToBottom}
          onScrollToTop={navigation.handleScrollToTop}
          onScrollToBottom={navigation.handleScrollToBottom}
        />

        <div className="flex-1 flex flex-col min-h-0">
          <SessionMessages
            ref={navigation.messagesRef}
            displayableMessages={displayableMessages}
            messages={sessionData.messages}
            isLoading={effectiveIsStreaming}
            error={sessionData.error}
            onPinnedStateChange={navigation.setIsPinnedToBottom}
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
