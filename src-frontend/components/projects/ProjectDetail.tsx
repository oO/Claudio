import React, { useState, useEffect } from "react";
import {
  FileText,
  MessagesSquare,
  Bot,
  Shield,
  Command,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Session, ClaudeMdFile, Agent } from "@/lib/api";
import { api } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';
import { 
  ProjectSessionTab,
  ProjectMemoriesTab,
  ProjectAgentsTab,
  ProjectToolsTab,
  ProjectDeleteDialog,
} from "@/components/projects";
import { SlashCommandsManager } from "@/components/common";

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
   * Initial active tab (used for restoration)
   */
  initialActiveTab?: string;
  /**
   * Callback when active tab changes (for state preservation)
   */
  onActiveTabChange?: (activeTab: string) => void;
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when editing a CLAUDE.md file
   */
  onEditClaudeFile?: (file: ClaudeMdFile, activeTab: string) => void;
  /**
   * Callback when executing an agent
   */
  onExecuteAgent?: (agent: Agent) => void;
  /**
   * Callback when editing an agent
   */
  onEditAgent?: (agent: Agent, activeTab: string) => void;
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
   * Callback for showing toast notifications
   */
  onToast?: (message: string, type: "success" | "error") => void;
  /**
   * Callback when sessions are deleted (bulk operation)
   */
  onSessionsDeleted?: () => void;
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
  initialActiveTab = "sessions",
  onActiveTabChange,
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
  onToast,
  onSessionsDeleted,
  className,
}) => {
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Update activeTab when initialActiveTab changes (for restoration)
  useEffect(() => {
    if (initialActiveTab && initialActiveTab !== activeTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      logger.error("Failed to delete session:", error);
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
    <div className={cn("flex flex-col h-full relative", className)}>
      <DebugLabel label="ProjectDetail" />
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        onActiveTabChange?.(value);
      }} className="w-full flex flex-col flex-1">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="sessions" className="gap-2 hover:bg-accent">
            <MessagesSquare className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="memories" className="gap-2 hover:bg-accent">
            <FileText className="h-4 w-4" />
            Memories
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2 hover:bg-accent">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2 hover:bg-accent">
            <Shield className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="commands" className="gap-2 hover:bg-accent">
            <Command className="h-4 w-4" />
            Commands
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-2 flex-1 flex flex-col">
          <ProjectSessionTab
            sessions={sessions}
            projectId={projectId}
            projectName={projectPath.split("/").pop() || "Project"}
            onSessionClick={onSessionClick}
            onSessionDelete={handleSessionDelete}
            onSessionsDeleted={(result) => {
              if (result) {
                // Show success toast with deletion details
                const message = `Deleted ${result.sessions_deleted} session${result.sessions_deleted !== 1 ? 's' : ''}, ${result.todos_deleted} todo file${result.todos_deleted !== 1 ? 's' : ''}, freed ${result.size_freed_mb.toFixed(2)} MB`;
                onToast?.(message, "success");
              }
              
              // Trigger parent to reload sessions
              onSessionsDeleted?.();
              logger.log("Sessions deleted, parent should refresh");
            }}
            onToast={onToast}
          />
        </TabsContent>

        {/* Memories Tab */}
        <TabsContent value="memories" className="mt-2">
          <ProjectMemoriesTab
            projectPath={projectPath}
            onViewClaudeFile={(file) => onEditClaudeFile?.(file, activeTab)}
          />
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-2">
          <ProjectAgentsTab
            projectPath={projectPath}
            onExecuteAgent={onExecuteAgent}
            onEditAgent={(agent) => onEditAgent?.(agent, activeTab)}
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

        {/* Commands Tab */}
        <TabsContent value="commands" className="mt-2">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Slash Commands</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage project-specific slash commands for this project.
              </p>
            </div>
            <SlashCommandsManager projectPath={projectPath} />
          </div>
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