import React from "react";
import { motion } from "framer-motion";
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
  const [todoData, setTodoData] = React.useState(getTodoData(session.id));
  
  // Fetch todo data on mount if not in context
  React.useEffect(() => {
    const fetchTodoData = async () => {
      const contextData = getTodoData(session.id);
      if (contextData) {
        setTodoData(contextData);
        return;
      }
      
      try {
        logger.debug(`🔍 Fetching todos for session ${session.id}`);
        const { invoke } = await import('@tauri-apps/api/core');
        const data = await invoke<SessionTodoData>('get_session_todos', { sessionId: session.id });
        
        logger.debug(`📝 Backend returned todo data for ${session.id}:`, data);
        
        if (data && data.total_counts && data.total_counts.total > 0) {
          logger.debug(`📋 Found todos for session ${session.id}: ${data.total_counts.completed}/${data.total_counts.total}`);
          setTodoData(data);
          setSessionTodos(session.id, data);
        } else {
          logger.debug(`📭 Session ${session.id} has no todos (total: ${data?.total_counts?.total || 0})`);
        }
      } catch (error) {
        logger.debug(`❌ Error fetching todos for session ${session.id}:`, error);
      }
    };
    
    fetchTodoData();
  }, [session.id, getTodoData, setSessionTodos]);
  
  // Update when context changes (from events)
  React.useEffect(() => {
    const contextData = getTodoData(session.id);
    if (contextData) {
      setTodoData(contextData);
    }
  }, [getTodoData, session.id]);

  return (
    <motion.div
      key={session.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-0 py-0"
    >
      <div
        className={cn(
          "group relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer min-h-[80px]",
          className,
        )}
        onClick={() => {
          logger.log('🎯 SessionCard clicked for session:', session.id);
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
              {session.live_session_type && (
                <Badge
                  variant="outline"
                  className="text-xs text-accent border-accent"
                >
                  {session.live_session_type.toLowerCase()}
                </Badge>
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
              className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
