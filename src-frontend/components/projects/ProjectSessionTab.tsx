import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MessageSquare,
  MessagesSquare,
  HardDrive,
  Trash2,
  Activity,
  ChevronUp,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  formatUnixTimestamp,
  formatFileSize,
  formatTimeAgo,
} from "@/lib/date-utils";
import type { Session, DecoratedSession } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";
import { Badge } from "@/components/ui/badge";
import { SessionDeleteDialog } from "./SessionDeleteDialog";
import { useSessionListWatcher } from "@/hooks";

interface ProjectSessionTabProps {
  sessions: DecoratedSession[];
  projectId: string;
  projectName: string;
  onSessionClick?: (session: DecoratedSession) => void;
  onSessionDelete?: (session: DecoratedSession) => void;
  onStartNewSession?: () => void;
  onSessionsDeleted?: (result?: {
    sessions_deleted: number;
    todos_deleted: number;
    size_freed_mb: number;
  }) => void;
  onSessionsRefresh?: () => void;
  onToast?: (message: string, type: "success" | "error") => void;
  sessionsLoading?: boolean;
  className?: string;
}

export const ProjectSessionTab: React.FC<ProjectSessionTabProps> = ({
  sessions,
  projectId,
  projectName,
  onSessionClick,
  onSessionDelete,
  onStartNewSession,
  onSessionsDeleted,
  onSessionsRefresh,
  onToast,
  sessionsLoading,
  className,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ start: 0, end: 0 });
  const [containerHeight, setContainerHeight] = useState(600);
  const [showSessionDeleteDialog, setShowSessionDeleteDialog] = useState(false);

  // Watch for session file changes
  const handleSessionListChanged = async () => {
    logger.debug(
      `Session files changed for project ${projectId}, refreshing sessions...`,
    );
    // Trigger parent to refresh sessions data smoothly
    onSessionsRefresh?.();
  };

  // Debug: Log component mount and sessions
  useEffect(() => {
    logger.log(`🚀 ProjectSessionTab MOUNTED at ${new Date().toISOString()}`);
  }, []);

  useEffect(() => {
    logger.log(
      `📊 ProjectSessionTab: Sessions count: ${sessions.length} at ${new Date().toISOString()}`,
    );
    if (sessions.length > 0) {
      logger.log(`📊 First session:`, sessions[0]);

      // Debug: Log all live sessions
      const liveSessions = sessions.filter((s) => s.live_session_type);
      if (liveSessions.length > 0) {
        logger.log(`🔥 Found ${liveSessions.length} live sessions:`);
        liveSessions.forEach((session, index) => {
          logger.log(`🔥 Live session ${index + 1}:`, {
            id: session.id,
            live_session_type: session.live_session_type,
            first_message: session.first_message?.substring(0, 50) + "...",
          });
        });
      } else {
        logger.log(`⚠️ No live sessions found in ${sessions.length} sessions`);
      }
    }
  }, [sessions]);

  useSessionListWatcher(
    projectId,
    handleSessionListChanged,
    true, // enabled
  );

  // Calculate container height based on actual position
  useEffect(() => {
    const calculateHeight = () => {
      if (!scrollContainerRef.current) return;

      const rect = scrollContainerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - rect.top - 20; // 20px padding from bottom

      setContainerHeight(Math.max(200, availableHeight)); // Minimum 200px
    };

    calculateHeight();
    window.addEventListener("resize", calculateHeight);

    // Recalculate when component mounts or sessions change
    const timeoutId = setTimeout(calculateHeight, 100);

    return () => {
      logger.log("ProjectSessionTab: Cleaning up height calculation listeners");
      window.removeEventListener("resize", calculateHeight);
      clearTimeout(timeoutId);
    };
  }, [sessions.length]);

  // Handle scroll position changes
  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    const handleScroll = () => {
      setShowScrollTop(element.scrollTop > 200);

      // Calculate approximate visible range (rough estimate)
      const itemHeight = 80; // approximate height per session card
      const scrollTop = element.scrollTop;
      const containerHeight = element.clientHeight;

      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        Math.ceil((scrollTop + containerHeight) / itemHeight),
        sessions.length - 1,
      );

      const start = Math.max(1, startIndex + 1); // 1-based
      const end = Math.min(endIndex + 1, sessions.length);
      setScrollPosition({ start, end });
    };

    element.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial position

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [sessions.length]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSessionsDeleted = (result: {
    sessions_deleted: number;
    todos_deleted: number;
    timelines_deleted: number;
    size_freed_mb: number;
    sessions_remaining: number;
  }) => {
    // Show success toast
    const message = `Deleted ${result.sessions_deleted} session${result.sessions_deleted !== 1 ? "s" : ""}, ${result.todos_deleted} todo file${result.todos_deleted !== 1 ? "s" : ""}, freed ${result.size_freed_mb.toFixed(2)} MB`;
    onToast?.(message, "success");

    // Notify parent to refresh sessions
    onSessionsDeleted?.();
  };

  if (sessions.length === 0) {
    return (
      <Card className="relative">
        <DebugLabel label="ProjectSessionTab" />
        <CardContent className="p-6">
          <motion.div
            key={sessionsLoading ? "loading-sessions" : "no-sessions"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            {sessionsLoading ? (
              <>
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <p className="text-muted-foreground mb-2">
                  Loading sessions...
                </p>
                <p className="text-sm text-muted-foreground/70">
                  This should only take a moment
                </p>
              </>
            ) : (
              <>
                <MessagesSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No sessions found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a new Claude Code session in this project to see it
                  here.
                </p>
                <Button onClick={onStartNewSession} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Start New Session
                </Button>
              </>
            )}
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative flex flex-col h-full">
      <DebugLabel label="ProjectSessionTab" />

      <CardContent className="p-0 flex flex-col flex-1">
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-accent">
                Sessions
              </h3>
              <p className="text-sm text-muted-foreground">
                Browse and manage Claude Code sessions for this project.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onStartNewSession} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Start New Session
              </Button>

              <Button
                onClick={() => setShowSessionDeleteDialog(true)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Delete Sessions"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Scroll position counter */}
          <div className="flex justify-end">
            <div className="bg-muted px-3 py-1 rounded-lg text-xs text-muted-foreground">
              {scrollPosition.start === scrollPosition.end
                ? `${scrollPosition.start} of ${sessions.length}`
                : `${scrollPosition.start}-${scrollPosition.end} of ${sessions.length}`}
            </div>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="overflow-auto p-6 pt-0"
          style={{
            contain: "strict",
            height: `${containerHeight}px`,
          }}
        >
          <div className="space-y-3">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-0 py-0"
              >
                <div
                  className={cn(
                    "group flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer min-h-[80px]",
                    className,
                  )}
                  onClick={() => onSessionClick?.(session)}
                >
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
                          {session.first_message || "Untitled Session"}
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
                            <span>
                              {formatTimeAgo(session.modified_at * 1000)}
                            </span>
                          </div>
                        )}
                        {session.size_bytes !== undefined && (
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            <span>{formatFileSize(session.size_bytes)}</span>
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
                        disabled={session.live_session_type === "NATIVE"}
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
            ))}
          </div>
        </div>

        {/* Scroll to top button */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-4 right-4"
            >
              <Button
                onClick={scrollToTop}
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full shadow-lg"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {/* Session Delete Dialog */}
      <SessionDeleteDialog
        open={showSessionDeleteDialog}
        onOpenChange={setShowSessionDeleteDialog}
        projectId={projectId}
        projectName={projectName}
        onSessionsDeleted={handleSessionsDeleted}
      />
    </Card>
  );
};
