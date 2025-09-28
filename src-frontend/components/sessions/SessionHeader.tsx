import React from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  MessagesSquare,
  FolderOpen,
  Hash,
  Clock,
  Activity,
  HardDrive,
  MessageSquare,
  ArrowUpFromLine,
  ArrowDownToLine,
  Download as LucideDownload,
  MoreVertical,
  Brain,
  ListTodo,
  LogOut,
  LogIn,
  Bell,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatTimeAgo,
  formatFileSize,
} from "@/lib/date-utils";
import { getSessionTitle, formatSessionIdCompact } from "@/lib/sessionUtils";
import type { Session } from "@/lib/api";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useSessionContext } from "@/contexts/SessionContext";
import { useTodoContext } from "@/contexts/TodoContext";
import { SESSION_TYPES } from "@/lib/sessionHandleApi";
import { UserMessageNavigation } from "./UserMessageNavigation";
import { CwdNavigation } from "./CwdNavigation";
import { InProgressTodoWidget } from "./InProgressTodoWidget";
import { ToolFilter } from "./ToolFilter";
import { SystemFilter } from "./SystemFilter";
import { AssistantMessageFilter } from "./AssistantMessageFilter";

interface SessionHeaderProps {
  claudeSessionId: string | null;
  // Claudio session ID for display
  claudioId?: string | null;
  totalTokens: number;
  hasMessages: boolean;
  onBack: () => void;
  onExportAsJson: () => void;
  onExportAsMarkdown: () => void;
  isReadOnly?: boolean;
  onDeleteProject?: () => void;
  // Current displayable message count (computed in UI)
  displayableMessageCount?: number;
  // List of UUIDs for filtered/collapsed messages
  collapsedMessageUuids?: string[];
  // Refresh state
  isRefreshing?: boolean;
  // Navigation
  onNavigateToMessage?: (messageIndex: number) => void;
  // Session updates
  onSessionResumed?: (claudioId: string) => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  claudeSessionId,
  claudioId,
  totalTokens,
  hasMessages,
  onBack,
  onExportAsJson,
  onExportAsMarkdown,
  isReadOnly = false,
  onDeleteProject,
  displayableMessageCount,
  collapsedMessageUuids,
  isRefreshing,
  onNavigateToMessage,
  onSessionResumed,
}) => {
  const {
    liveSessionType,
    isStreaming,
    projectPath,
    sessionId,
    sessionData,
    sessionFilePath,
  } = useSessionContext();

  const { getTodoData, loadSessionTodos } = useTodoContext();

  // Get todo data from TodoContext instead of sessionData
  const todoData = sessionId ? getTodoData(sessionId) : null;

  // Helper function to determine session status based on available data
  const getSessionStatus = React.useCallback(() => {
    // TODO: Replace with actual status detection from backend hooks
    // For now, we'll use the default thinking status for all streaming states

    // In the future, this could check:
    // - Hook-based status from session file parsing
    // - Specific streaming events (notification, compact, etc.)
    // - Tool execution states

    return {
      type: 'thinking' as const,
      message: 'thinking',
      icon: Brain
    };
  }, []);

  // Helper function to get status-specific display info
  const getStatusDisplay = React.useCallback((statusType: string, message: string) => {
    switch (statusType.toLowerCase()) {
      case 'notification':
        return {
          type: 'notification' as const,
          message: 'handling notifications',
          icon: Bell
        };
      case 'compact':
        return {
          type: 'compact' as const,
          message: 'compacting session',
          icon: Archive
        };
      case 'active':
        return {
          type: 'thinking' as const,
          message: message || 'thinking',
          icon: Brain
        };
      default:
        return {
          type: 'thinking' as const,
          message: message || 'thinking',
          icon: Brain
        };
    }
  }, []);

  // State for session status display
  const [sessionStatus, setSessionStatus] = React.useState<{
    type: 'thinking' | 'notification' | 'compact';
    message: string;
    icon: React.ComponentType<{ className?: string }>;
  }>({
    type: 'thinking',
    message: 'thinking',
    icon: Brain
  });

  // Fetch session status content when streaming starts
  React.useEffect(() => {
    if (
      isStreaming &&
      (liveSessionType === SESSION_TYPES.NATIVE ||
        liveSessionType === SESSION_TYPES.CLAUDIO)
    ) {
      const fetchStatusContent = async () => {
        try {
          // Get current session status info
          const currentStatus = getSessionStatus();

          // For thinking status, fetch random thinking content
          if (currentStatus.type === 'thinking') {
            const [title, _message] = await invoke<[string, string]>(
              "get_random_thinking_content",
            );
            setSessionStatus({
              type: 'thinking',
              message: title, // Use the actual random message!
              icon: Brain
            });
            logger.debug("Fetched thinking content:", title);
          } else {
            // For other statuses, use the predefined messages
            setSessionStatus(currentStatus);
            logger.debug("Using session status:", currentStatus);
          }
        } catch (error) {
          logger.error("Failed to fetch session status:", error);
          // Keep default status on error
          setSessionStatus(getStatusDisplay('active', 'thinking'));
        }
      };

      fetchStatusContent();
    } else if (!isStreaming) {
      // Reset to idle state when not streaming
      setSessionStatus(getStatusDisplay('idle', 'idle'));
    }
  }, [isStreaming, liveSessionType, getSessionStatus, getStatusDisplay]);

  // Debug: Log the streaming state
  React.useEffect(() => {
    if (liveSessionType === SESSION_TYPES.NATIVE) {
      logger.log("Native session status:", {
        liveSessionType,
        isStreaming,
        sessionId: sessionId?.substring(0, 8)
      });
    }
  }, [isStreaming, liveSessionType, sessionId, hasMessages, sessionStatus]);

  // Debug: Log TodoContext data instead of sessionData

  // Load fresh todo data when sessionId changes
  React.useEffect(() => {
    if (sessionId) {
      loadSessionTodos(sessionId);
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopySessionInfo = React.useCallback(async () => {
    // Copy session metadata JSON structure
    if (sessionData && sessionFilePath) {
      try {
        const sessionInfo = {
          project: sessionData.project_id,
          session: sessionData.id,
          project_path: projectPath,
          session_path: sessionFilePath,
        };
        const sessionJson = JSON.stringify(sessionInfo, null, 2);
        await navigator.clipboard.writeText(sessionJson);
      } catch (error) {
        logger.error("Failed to copy session info:", error);
      }
    } else if (collapsedMessageUuids && collapsedMessageUuids.length > 0) {
      // Fallback to UUIDs if session data is incomplete
      try {
        const uuidList = collapsedMessageUuids.join("\n");
        await navigator.clipboard.writeText(uuidList);
      } catch (error) {
        logger.error("Failed to copy UUID list:", error);
      }
    }
  }, [sessionData, sessionFilePath, projectPath, collapsedMessageUuids]);

  const handleExitClaudioSession = React.useCallback(async () => {
    if (!sessionId || !projectPath) {
      logger.error("Cannot exit session: missing sessionId or projectPath");
      return;
    }

    try {
      const result = await api.deleteClaudioSession(sessionId, projectPath);

      // Navigate back to project view since session is now archived
      onBack();
    } catch (error) {
      logger.error("Failed to exit Claudio session:", error);
    }
  }, [sessionId, projectPath, onBack]);

  const handleResumeClaudioSession = React.useCallback(async () => {
    if (!sessionId || !projectPath) {
      logger.error("Cannot resume session: missing sessionId or projectPath");
      return;
    }

    try {
      const claudio_id = await api.resumeClaudioSession(sessionId, projectPath);
      logger.log("Successfully resumed archived session:", claudio_id);

      // Call the parent callback with the new claudio_id to update the session
      if (onSessionResumed && claudio_id) {
        onSessionResumed(claudio_id);
      } else {
        // Fallback to page reload if no callback provided
        window.location.reload();
      }
    } catch (error) {
      logger.error("Failed to resume archived session:", error);
    }
  }, [sessionId, projectPath, onSessionResumed]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background border-b px-4 py-3 sticky top-0 z-40"
    >
      <DebugLabel label="SessionHeader" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-accent">
              Claude Code Session
            </h1>
            {sessionData && (
              <p className="text-lg font-bold text-muted-foreground truncate">
                {getSessionTitle(sessionData)}
              </p>
            )}
            {projectPath && (
              <div className="mt-1">
                <CwdNavigation
                  onNavigate={onNavigateToMessage || (() => {})}
                />
              </div>
            )}

            {/* Session metadata */}
            {(sessionData || claudioId) && (
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4 flex-wrap">
                  {claudeSessionId !== undefined && (
                    <div
                      className="flex items-center gap-1 bg-accent px-2 py-1 rounded-full font-mono cursor-pointer hover:bg-accent/80 transition-colors"
                      onClick={handleCopySessionInfo}
                      title={`Click to copy session metadata JSON`}
                    >
                      {formatSessionIdCompact(claudeSessionId)}
                    </div>
                  )}
                  {displayableMessageCount !== undefined &&
                    displayableMessageCount > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{displayableMessageCount}</span>
                      </div>
                    )}
                  {totalTokens > 0 && (
                    <div className="flex items-center gap-0.5">
                      <ArrowUpFromLine className="h-3 w-3" />
                      <span>{totalTokens.toLocaleString()} tokens</span>
                    </div>
                  )}
                  {sessionData?.size_bytes !== undefined && (
                    <div className="flex items-center gap-0.5">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatFileSize(sessionData.size_bytes)}</span>
                    </div>
                  )}
                  {todoData?.total_counts &&
                    todoData.total_counts.total > 0 && (
                      <div className="flex items-center gap-1">
                        <ListTodo className="h-3 w-3" />
                        <span>
                          {todoData.total_counts.completed}/
                          {todoData.total_counts.total}
                        </span>
                      </div>
                    )}
                  {sessionData && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatUnixTimestamp(sessionData.created_at)}</span>
                    </div>
                  )}
                  {sessionData?.modified_at && (
                    <div
                      className={cn(
                        "flex items-center gap-1 transition-colors duration-200",
                        isRefreshing && "text-accent animate-pulse",
                      )}
                    >
                      <Activity className="h-3 w-3" />
                      <span>
                        {formatTimeAgo(sessionData.modified_at * 1000)}
                      </span>
                    </div>
                  )}
                  {liveSessionType && (
                    <Badge
                      variant="outline"
                      className="text-xs text-accent border-accent"
                    >
                      {liveSessionType.toLowerCase()}
                    </Badge>
                  )}
                  {isStreaming && (
                    <div className="flex items-center gap-1 text-accent animate-pulse">
                      <sessionStatus.icon className="h-3 w-3" />
                      <span className="text-s">
                        Claude is {sessionStatus.message}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control bar with navigation, todos, and actions */}
      <div className="flex relative items-center justify-between mt-3 pt-2">
        <DebugLabel label="ControlBar" />
        {/* Left section: User navigation */}
        <div className="flex items-center gap-1">
          <UserMessageNavigation
            onNavigate={onNavigateToMessage || (() => {})}
          />
          <InProgressTodoWidget
            todos={todoData?.agent_todos.flatMap((agent) => agent.todos) || []}
          />
          <AssistantMessageFilter />
          <ToolFilter />
          <SystemFilter />
        </div>

        {/* Center section: In-progress todo */}
        <div className="flex-1 flex justify-center"></div>

        {/* Right section: View controls and actions */}
        <div className="flex items-center gap-1">
          {/* Export menu - only show if we have messages and not streaming */}
          {hasMessages && !isStreaming && claudeSessionId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExportAsJson}>
                  <LucideDownload className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportAsMarkdown}>
                  <LucideDownload className="h-4 w-4 mr-2" />
                  Export as Markdown
                </DropdownMenuItem>
                {/* Exit Session - only show for CLAUDIO sessions */}
                {liveSessionType === SESSION_TYPES.CLAUDIO && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExitClaudioSession}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Exit Session
                    </DropdownMenuItem>
                  </>
                )}
                {/* Resume Session - only show for ARCHIVED sessions */}
                {liveSessionType === SESSION_TYPES.ARCHIVED && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleResumeClaudioSession}>
                      <LogIn className="h-4 w-4 mr-2" />
                      Resume Session
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </motion.div>
  );
};
