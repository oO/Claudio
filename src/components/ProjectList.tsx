import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  Settings,
  MoreVertical,
  Trash2,
  HardDrive,
  Clock,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Project } from "@/lib/api";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/date-utils";
import { Pagination } from "@/components/ui/pagination";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project) => void;
  /**
   * Callback when hooks configuration is clicked
   */
  onProjectSettings?: (project: Project) => void;
  /**
   * Callback when a project is deleted
   */
  onProjectDeleted?: (projectId: string) => void;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 12;

/**
 * Extracts the project name from the full path
 */
const getProjectName = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
};

/**
 * ProjectList component - Displays a paginated list of projects with hover animations
 * 
 * @example
 * <ProjectList
 *   projects={projects}
 *   onProjectClick={(project) => console.log('Selected:', project)}
 * />
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  onProjectSettings,
  onProjectDeleted,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteClaude, setDeleteClaude] = useState(false);
  const [deleteAgents, setDeleteAgents] = useState(false);
  
  // Calculate pagination
  const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProjects = projects.slice(startIndex, endIndex);
  
  // Reset to page 1 if projects change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [projects.length]);

  // Format file size from bytes
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };


  // Delete handlers
  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await api.deleteClaudeProject(projectToDelete.id);
      console.log(`Deleted project with ${result.sessions_deleted} sessions, ${result.todos_deleted} todos, ${result.timelines_deleted} timelines (${result.size_mb.toFixed(2)} MB)`);
      // Always call the callback to remove from UI - even if backend had issues
      onProjectDeleted?.(projectToDelete.id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Failed to delete project:", error);
      // Still remove from UI and let user know there might be leftover files
      onProjectDeleted?.(projectToDelete.id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      // TODO: Show error toast - for now just log
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
    setDeleteClaude(false);
    setDeleteAgents(false);
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {currentProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Card
              className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer group h-full"
              onClick={() => onProjectClick(project)}
            >
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-semibold text-base truncate">
                        {getProjectName(project.path)}
                      </h3>
                    </div>
                    {project.sessions.length > 0 && (
                      <Badge variant="secondary" className="shrink-0 ml-2 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {project.sessions.length}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 font-mono truncate">
                    {project.path}
                  </p>
                </div>
                
                <div className="space-y-2">
                  {/* Cost removed - Claude Code subscriptions don't use API tokens */}
                  
                  {/* Project stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{formatFileSize(project.total_size_bytes)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        <span>{project.agent_count || 0}</span>
                      </div>
                      {project.last_active && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(project.last_active * 1000)}</span>
                        </div>
                      )}
                    </div>
                  
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onProjectSettings && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onProjectSettings(project);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Hooks
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(project);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Claude Code Data</DialogTitle>
            <DialogDescription className="space-y-4">
              <div>
                <strong>Your project files will NOT be deleted.</strong>
                <br />
                This will only remove Claude Code data for project:
                <br />
                <code className="bg-muted px-1 rounded text-sm">{projectToDelete ? getProjectName(projectToDelete.path) : ''}</code>
              </div>
              
              <div>
                <strong>Claude Code data to be removed:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>{projectToDelete?.sessions.length || 0} conversation session(s)</li>
                  {projectToDelete?.total_size_bytes && (
                    <li>{formatFileSize(projectToDelete.total_size_bytes)} of conversation data</li>
                  )}
                  <li>All conversation history from ~/.claude/projects/</li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox"
                    id="delete-claude-md" 
                    checked={deleteClaude} 
                    onChange={(e) => setDeleteClaude(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="delete-claude-md" className="text-sm">
                    Also delete project CLAUDE.md file (contains project context)
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox"
                    id="delete-agents" 
                    checked={deleteAgents} 
                    onChange={(e) => setDeleteAgents(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="delete-agents" className="text-sm">
                    Also delete project agents (custom agents for this project)
                  </label>
                </div>
              </div>
              
              <div className="text-destructive font-medium">
                This action cannot be undone.
              </div>
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
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 
