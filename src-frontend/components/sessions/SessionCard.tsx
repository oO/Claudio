import React from "react";
import {
  Clock,
  MessageSquare,
  MessagesSquare,
  HardDrive,
  Trash2,
  Activity,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DebugLabel } from "@/components/ui/atoms";
import { useTodoContext } from "@/contexts/TodoContext";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatFileSize,
  formatTimeAgo,
} from "@/lib/date-utils";
import { getSessionTitle } from "@/lib/sessionUtils";
import type { DecoratedSession, SessionTodoData } from "@/lib/api";
import { SESSION_TYPES } from "@/lib/sessionHandleApi";
import { logger } from "@/lib/logger";
import { useTabState } from "@/hooks/useTabState";

interface SessionCardProps {
  session: DecoratedSession;
  onSessionClick?: (session: DecoratedSession) => void;
  onSessionDelete?: (session: DecoratedSession) => void;
  className?: string;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onSessionClick,
  onSessionDelete,
  className,
}) => {
  // Get todo data from context and fetch if not available
  const { getTodoData, setSessionTodos } = useTodoContext();
  const { createSessionTab } = useTabState();
  const [todoData, setTodoData] = React.useState(getTodoData(session.id));

  // Consolidated todo data fetching and context updates
  React.useEffect(() => {
    const fetchTodoData = async () => {
      // Check context first
      const contextData = getTodoData(session.id);
      if (contextData) {
        setTodoData(contextData);
        return;
      }

      // Fetch from backend if not in context
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const data = await invoke<SessionTodoData>("get_session_todos", {
          sessionId: session.id,
        });

        if (data && data.total_counts && data.total_counts.total > 0) {
          setTodoData(data);
          setSessionTodos(session.id, data);
        }
      } catch (error) {
        logger.error('Failed to fetch todo data for session:', session.id, error);
      }
    };

    fetchTodoData();
  }, [session.id, getTodoData, setSessionTodos]);

  return (
    <div
        className={cn(
          "group relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer min-h-[80px]",
          className,
        )}
        onClick={(event) => {
          // Handle Cmd+click (Mac) or Ctrl+click (Windows/Linux) directly
          if (event.metaKey || event.ctrlKey) {
            createSessionTab(session.project_path, undefined, session.id);
            return; // Don't call onSessionClick for modifier clicks
          }

          // Normal click - call the provided callback
          onSessionClick?.(session);
        }}
      >
        <DebugLabel label="SessionCard" />
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 p-2">
            <MessagesSquare
              className={cn(
                "h-5 w-5",
                session.live_session_type
                  ? "text-accent"
                  : "text-muted-foreground",
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <p
                className="text-sm font-medium leading-tight flex-1"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                }}
              >
                {getSessionTitle(session)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  !session.live_session_type
                    ? "text-muted-foreground border-muted-foreground"
                    : "text-accent border-accent",
                )}
              >
                {session.live_session_type?.toLowerCase() || "archived"}
              </Badge>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {session.created_at
                    ? formatUnixTimestamp(session.created_at)
                    : "Unknown"}
                </span>
              </div>
              {session.modified_at && (
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>{formatTimeAgo(session.modified_at * 1000)}</span>
                </div>
              )}
              {session.size_bytes !== undefined && (
                <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  <span>{formatFileSize(session.size_bytes)}</span>
                </div>
              )}
              {todoData && todoData.total_counts.total > 0 && (
                <div className="flex items-center gap-1">
                  <ListTodo className="h-3 w-3" />
                  <span>
                    {todoData.total_counts.completed}/
                    {todoData.total_counts.total}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Message count badge */}
          {session.message_count !== undefined && (
            <div className="flex items-center gap-1 bg-accent px-2 py-1 rounded-full text-xs">
              <MessageSquare className="h-3 w-3" />
              <span>{session.message_count}</span>
            </div>
          )}

          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              disabled={session.live_session_type === SESSION_TYPES.NATIVE}
              onClick={(e) => {
                e.stopPropagation();
                onSessionDelete?.(session);
              }}
              className="h-6 w-6 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
  );
};
