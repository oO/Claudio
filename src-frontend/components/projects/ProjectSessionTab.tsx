import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Clock,
  MessageSquare,
  MessagesSquare,
  HardDrive,
  ListChecks,
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
  formatISOTimestamp,
  truncateText,
  getFirstLine,
  formatFileSize,
  formatTimeAgo,
} from "@/lib/date-utils";
import type { Session, DecoratedSession } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";
import { Badge } from "@/components/ui/badge";
import { SessionDeleteDialog } from "./SessionDeleteDialog";
import { isEditorSession } from "@/lib/sessionUtils";

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
  onToast?: (message: string, type: "success" | "error") => void;
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
  onToast,
  className,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ start: 0, end: 0 });
  const [containerHeight, setContainerHeight] = useState(600);
  const [showSessionDeleteDialog, setShowSessionDeleteDialog] = useState(false);

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Reduced height for more compact cards
    overscan: 5, // Keep 5 items rendered outside of view
  });

  // Calculate container height based on actual position
  useEffect(() => {
    const calculateHeight = () => {
      if (!parentRef.current) return;

      const rect = parentRef.current.getBoundingClientRect();
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
  }, [sessions.length, virtualizer]);

  // Update scroll position and show scroll to top button
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const handleScroll = () => {
      setShowScrollTop(element.scrollTop > 200);

      // Calculate visible range based on virtual items
      const virtualItems = virtualizer.getVirtualItems();
      if (virtualItems.length > 0) {
        const start = virtualItems[0].index + 1; // 1-based indexing for display
        const end = Math.min(
          virtualItems[virtualItems.length - 1].index + 1,
          sessions.length,
        );
        setScrollPosition({ start, end });
      }
    };

    element.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial position
    return () => {
      logger.log("ProjectSessionTab: Cleaning up scroll listeners");
      element.removeEventListener("scroll", handleScroll);
    };
  }, [virtualizer, sessions.length]);

  const scrollToTop = () => {
    parentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
            key="no-sessions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <MessagesSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No sessions found
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start a new Claude Code session in this project to see it here.
            </p>
            <Button onClick={onStartNewSession} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Start New Session
            </Button>
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
          ref={parentRef}
          className="overflow-auto p-6 pt-0"
          style={{
            contain: "strict",
            height: `${containerHeight}px`,
          }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const session = sessions[virtualRow.index];
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-0 py-1.5"
                >
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer h-full",
                      className,
                    )}
                    onClick={() => onSessionClick?.(session)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <MessagesSquare
                          className={cn(
                            "h-5 w-5",
                            session.claudio
                              ? "text-accent"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
                          {isEditorSession(session) && (
                            <Badge
                              variant="default"
                              className="text-xs bg-green-600 hover:bg-green-700 flex-shrink-0"
                            >
                              Live
                            </Badge>
                          )}
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
                          {(session as any).claudio && (
                            <Badge
                              variant="outline"
                              className="text-xs text-accent border-accent/50"
                            >
                              Live
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onSessionDelete?.(session);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
