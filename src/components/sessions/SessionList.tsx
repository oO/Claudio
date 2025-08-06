import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Clock, MessageSquare, HardDrive, ListChecks, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClaudeMemoriesDropdown } from "@/components/claude";
import { AgentsList } from "@/components/agents";
import { cn } from "@/lib/utils";
import { formatUnixTimestamp, formatISOTimestamp, truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session, ClaudeMdFile, Agent } from "@/lib/api";
import { api } from "@/lib/api";

interface SessionListProps {
  /**
   * Array of sessions to display
   */
  sessions: Session[];
  /**
   * The current project path being viewed
   */
  projectPath: string;
  /**
   * The project ID for deletion
   */
  projectId: string;
  /**
   * Callback to go back to project list
   */
  onBack: () => void;
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when a CLAUDE.md file should be edited
   */
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  /**
   * Callback when an agent is executed
   */
  onExecuteAgent?: (agent: Agent) => void;
  /**
   * Callback when an agent is edited
   */
  onEditAgent?: (agent: Agent) => void;
  /**
   * Callback when an agent is exported
   */
  onExportAgent?: (agent: Agent) => void;
  /**
   * Callback when an agent is deleted
   */
  onDeleteAgent?: (agent: Agent) => void;
  /**
   * Callback when create agent is clicked
   */
  onCreateAgent?: () => void;
  /**
   * Callback when import agent is clicked
   */
  onImportAgent?: () => void;
  /**
   * Callback when a session is deleted
   */
  onSessionDeleted?: (sessionId: string) => void;
  /**
   * Callback when the project is deleted
   */
  onProjectDeleted?: (projectId: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 5;

/**
 * SessionList component - Displays paginated sessions for a specific project
 * 
 * @example
 * <SessionList
 *   sessions={sessions}
 *   projectPath="/Users/example/project"
 *   onBack={() => setSelectedProject(null)}
 *   onSessionClick={(session) => console.log('Selected session:', session)}
 * />
 */
export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  projectPath,
  onSessionClick,
  onEditClaudeFile,
  onExecuteAgent,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  onSessionDeleted,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Calculate pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = sessions.slice(startIndex, endIndex);
  
  // Reset to page 1 if sessions change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length]);

  // Format file size from bytes
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };


  // Delete handlers
  const handleDeleteClick = (session: Session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await api.deleteSession(sessionToDelete.project_id, sessionToDelete.id);
      console.log(`Deleted session with ${result.todos_deleted} todos, ${result.timelines_deleted} timelines (${result.size_kb.toFixed(2)} KB)`);
      onSessionDeleted?.(sessionToDelete.id);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
      // Could add toast notification here
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };


  
  return (
    <div className={cn("space-y-4", className)}>

      {/* CLAUDE.md Memories Dropdown */}
      {onEditClaudeFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <ClaudeMemoriesDropdown
            projectPath={projectPath}
            onEditFile={onEditClaudeFile}
          />
        </motion.div>
      )}

      {/* Project Agents Dropdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <AgentsList
          title="Project Agents"
          projectPath={projectPath}
          startCollapsed={true}
          onExecuteAgent={onExecuteAgent}
          onEditAgent={onEditAgent}
          onExportAgent={onExportAgent}
          onDeleteAgent={onDeleteAgent}
          onCreateAgent={onCreateAgent}
          onImportAgent={onImportAgent}
        />
      </motion.div>

      <AnimatePresence mode="popLayout">
        <div className="space-y-2">
          {currentSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              <Card
                className={cn(
                  "transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer group",
                  session.todo_counts && "border-l-4 border-l-primary"
                )}
                onClick={() => {
                  onSessionClick?.(session);
                }}
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">{session.id}</p>
                          
                          {/* First message preview */}
                          {session.first_message && (
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                <MessageSquare className="h-3 w-3" />
                                <span>First message:</span>
                              </div>
                              <p className="text-xs line-clamp-2 text-foreground/80">
                                {truncateText(getFirstLine(session.first_message), 100)}
                              </p>
                            </div>
                          )}
                          
                          {/* Storage and cost info */}
                          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <HardDrive className="h-3 w-3" />
                              <span>{formatFileSize(session.size_bytes)}</span>
                            </div>
                            {/* Cost removed - Claude Code subscriptions don't use API tokens */}
                            {session.message_count && (
                              <div className="flex items-center space-x-1">
                                <MessageSquare className="h-3 w-3" />
                                <span>{session.message_count}</span>
                              </div>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                            {/* Message timestamp if available, otherwise file creation time */}
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {session.message_timestamp 
                                  ? formatISOTimestamp(session.message_timestamp)
                                  : formatUnixTimestamp(session.created_at)
                                }
                              </span>
                            </div>
                            
                            {session.todo_counts && (
                              <div className="flex items-center space-x-1">
                                <ListChecks className="h-3 w-3" />
                                <span>{session.todo_counts.completed}/{session.todo_counts.total}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Delete button */}
                      {onSessionDeleted && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(session);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete session "{sessionToDelete?.id.slice(0, 8)}..."?
              <br />
              <br />
              This will permanently remove:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All conversation history</li>
                {sessionToDelete?.size_bytes && (
                  <li>{formatFileSize(sessionToDelete.size_bytes)} of data</li>
                )}
                {sessionToDelete?.message_count && (
                  <li>{sessionToDelete.message_count} messages</li>
                )}
              </ul>
              <br />
              <strong>This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm} 
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}; 