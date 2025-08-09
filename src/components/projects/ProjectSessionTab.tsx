import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MessageSquare,
  MessagesSquare,
  HardDrive,
  ListChecks,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatISOTimestamp,
  truncateText,
  getFirstLine,
} from "@/lib/date-utils";
import type { Session } from "@/lib/api";

interface ProjectSessionTabProps {
  sessions: Session[];
  onSessionClick?: (session: Session) => void;
  onSessionDelete?: (session: Session) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 10;

export const ProjectSessionTab: React.FC<ProjectSessionTabProps> = ({
  sessions,
  onSessionClick,
  onSessionDelete,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 if sessions change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length]);

  // Pagination logic
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = sessions.slice(startIndex, endIndex);

  return (
    <Card>
      <CardContent className="p-6">
        <AnimatePresence mode="popLayout">
          {currentSessions.length === 0 ? (
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
              <p className="text-sm text-muted-foreground">
                Start a new Claude Code session in this project to see it here.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="sessions-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {currentSessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
                    className
                  )}
                  onClick={() => onSessionClick?.(session)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {getFirstLine(session.first_message || "Untitled Session")}
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
                        {session.message_count !== undefined && (
                          <div className="flex items-center gap-1">
                            <ListChecks className="h-3 w-3" />
                            <span>{session.message_count} messages</span>
                          </div>
                        )}
                        {session.size_bytes !== undefined && (
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            <span>
                              {(session.size_bytes / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="w-fit"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};