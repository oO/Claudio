import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Clock,
  MessageSquare,
  MessagesSquare,
  HardDrive,
  ListChecks,
  Trash2,
  FolderOpen,
  FileCode,
  Bot,
  Edit,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentsContent } from "@/components/agents";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatISOTimestamp,
  truncateText,
  getFirstLine,
} from "@/lib/date-utils";
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

const ITEMS_PER_PAGE = 4;

/**
 * SessionList component - Displays paginated sessions for a specific project
 *
 * @example
 * <SessionList
 *   sessions={sessions}
 *   projectPath="/Users/example/project"
 *   onBack={() => setSelectedProject(null)}
 *   onSessionClick={(session) => handleSessionClick(session)}
 * />
 */
export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  projectPath,
  projectId,
  onSessionClick,
  onEditClaudeFile,
  onExecuteAgent,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  onSessionDeleted,
  onProjectDeleted,
  className,
}) => {
  const [activeTab, setActiveTab] = useState("sessions");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Claude memories state
  const [claudeFiles, setClaudeFiles] = useState<ClaudeMdFile[]>([]);
  const [claudeFilesLoading, setClaudeFilesLoading] = useState(false);
  const [claudeFilesError, setClaudeFilesError] = useState<string | null>(null);

  // Calculate pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = sessions.slice(startIndex, endIndex);

  // Reset to page 1 if sessions change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length]);

  // Load Claude files when memories tab is accessed
  useEffect(() => {
    if (
      activeTab === "memories" &&
      claudeFiles.length === 0 &&
      !claudeFilesLoading
    ) {
      loadClaudeFiles();
    }
  }, [activeTab]);

  // Format file size from bytes
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const loadClaudeFiles = async () => {
    try {
      setClaudeFilesLoading(true);
      setClaudeFilesError(null);
      const foundFiles = await api.findClaudeMdFiles(projectPath);
      setClaudeFiles(foundFiles);
    } catch (err) {
      console.error("Failed to load CLAUDE.md files:", err);
      setClaudeFilesError("Failed to load CLAUDE.md files");
    } finally {
      setClaudeFilesLoading(false);
    }
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
      const result = await api.deleteSession(
        sessionToDelete.project_id,
        sessionToDelete.id,
      );
      // Session deleted successfully
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
    <div className={cn("space-y-6", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="sessions" className="gap-2">
            <MessagesSquare className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="memories" className="gap-2">
            <FileText className="h-4 w-4" />
            Memories
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-2">
          <Card>
            <CardContent className="p-6">
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
                          session.todo_counts && "border-l-4 border-l-primary",
                        )}
                        onClick={() => {
                          onSessionClick?.(session);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1 min-w-0">
                                <MessagesSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="space-y-1 flex-1 min-w-0">
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {session.id}
                                  </p>

                                  {/* First message preview */}
                                  {session.first_message && (
                                    <div className="space-y-1">
                                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3 w-3" />
                                        <span>First message:</span>
                                      </div>
                                      <p className="text-xs line-clamp-2 text-foreground/80">
                                        {truncateText(
                                          getFirstLine(session.first_message),
                                          100,
                                        )}
                                      </p>
                                    </div>
                                  )}

                                  {/* Storage and cost info */}
                                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                                    <div className="flex items-center space-x-1">
                                      <HardDrive className="h-3 w-3" />
                                      <span>
                                        {formatFileSize(session.size_bytes)}
                                      </span>
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
                                          ? formatISOTimestamp(
                                              session.message_timestamp,
                                            )
                                          : formatUnixTimestamp(
                                              session.created_at,
                                            )}
                                      </span>
                                    </div>

                                    {session.todo_counts && (
                                      <div className="flex items-center space-x-1">
                                        <ListChecks className="h-3 w-3" />
                                        <span>
                                          {session.todo_counts.completed}/
                                          {session.todo_counts.total}
                                        </span>
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

              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memories Tab */}
        <TabsContent value="memories" className="mt-2">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    CLAUDE.md Memories
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage CLAUDE.md files containing project context and
                    memories.
                  </p>
                </div>

                {claudeFilesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : claudeFilesError ? (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {claudeFilesError}
                  </div>
                ) : claudeFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-sm text-muted-foreground mb-4">
                      No CLAUDE.md files found in this project
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (onEditClaudeFile) {
                          const claudeMdFile: ClaudeMdFile = {
                            absolute_path: `${projectPath}/CLAUDE.md`,
                            relative_path: "CLAUDE.md",
                            size: 0,
                            modified: Math.floor(Date.now() / 1000),
                          };
                          onEditClaudeFile(claudeMdFile);
                        }
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Create CLAUDE.md
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {claudeFiles.map((file, index) => (
                      <motion.div
                        key={file.absolute_path}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-sm font-medium">
                                  {file.relative_path}
                                </p>
                                <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                                  <span>{formatFileSize(file.size)}</span>
                                  <span>
                                    Modified{" "}
                                    {formatUnixTimestamp(file.modified)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEditClaudeFile?.(file)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-2">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Project Agents</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage agents specific to this project.
                  </p>
                </div>

                <AgentsContent
                  projectPath={projectPath}
                  onExecuteAgent={onExecuteAgent}
                  onEditAgent={onEditAgent}
                  onExportAgent={onExportAgent}
                  onDeleteAgent={onDeleteAgent}
                  onCreateAgent={onCreateAgent}
                  onImportAgent={onImportAgent}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete session "
              {sessionToDelete?.id.slice(0, 8)}..."?
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
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
            >
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
