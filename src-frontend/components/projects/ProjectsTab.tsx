import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, MoreVertical, Trash2, Settings } from "lucide-react";
import { api, type Project, type Session, type ClaudeMdFile } from "@/lib/api";
import { logger } from "@/lib/logger";
import { prettifyProjectName } from "@/lib/utils";
import { ProjectList, ProjectDetail } from "@/components/projects";
import { RunningClaudeSessions } from "@/components/sessions";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { DebugLabel } from "@/components/ui/atoms";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TabPageLayout } from "@/components/common";
import { useTabState } from "@/hooks/useTabState";
import { useScreenTracking } from "@/hooks/useAnalytics";
import { Tab } from "@/contexts/TabContext";

interface ProjectsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ tab, isActive }) => {
  const { updateTab, createChatTab, createClaudeSDKTab } = useTabState();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeProjectTab, setActiveProjectTab] = useState<string>("sessions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectDeleteDialogOpen, setProjectDeleteDialogOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Delete options state
  const [deleteOptions, setDeleteOptions] = useState({
    sessions: true, // Always enabled and locked
    agents: false, // Optional
    memories: false, // Optional (CLAUDE.md files)
    settings: false, // Optional (.claude/ directory and settings)
  });

  // State for deletion counts
  const [deletionCounts, setDeletionCounts] = useState({
    agents: 0,
    memories: 0,
    settings: 0,
    loading: false,
  });

  // Track screen when tab becomes active
  useScreenTracking(
    isActive ? tab.type : undefined,
    isActive ? tab.id : undefined,
  );

  // Debug dialog state changes
  useEffect(() => {
    logger.log(
      "projectDeleteDialogOpen state changed to:",
      projectDeleteDialogOpen,
    );
  }, [projectDeleteDialogOpen]);

  // Load projects when tab becomes active and is of type 'projects'
  useEffect(() => {
    if (isActive && tab.type === "projects") {
      // Check if we need to restore project state first
      if (tab.restoreProjectState) {
        setSelectedProject(tab.restoreProjectState.selectedProject);
        setSessions(tab.restoreProjectState.sessions || []);
        setActiveProjectTab(tab.restoreProjectState.activeTab || "sessions");
        // Clear the restore state after using it
        updateTab(tab.id, { restoreProjectState: undefined });
      } else {
        loadProjects();
      }
    }
  }, [isActive, tab.type, tab.restoreProjectState]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      logger.error("Failed to load projects:", err);
      setError(
        "Failed to load projects. Please ensure ~/.claude directory exists.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = async (project: Project) => {
    try {
      setSelectedProject(project);
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);

      // Update tab title to project name
      const projectName = getProjectName(project.path);
      updateTab(tab.id, { title: projectName });
    } catch (err) {
      logger.error("Failed to load sessions:", err);
      setError("Failed to load sessions for this project.");
      // Reset selectedProject on error
      setSelectedProject(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Simple back navigation without navigation stack
    setSelectedProject(null);
    setSessions([]);
    setActiveProjectTab("sessions"); // Reset to default
    // Restore tab title to "Projects"
    updateTab(tab.id, { title: "Projects" });
  };

  // Get project name from path
  const getProjectName = (path: string): string => {
    return prettifyProjectName(path);
  };

  // Calculate deletion counts from existing data
  const getSessionCount = () => sessions.length;
  const getTodoCount = () => {
    return sessions.reduce((total, session) => {
      return total + (session.todo_counts?.total || 0);
    }, 0);
  };

  // Get real counts from loaded data
  const getAgentCount = () => deletionCounts.agents;
  const getMemoryCount = () => deletionCounts.memories;
  const getSettingsCount = () => deletionCounts.settings;

  // Helper to check if we should show optional deletion options
  const shouldShowAgents = getAgentCount() > 0;
  const shouldShowMemories = getMemoryCount() > 0;
  const shouldShowSettings = getSettingsCount() > 0;

  // Load deletion counts for the modal
  const loadDeletionCounts = async (projectPath: string) => {
    setDeletionCounts((prev) => ({ ...prev, loading: true }));
    try {
      // Load agents count
      const agents = await api.listAgents(projectPath);
      const agentCount = agents.length;

      // Load memories count (CLAUDE.md files)
      const claudeFiles = await api.findClaudeMdFiles(projectPath);
      const memoryCount = claudeFiles.length;

      // Check if settings files exist (settings.json, settings.local.json)
      const settingsCount = await api.checkProjectSettings(projectPath);

      setDeletionCounts({
        agents: agentCount,
        memories: memoryCount,
        settings: settingsCount,
        loading: false,
      });
    } catch (error) {
      logger.error("Failed to load deletion counts:", error);
      setDeletionCounts({
        agents: 0,
        memories: 0,
        settings: 0,
        loading: false,
      });
    }
  };

  const handleSessionDeleted = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleProjectDeleted = async (projectId: string) => {
    setIsDeletingProject(true);
    try {
      logger.log("🗑️ Deleting project with options:", deleteOptions);

      // Call the deletion API and get the results
      const result = await api.deleteClaudeProject(projectId, deleteOptions);

      logger.log("✅ Project deletion completed:", result);
      logger.log(`📊 Deletion summary:
        - Sessions: ${result.sessions_deleted}
        - Todos: ${result.todos_deleted}
        - Timelines: ${result.timelines_deleted}
        - Agents: ${result.agents_deleted}
        - Memories: ${result.memories_deleted}
        - Settings: ${result.settings_deleted}
        - Size freed: ${result.size_mb.toFixed(2)} MB
        - Message: ${result.message}`);

      // Remove project from projects list
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      // Go back to projects view in the same tab
      handleBack();
      setProjectDeleteDialogOpen(false);

      // Create deletion summary for user feedback
      let deletionSummary = `- ${result.sessions_deleted} sessions\n- ${result.todos_deleted} todo files\n- ${result.timelines_deleted} timelines`;
      if (result.agents_deleted > 0) {
        deletionSummary += `\n- ${result.agents_deleted} agents`;
      }
      if (result.memories_deleted > 0) {
        deletionSummary += `\n- ${result.memories_deleted} memory files`;
      }
      if (result.settings_deleted > 0) {
        deletionSummary += `\n- ${result.settings_deleted} settings file${result.settings_deleted !== 1 ? "s" : ""}`;
      }
      deletionSummary += `\n- ${result.size_mb.toFixed(2)} MB freed`;

      // Show success feedback
      alert(`Project deleted successfully!\n\nDeleted:\n${deletionSummary}`);
    } catch (error) {
      logger.error("❌ Failed to delete project:", error);
      alert(`Failed to delete project: ${error}`);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleProjectDeleteClick = async () => {
    logger.log("🔥 DELETE BUTTON CLICKED - handleProjectDeleteClick called");
    logger.log("Current selectedProject:", selectedProject);
    logger.log(
      "Current projectDeleteDialogOpen state:",
      projectDeleteDialogOpen,
    );

    if (!selectedProject) return;

    // Reset delete options to defaults when opening dialog
    setDeleteOptions({
      sessions: true, // Always enabled and locked
      agents: false, // Optional
      memories: false, // Optional (CLAUDE.md files)
      settings: false, // Optional (.claude/ directory and settings)
    });

    setProjectDeleteDialogOpen(true);
    logger.log("✅ setProjectDeleteDialogOpen(true) called");

    // Load the deletion counts
    await loadDeletionCounts(selectedProject.path);
  };

  const handleProjectDeleteCancel = () => {
    setProjectDeleteDialogOpen(false);
  };

  const handleDeleteOptionChange = (
    option: keyof typeof deleteOptions,
    checked: boolean,
  ) => {
    setDeleteOptions((prev) => ({
      ...prev,
      [option]: checked,
    }));
  };

  const handleNewSession = () => {
    // Create a new chat tab
    createChatTab();
  };

  const handleNewSDKSession = (projectPath?: string) => {
    // Create a new SDK tab
    const path = projectPath || "/Users/olivier/Projects/claudio";
    createClaudeSDKTab(path);
  };

  // Debug rendering
  logger.log(
    "Rendering ProjectsTab, selectedProject:",
    selectedProject?.path || "none",
  );

  return (
    <>
      <DebugLabel label="ProjectsTab" />
      <TabPageLayout
        title={
          selectedProject ? getProjectName(selectedProject.path) : "Projects"
        }
        subtitle={
          selectedProject
            ? `${selectedProject.path} • ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`
            : "Browse your Claude Code sessions"
        }
        onBack={selectedProject ? handleBack : undefined}
        contentPadding={false}
        actions={
          selectedProject ? (
            <DropdownMenu
              onOpenChange={(open) =>
                logger.log("Dropdown onOpenChange:", open)
              }
            >
              <DropdownMenuTrigger asChild>
                <ActionButton
                  icon={MoreVertical}
                  label="More options"
                  variant="ghost"
                  size="icon"
                  showLabel={false}
                  className="h-8 w-8"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) =>
                  logger.log("🔒 Menu closing, focus:", e)
                }
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    logger.log("🎯 DropdownMenuItem clicked - onClick fired");
                    logger.log("Event:", e);
                    e.preventDefault();
                    e.stopPropagation();
                    handleProjectDeleteClick();
                  }}
                  className="text-destructive hover:bg-accent"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      >
        <div className="h-full overflow-y-auto">
          <div className="container mx-auto p-6">
            {/* Error display */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive max-w-2xl"
              >
                {error}
              </motion.div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {selectedProject ? (
                    <>
                      Loading the{" "}
                      <strong className="text-accent">
                        {getProjectName(selectedProject.path)}
                      </strong>{" "}
                      project...
                    </>
                  ) : (
                    "Loading projects..."
                  )}
                </span>
              </div>
            )}

            {/* Content */}
            {!loading && (
              <AnimatePresence mode="wait">
                {selectedProject ? (
                  <motion.div
                    key="sessions"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProjectDetail
                      sessions={sessions}
                      projectPath={selectedProject.path}
                      projectId={selectedProject.id}
                      initialActiveTab={activeProjectTab}
                      onActiveTabChange={setActiveProjectTab}
                      onSessionClick={(session) => {
                        // Update tab to show this session with proper previousState for back navigation
                        updateTab(tab.id, {
                          type: "chat",
                          title:
                            session.project_path.split("/").pop() || "Session",
                          sessionId: session.id,
                          sessionData: session, // Store full session object
                          initialProjectPath: session.project_path,
                          // Store state to return to - this is the KEY fix!
                          restoreProjectState: {
                            selectedProject: selectedProject,
                            sessions: sessions,
                            activeTab: activeProjectTab,
                          },
                        });
                      }}
                      onEditClaudeFile={(
                        file: ClaudeMdFile,
                        currentActiveTab: string,
                      ) => {
                        // Open CLAUDE.md file in same tab with restore state
                        updateTab(tab.id, {
                          type: "claude-file",
                          title: file.relative_path,
                          claudeFileId: file.absolute_path,
                          sourceContext: currentActiveTab, // Track where the file was opened from
                          // Store state to return to
                          restoreProjectState: {
                            selectedProject: selectedProject,
                            sessions: sessions,
                            activeTab: currentActiveTab, // Preserve the current tab
                          },
                          previousState: {
                            type: "projects",
                            title: getProjectName(selectedProject.path),
                            selectedProject: selectedProject,
                            sessions: sessions,
                          },
                        });
                      }}
                      onExecuteAgent={(agent) => {
                        // Open agent execution in a new tab
                        window.dispatchEvent(
                          new CustomEvent("open-agent-execution", {
                            detail: { agent },
                          }),
                        );
                      }}
                      onEditAgent={(agent, currentActiveTab: string) => {
                        // Open agent edit in same tab with restore state
                        updateTab(tab.id, {
                          type: "create-agent",
                          title: `Edit ${agent.name}`,
                          agentData: agent,
                          // Store state to return to
                          restoreProjectState: {
                            selectedProject: selectedProject,
                            sessions: sessions,
                            activeTab: currentActiveTab, // Preserve the current tab
                          },
                          previousState: {
                            type: "projects",
                            title: getProjectName(selectedProject.path),
                            selectedProject: selectedProject,
                            sessions: sessions,
                          },
                        });
                      }}
                      onExportAgent={(agent) => {
                        // Export project agent (same logic as personal agents)
                        // Agent export will be handled
                        // TODO: Implement proper export dialog
                      }}
                      onDeleteAgent={(agent) => {
                        // Delete agent and refresh agents list
                        // This would need to be implemented properly with confirmation dialog
                        // Agent deletion will be handled
                      }}
                      onCreateAgent={() => {
                        // Open create agent tab for project agents
                        window.dispatchEvent(
                          new CustomEvent("open-create-agent-tab"),
                        );
                      }}
                      onImportAgent={() => {
                        // Open import agent tab for project agents
                        window.dispatchEvent(
                          new CustomEvent("open-import-agent-tab"),
                        );
                      }}
                      onSessionDeleted={handleSessionDeleted}
                      onProjectDeleted={handleProjectDeleted}
                      onToast={(message, type) => {
                        // Simple toast implementation - could be enhanced with a proper toast system
                        logger.log(`Toast (${type}):`, message);
                        // TODO: Integrate with a proper toast notification system
                      }}
                      onSessionsDeleted={async () => {
                        // Refresh sessions after bulk deletion
                        if (selectedProject) {
                          try {
                            const updatedSessions =
                              await api.getProjectSessions(selectedProject.id);
                            setSessions(updatedSessions);
                            logger.log(
                              "Sessions refreshed after bulk deletion",
                            );
                          } catch (error) {
                            logger.error(
                              "Failed to refresh sessions after deletion:",
                              error,
                            );
                          }
                        }
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="projects"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* New session buttons at the top */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="mb-4 flex gap-2 justify-end"
                    >
                      <Button
                        onClick={handleNewSession}
                        size="default"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Session
                      </Button>
                      <Button
                        onClick={() => handleNewSDKSession()}
                        size="default"
                        className="accent-button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New SDK Session
                      </Button>
                    </motion.div>

                    {/* Running Claude Sessions */}
                    <RunningClaudeSessions />

                    {/* Project list */}
                    {projects.length > 0 ? (
                      <ProjectList
                        projects={projects}
                        onProjectClick={handleProjectClick}
                        loading={loading}
                        className="animate-fade-in"
                      />
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No projects found in ~/.claude/projects
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Project delete confirmation dialog */}
        <Dialog
          open={projectDeleteDialogOpen}
          onOpenChange={(open) => {
            logger.log("🔔 Dialog onOpenChange called with:", open);
            setProjectDeleteDialogOpen(open);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete Project Data</DialogTitle>
              <DialogDescription>
                {selectedProject && (
                  <>
                    Choose what Claude Code data to delete for project "
                    {getProjectName(selectedProject.path)}".
                    <br />
                    <br />
                    <strong>Note:</strong> This only removes Claude Code data
                    (sessions, agents, memories, settings). Your actual project
                    source code remains untouched.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {deletionCounts.loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">
                    Loading project data...
                  </span>
                </div>
              )}
              <div className="space-y-3">
                {/* Sessions - Required and locked */}
                <div className="flex items-center space-x-3">
                  <Switch
                    id="delete-sessions"
                    checked={deleteOptions.sessions}
                    disabled={true} // Always locked/required
                    className="opacity-50"
                  />
                  <Label
                    htmlFor="delete-sessions"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        Project Sessions and Todos
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getSessionCount()} session
                        {getSessionCount() !== 1 ? "s" : ""}, {getTodoCount()}{" "}
                        todo{getTodoCount() !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </Label>
                </div>

                {/* Agents - Only show if project has agents */}
                {shouldShowAgents && (
                  <div className="flex items-center space-x-3">
                    <Switch
                      id="delete-agents"
                      checked={deleteOptions.agents}
                      onCheckedChange={(checked) =>
                        handleDeleteOptionChange("agents", !!checked)
                      }
                    />
                    <Label
                      htmlFor="delete-agents"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <div>
                        <div>Project Agents</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getAgentCount()} agent
                          {getAgentCount() !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </Label>
                  </div>
                )}

                {/* Memories - Only show if project has CLAUDE.md files */}
                {shouldShowMemories && (
                  <div className="flex items-center space-x-3">
                    <Switch
                      id="delete-memories"
                      checked={deleteOptions.memories}
                      onCheckedChange={(checked) =>
                        handleDeleteOptionChange("memories", !!checked)
                      }
                    />
                    <Label
                      htmlFor="delete-memories"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <div>
                        <div>Project Memories</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getMemoryCount()} CLAUDE.md file
                          {getMemoryCount() !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </Label>
                  </div>
                )}

                {/* Settings - Only show if project has .claude configuration */}
                {shouldShowSettings && (
                  <div className="flex items-center space-x-3">
                    <Switch
                      id="delete-settings"
                      checked={deleteOptions.settings}
                      onCheckedChange={(checked) =>
                        handleDeleteOptionChange("settings", !!checked)
                      }
                    />
                    <Label
                      htmlFor="delete-settings"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <div>
                        <div>Project Settings</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getSettingsCount()} settings file
                          {getSettingsCount() !== 1 ? "s" : ""} (settings.json,
                          settings.local.json)
                        </div>
                      </div>
                    </Label>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleProjectDeleteCancel}
                disabled={isDeletingProject}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  selectedProject && handleProjectDeleted(selectedProject.id)
                }
                disabled={isDeletingProject || deletionCounts.loading}
              >
                {isDeletingProject ? "Deleting..." : "Delete Selected Data"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabPageLayout>
    </>
  );
};
