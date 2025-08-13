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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatISOTimestamp,
  truncateText,
  getFirstLine,
  formatFileSize,
  formatTimeAgo,
} from "@/lib/date-utils";
import type { Session } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";

interface ProjectSessionTabProps {
  sessions: Session[];
  onSessionClick?: (session: Session) => void;
  onSessionDelete?: (session: Session) => void;
  className?: string;
}


export const ProjectSessionTab: React.FC<ProjectSessionTabProps> = ({
  sessions,
  onSessionClick,
  onSessionDelete,
  className,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ start: 0, end: 0 });

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Increased height to account for 2-line titles
    overscan: 5, // Keep 5 items rendered outside of view
  });

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
        const end = Math.min(virtualItems[virtualItems.length - 1].index + 1, sessions.length);
        setScrollPosition({ start, end });
      }
    };

    element.addEventListener('scroll', handleScroll);
    handleScroll(); // Set initial position
    return () => element.removeEventListener('scroll', handleScroll);
  }, [virtualizer, sessions.length]);

  const scrollToTop = () => {
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
            <p className="text-sm text-muted-foreground">
              Start a new Claude Code session in this project to see it here.
            </p>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      <DebugLabel label="ProjectSessionTab" />
      
      {/* Scroll position counter */}
      <div className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-1 text-xs text-muted-foreground">
        {scrollPosition.start === scrollPosition.end 
          ? `${scrollPosition.start} of ${sessions.length}`
          : `${scrollPosition.start}-${scrollPosition.end} of ${sessions.length}`
        }
      </div>
      
      <CardContent className="p-0">
        <div
          ref={parentRef}
          className="h-[600px] overflow-auto"
          style={{
            contain: "strict",
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
                  className="p-3"
                >
                  <div
                    className={cn(
                      "group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer h-full",
                      className
                    )}
                    onClick={() => onSessionClick?.(session)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <MessagesSquare className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium leading-tight" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word'
                          }}>
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
                              <span>
                                {formatFileSize(session.size_bytes)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Message count badge */}
                      {session.message_count !== undefined && (
                        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
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
    </Card>
  );
};