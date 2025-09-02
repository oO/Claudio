import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessagesSquare,
  Activity,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import type { DecoratedSession } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";
import { SessionDeleteDialog } from "./SessionDeleteDialog";
import { SessionCard } from "@/components/sessions/SessionCard";
import { useSessionListWatcher } from "@/hooks";
import { SESSION_TYPES } from "@/lib/sessionHandleApi";

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

  // Session type filters state with localStorage persistence
  const [showRegularSessions, setShowRegularSessions] = useState(() => {
    const saved = localStorage.getItem('claudio-session-filters-regular');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showNativeSessions, setShowNativeSessions] = useState(() => {
    const saved = localStorage.getItem('claudio-session-filters-native');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showClaudioSessions, setShowClaudioSessions] = useState(() => {
    const saved = localStorage.getItem('claudio-session-filters-claudio');
    return saved !== null ? JSON.parse(saved) : true;
  });

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

  // Persist filter state to localStorage
  useEffect(() => {
    localStorage.setItem('claudio-session-filters-regular', JSON.stringify(showRegularSessions));
  }, [showRegularSessions]);

  useEffect(() => {
    localStorage.setItem('claudio-session-filters-native', JSON.stringify(showNativeSessions));
  }, [showNativeSessions]);

  useEffect(() => {
    localStorage.setItem('claudio-session-filters-claudio', JSON.stringify(showClaudioSessions));
  }, [showClaudioSessions]);

  // Filter sessions based on type toggles
  const filteredSessions = sessions.filter((session) => {
    if (!session.live_session_type && !showRegularSessions) return false; // Regular sessions
    if (
      session.live_session_type === SESSION_TYPES.NATIVE &&
      !showNativeSessions
    )
      return false; // Native sessions
    if (
      session.live_session_type &&
      session.live_session_type !== SESSION_TYPES.NATIVE &&
      !showClaudioSessions
    )
      return false; // Claudio sessions
    return true;
  });

  // Calculate container height based on actual position
  useEffect(() => {
    const calculateHeight = () => {
      if (!scrollContainerRef.current) {
        // Retry if ref not ready yet
        setTimeout(calculateHeight, 50);
        return;
      }

      const rect = scrollContainerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - rect.top - 20; // 20px padding from bottom

      setContainerHeight(Math.max(200, availableHeight)); // Minimum 200px
    };

    calculateHeight();
    window.addEventListener("resize", calculateHeight);

    // Recalculate when component mounts or sessions change
    const timeout1 = setTimeout(calculateHeight, 10);
    const timeout2 = setTimeout(calculateHeight, 100);
    const timeout3 = setTimeout(calculateHeight, 300);

    return () => {
      logger.log("ProjectSessionTab: Cleaning up height calculation listeners");
      window.removeEventListener("resize", calculateHeight);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
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
        filteredSessions.length - 1,
      );

      const start = Math.max(1, startIndex + 1); // 1-based
      const end = Math.min(endIndex + 1, filteredSessions.length);
      setScrollPosition({ start, end });
    };

    element.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial position

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [filteredSessions.length]);

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

  // Always show the UI - no full-page loading spinner

  return (
    <Card className="relative flex flex-col h-full">
      <DebugLabel label="ProjectSessionTab" />

      <CardContent className="p-0 flex flex-col flex-1 gap-1">
        {/* Header */}
        <div className="p-6 pb-0">
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

          {/* Filters and scroll position counter */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-1">
              {/* Claudio Sessions Filter - only show if count > 0 */}
              {sessions.filter(
                (s) =>
                  s.live_session_type &&
                  s.live_session_type !== SESSION_TYPES.NATIVE,
              ).length > 0 && (
                <button
                  className={cn(
                    "flex items-center cursor-pointer transition-colors p-1 rounded-md",
                    showClaudioSessions
                      ? "text-accent bg-muted"
                      : "text-muted-foreground bg-none",
                  )}
                  onClick={() => setShowClaudioSessions(!showClaudioSessions)}
                >
                  <span className="text-xs px-2">Claudio</span>
                  <div className="flex items-center justify-center w-6 h-6 bg-card rounded-full text-xs font-medium">
                    {
                      sessions.filter(
                        (s) =>
                          s.live_session_type &&
                          s.live_session_type !== SESSION_TYPES.NATIVE,
                      ).length
                    }
                  </div>
                </button>
              )}
              
              {/* Native Sessions Filter - only show if count > 0 */}
              {sessions.filter(
                (s) => s.live_session_type === SESSION_TYPES.NATIVE,
              ).length > 0 && (
                <button
                  className={cn(
                    "flex items-center cursor-pointer transition-colors p-1 rounded-md",
                    showNativeSessions
                      ? "text-accent bg-muted"
                      : "text-muted-foreground bg-none",
                  )}
                  onClick={() => setShowNativeSessions(!showNativeSessions)}
                >
                  <span className="text-xs px-2">Native</span>
                  <div className="flex items-center justify-center w-6 h-6 bg-card rounded-full text-xs font-medium">
                    {
                      sessions.filter(
                        (s) => s.live_session_type === SESSION_TYPES.NATIVE,
                      ).length
                    }
                  </div>
                </button>
              )}
              
              {/* Regular Sessions Filter - only show if count > 0 */}
              {sessions.filter((s) => !s.live_session_type).length > 0 && (
                <button
                  className={cn(
                    "flex items-center cursor-pointer transition-colors p-1 rounded-md",
                    showRegularSessions
                      ? "text-accent bg-muted"
                      : "text-muted-foreground bg-none",
                  )}
                  onClick={() => setShowRegularSessions(!showRegularSessions)}
                >
                  <span className="text-xs px-2">Other</span>
                  <div className="flex items-center justify-center w-6 h-6 bg-card rounded-full text-xs font-medium">
                    {sessions.filter((s) => !s.live_session_type).length}
                  </div>
                </button>
              )}
            </div>

            <div className="bg-muted px-3 py-1 rounded-lg text-xs text-muted-foreground">
              {scrollPosition.start === scrollPosition.end
                ? `${scrollPosition.start} of ${filteredSessions.length}`
                : `${scrollPosition.start}-${scrollPosition.end} of ${filteredSessions.length}`}
            </div>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="overflow-auto p-6 pt-1"
          style={{
            contain: "strict",
            height: `${containerHeight}px`,
          }}
        >
          <div className="space-y-3">
            {sessionsLoading && sessions.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  Loading sessions...
                </p>
              </div>
            ) : filteredSessions.length === 0 && sessions.length > 0 ? (
              <div className="text-center py-8">
                <MessagesSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No sessions match current filters
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust the filter settings above to see sessions.
                </p>
              </div>
            ) : sessions.length === 0 && !sessionsLoading ? (
              <div className="text-center py-8">
                <MessagesSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No sessions found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a new session in this project to see it here.
                </p>
                <Button onClick={onStartNewSession} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Start New Session
                </Button>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onSessionClick={onSessionClick}
                  onSessionDelete={onSessionDelete}
                  className={className}
                />
              ))
            )}
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
