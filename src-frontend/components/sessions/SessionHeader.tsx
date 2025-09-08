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
  UnfoldVertical,
  Brain,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { logger } from "@/lib/logger";
import { useSessionContext } from "@/contexts/SessionContext";
import { useTodoContext } from "@/contexts/TodoContext";
import { SESSION_TYPES } from "@/lib/sessionHandleApi";
import { UserMessageNavigation } from "./UserMessageNavigation";
import { InProgressTodoWidget } from "./InProgressTodoWidget";

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
}) => {
  const {
    liveSessionType,
    isStreaming,
    projectPath,
    sessionId,
    sessionData,
    sessionFilePath,
    isCompactMode,
    toggleCompactMode,
  } = useSessionContext();

  const { getTodoData, loadSessionTodos } = useTodoContext();

  // Get todo data from TodoContext instead of sessionData
  const todoData = sessionId ? getTodoData(sessionId) : null;

  // State for random thinking content
  const [thinkingTitle, setThinkingTitle] = React.useState(
    "Claude is thinking...",
  );

  // Fetch random thinking content when streaming starts
  React.useEffect(() => {
    if (isStreaming && liveSessionType === SESSION_TYPES.NATIVE) {
      const fetchThinkingContent = async () => {
        try {
          const [title, _message] = await invoke<[string, string]>(
            "get_random_thinking_content",
          );
          setThinkingTitle(title);
          logger.debug("🧠 Fetched random thinking title:", title);
        } catch (error) {
          logger.error("Failed to fetch thinking content:", error);
          // Keep default title on error
        }
      };

      fetchThinkingContent();
    }
  }, [isStreaming, liveSessionType]);

  // Debug: Log the streaming state
  React.useEffect(() => {
    if (liveSessionType === SESSION_TYPES.NATIVE) {
      logger.log("🧠 Native session brain debug:", {
        liveSessionType,
        isStreaming,
        sessionId: sessionId?.substring(0, 8),
        hasMessages,
      });
    }
  }, [isStreaming, liveSessionType, sessionId, hasMessages]);

  // Debug: Log TodoContext data instead of sessionData
  React.useEffect(() => {
    if (sessionId) {
      const widgetTodos = todoData?.agent_todos.flatMap((agent) => agent.todos) || [];
      logger.log("🎯 SessionHeader TodoContext debug:", {
        sessionId: sessionId?.substring(0, 8),
        hasTodoData: !!todoData,
        todoData: todoData,
        totalCounts: todoData?.total_counts,
        agentCount: todoData?.agent_todos?.length || 0,
        widgetTodosLength: widgetTodos.length,
        widgetTodos: widgetTodos,
        inProgressTodos:
          todoData?.agent_todos?.flatMap(
            (agent) =>
              agent.todos?.filter((todo) => todo.status === "in_progress") ||
              [],
          ).length || 0,
      });
    }
  }, [sessionId, todoData]);

  // Load fresh todo data when sessionId changes
  React.useEffect(() => {
    if (sessionId) {
      logger.info(`🔄 SessionHeader: Loading todos for session ${sessionId}`);
      loadSessionTodos(sessionId);
    }
  }, [sessionId, loadSessionTodos]);

  const handleCopySessionInfo = async () => {
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
        logger.log("Copied session info JSON to clipboard:", sessionInfo);
      } catch (error) {
        logger.error("Failed to copy session info:", error);
      }
    } else if (collapsedMessageUuids && collapsedMessageUuids.length > 0) {
      // Fallback to UUIDs if session data is incomplete
      try {
        const uuidList = collapsedMessageUuids.join("\n");
        await navigator.clipboard.writeText(uuidList);
        logger.log(
          `Copied ${collapsedMessageUuids.length} collapsed message UUIDs to clipboard`,
        );
      } catch (error) {
        logger.error("Failed to copy UUID list:", error);
      }
    }
  };

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
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="font-mono truncate">{projectPath}</span>
              </p>
            )}

            {/* Session metadata */}
            {(sessionData || claudioId) && (
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
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
                      <Brain className="h-3 w-3 " />
                      <span className="text-s">
                        Claude is {thinkingTitle}...
                      </span>
                    </div>
                  )}
                </div>
                {claudioId && (
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    <span className="font-mono text-xs">{claudioId}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control bar with navigation, todos, and actions */}
      <div className="flex relative items-center justify-between mt-3 pt-2 border-t border-border/50">
        <DebugLabel label="ControlBar" />
        {/* Left section: User navigation */}
        <div className="flex items-center gap-2">
          {hasMessages && (
            <UserMessageNavigation
              onNavigate={onNavigateToMessage || (() => {})}
            />
          )}
          <InProgressTodoWidget
            todos={todoData?.agent_todos.flatMap((agent) => agent.todos) || []}
          />
        </div>

        {/* Center section: In-progress todo */}
        <div className="flex-1 flex justify-center"></div>

        {/* Right section: View controls and actions */}
        <div className="flex items-center gap-1">
          {/* Compact mode toggle */}
          {toggleCompactMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCompactMode}
              className={cn(
                "h-8 w-8 transition-colors",
                isCompactMode
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
              title={
                isCompactMode ? "Show content excerpts" : "Header-only mode"
              }
            >
              <UnfoldVertical className="h-4 w-4" />
            </Button>
          )}

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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </motion.div>
  );
};
