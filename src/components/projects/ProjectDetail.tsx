import React, { useState } from "react";
import {
  FileText,
  MessagesSquare,
  Bot,
  Lock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Session, ClaudeMdFile, Agent } from "@/lib/api";
import { api } from "@/lib/api";
import { 
  ProjectSessionTab,
  ProjectMemoriesTab,
  ProjectAgentsTab,
  ProjectToolsTab,
  ProjectDeleteDialog,
} from "@/components/projects";

interface ProjectDetailProps {
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
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when editing a CLAUDE.md file
   */
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  /**
   * Callback when executing an agent
   */
  onExecuteAgent?: (agent: Agent) => void;
  /**
   * Callback when editing an agent
   */
  onEditAgent?: (agent: Agent) => void;
  /**
   * Callback when exporting an agent
   */
  onExportAgent?: (agent: Agent) => void;
  /**
   * Callback when deleting an agent
   */
  onDeleteAgent?: (agent: Agent) => void;
  /**
   * Callback when creating an agent
   */
  onCreateAgent?: () => void;
  /**
   * Callback when importing an agent
   */
  onImportAgent?: () => void;
  /**
   * Callback when a session is deleted
   */
  onSessionDeleted?: (sessionId: string) => void;
  /**
   * Callback when the entire project is deleted
   */
  onProjectDeleted?: (projectId: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * ProjectDetail component for displaying project sessions, memories, agents, and permissions
 * Previously known as SessionList, this component provides a tabbed interface for managing
 * all aspects of a Claude Code project.
 */
export const ProjectDetail: React.FC<ProjectDetailProps> = ({
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSessionDelete = (session: Session) => {
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
          <TabsTrigger value="tools" className="gap-2">
            <Lock className="h-4 w-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-2">
          <ProjectSessionTab
            sessions={sessions}
            onSessionClick={onSessionClick}
            onSessionDelete={handleSessionDelete}
          />
        </TabsContent>

        {/* Memories Tab */}
        <TabsContent value="memories" className="mt-2">
          <ProjectMemoriesTab
            projectPath={projectPath}
            onEditClaudeFile={onEditClaudeFile}
          />
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-2">
          <ProjectAgentsTab
            projectPath={projectPath}
            onExecuteAgent={onExecuteAgent}
            onEditAgent={onEditAgent}
            onExportAgent={onExportAgent}
            onDeleteAgent={onDeleteAgent}
            onCreateAgent={onCreateAgent}
            onImportAgent={onImportAgent}
          />
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="mt-2">
          <ProjectToolsTab projectPath={projectPath} />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <ProjectDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        session={sessionToDelete}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};