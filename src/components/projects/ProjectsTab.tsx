import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, MoreVertical, Trash2, Settings } from "lucide-react";
import { api, type Project, type Session, type ClaudeMdFile } from "@/lib/api";
import { ProjectList, ProjectDetail } from "@/components/projects";
import { RunningClaudeSessions } from "@/components/sessions";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
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
import { TabPageLayout } from "@/components/common";
import { useTabState } from "@/hooks/useTabState";
import { useScreenTracking } from "@/hooks/useAnalytics";
import { Tab } from "@/contexts/TabContext";

interface ProjectsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ tab, isActive }) => {
  const { updateTab, createChatTab } = useTabState();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectDeleteDialogOpen, setProjectDeleteDialogOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  
  // Delete options state
  const [deleteOptions, setDeleteOptions] = useState({
    sessions: true,    // Always enabled and locked
    agents: false,     // Optional
    memories: false,   // Optional (CLAUDE.md files)
    settings: false,   // Optional (.claude/ directory and settings)
  });
  
  // We'll derive this from existing data - no need for separate state

  // Track screen when tab becomes active
  useScreenTracking(
    isActive ? tab.type : undefined,
    isActive ? tab.id : undefined,
  );

  // Debug dialog state changes
  useEffect(() => {
    console.log("📊 projectDeleteDialogOpen state changed to:", projectDeleteDialogOpen);
  }, [projectDeleteDialogOpen]);

  // Load projects when tab becomes active and is of type 'projects'
  useEffect(() => {
    if (isActive && tab.type === "projects") {
      // Check if we need to restore a previous state (like project detail view)
      if (
        tab.previousState?.type === "project-detail" &&
        tab.previousState.selectedProject
      ) {
        setSelectedProject(tab.previousState.selectedProject);
        setSessions(tab.previousState.sessions || []);
        // Clear the previous state since we've restored it
        updateTab(tab.id, { previousState: undefined });
      } else {
        loadProjects();
      }
    }
  }, [isActive, tab.type, tab.previousState]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(
        "Failed to load projects. Please ensure ~/.claude directory exists.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = async (project: Project) => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);

      // Update tab title to project name
      const projectName = getProjectName(project.path);
      updateTab(tab.id, { title: projectName });
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("Failed to load sessions for this project.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedProject(null);
    setSessions([]);
    // Restore tab title to "Projects"
    updateTab(tab.id, { title: "Projects" });
  };

  // Get project name from path
  const getProjectName = (path: string): string => {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  // Calculate deletion counts from existing data
  const getSessionCount = () => sessions.length;
  const getTodoCount = () => {
    return sessions.reduce((total, session) => {
      return total + (session.todo_counts?.total || 0);
    }, 0);
  };
  
  // Return real counts - these should come from actual project data
  // For now, return 0 until we wire up the real data from ProjectDetail tabs
  const getAgentCount = () => 0; // TODO: Get from ProjectDetail agents tab data
  const getMemoryCount = () => 0; // TODO: Get from ProjectDetail memories tab data  
  const getSettingsCount = () => 0; // TODO: Detect .claude/ directory existence
  
  // Helper to check if we should show optional deletion options
  const shouldShowAgents = getAgentCount() > 0;
  const shouldShowMemories = getMemoryCount() > 0;
  const shouldShowSettings = getSettingsCount() > 0;

  const handleSessionDeleted = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleProjectDeleted = async (projectId: string) => {
    setIsDeletingProject(true);
    try {
      console.log("🗑️ Deleting project with options:", deleteOptions);
      
      // Call the deletion API and get the results
      const result = await api.deleteClaudeProject(projectId);
      
      console.log("✅ Project deletion completed:", result);
      console.log(`📊 Deletion summary:
        - Sessions: ${result.sessions_deleted}
        - Todos: ${result.todos_deleted} 
        - Timelines: ${result.timelines_deleted}
        - Size freed: ${result.size_mb.toFixed(2)} MB
        - Message: ${result.message}`);
      
      // Remove project from projects list
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      // Go back to projects view in the same tab
      handleBack();
      setProjectDeleteDialogOpen(false);
      
      // Show success feedback
      alert(`Project deleted successfully!\n\nDeleted:\n- ${result.sessions_deleted} sessions\n- ${result.todos_deleted} todo files\n- ${result.timelines_deleted} timelines\n- ${result.size_mb.toFixed(2)} MB freed`);
      
    } catch (error) {
      console.error("❌ Failed to delete project:", error);
      alert(`Failed to delete project: ${error}`);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleProjectDeleteClick = () => {
    console.log("🔥 DELETE BUTTON CLICKED - handleProjectDeleteClick called");
    console.log("Current selectedProject:", selectedProject);
    console.log("Current projectDeleteDialogOpen state:", projectDeleteDialogOpen);
    
    // Reset delete options to defaults when opening dialog
    setDeleteOptions({
      sessions: true,    // Always enabled and locked
      agents: false,     // Optional
      memories: false,   // Optional (CLAUDE.md files)
      settings: false,   // Optional (.claude/ directory and settings)
    });
    
    setProjectDeleteDialogOpen(true);
    console.log("✅ setProjectDeleteDialogOpen(true) called");
  };

  const handleProjectDeleteCancel = () => {
    setProjectDeleteDialogOpen(false);
  };

  const handleDeleteOptionChange = (option: keyof typeof deleteOptions, checked: boolean) => {
    setDeleteOptions(prev => ({
      ...prev,
      [option]: checked
    }));
  };

  const handleNewSession = () => {
    // Create a new chat tab
    createChatTab();
  };

  // Debug rendering
  console.log("🎪 Rendering ProjectsTab, selectedProject:", selectedProject?.path || "none");

  return (
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
          <DropdownMenu onOpenChange={(open) => console.log("🎪 Dropdown onOpenChange:", open)}>
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
              onCloseAutoFocus={(e) => console.log("🔒 Menu closing, focus:", e)}
            >
              <DropdownMenuItem
                onClick={(e) => {
                  console.log("🎯 DropdownMenuItem clicked - onClick fired");
                  console.log("Event:", e);
                  e.preventDefault();
                  e.stopPropagation();
                  handleProjectDeleteClick();
                }}
                className="text-destructive"
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
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner message="Loading projects..." />
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
                    onSessionClick={(session) => {
                      // Update tab to show this session
                      updateTab(tab.id, {
                        type: "chat",
                        title:
                          session.project_path.split("/").pop() || "Session",
                        sessionId: session.id,
                        sessionData: session, // Store full session object
                        initialProjectPath: session.project_path,
                      });
                    }}
                    onEditClaudeFile={(file: ClaudeMdFile) => {
                      // Open CLAUDE.md file in a new tab with return context
                      window.dispatchEvent(
                        new CustomEvent("open-claude-file", {
                          detail: {
                            file,
                            returnContext: {
                              type: "project-detail",
                              selectedProject,
                              sessions,
                            },
                          },
                        }),
                      );
                    }}
                    onExecuteAgent={(agent) => {
                      // Open agent execution in a new tab
                      window.dispatchEvent(
                        new CustomEvent("open-agent-execution", {
                          detail: { agent },
                        }),
                      );
                    }}
                    onEditAgent={(agent) => {
                      // Open agent edit in a new tab with return context
                      window.dispatchEvent(
                        new CustomEvent("create-edit-agent-tab", {
                          detail: {
                            agent,
                            returnContext: {
                              type: "project-detail",
                              title: selectedProject
                                ? getProjectName(selectedProject.path)
                                : "Projects",
                              selectedProject,
                              sessions,
                            },
                          },
                        }),
                      );
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
                  {/* New session button at the top */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-4 flex justify-end"
                  >
                    <Button onClick={handleNewSession} size="default">
                      <Plus className="mr-2 h-4 w-4" />
                      New Claude Code Project
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
          console.log("🔔 Dialog onOpenChange called with:", open);
          setProjectDeleteDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Project Data</DialogTitle>
            <DialogDescription>
              {selectedProject && (
                <>
                  Choose what Claude Code data to delete for project "{getProjectName(selectedProject.path)}".
                  <br />
                  <br />
                  <strong>Note:</strong> This only removes Claude Code data (sessions, agents, memories, settings). 
                  Your actual project source code remains untouched.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Required</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {getSessionCount()} session{getSessionCount() !== 1 ? 's' : ''}, {getTodoCount()} todo{getTodoCount() !== 1 ? 's' : ''}
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
                    onCheckedChange={(checked) => handleDeleteOptionChange('agents', !!checked)}
                  />
                  <Label 
                    htmlFor="delete-agents" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <div>
                      <div>Project Agents</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getAgentCount()} agent{getAgentCount() !== 1 ? 's' : ''}
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
                    onCheckedChange={(checked) => handleDeleteOptionChange('memories', !!checked)}
                  />
                  <Label 
                    htmlFor="delete-memories" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <div>
                      <div>Project Memories</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getMemoryCount()} CLAUDE.md file{getMemoryCount() !== 1 ? 's' : ''}
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
                    onCheckedChange={(checked) => handleDeleteOptionChange('settings', !!checked)}
                  />
                  <Label 
                    htmlFor="delete-settings" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <div>
                      <div>Project Settings</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        .claude/ directory with settings, hooks, and configurations
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
              onClick={() => selectedProject && handleProjectDeleted(selectedProject.id)}
              disabled={isDeletingProject}
            >
              {isDeletingProject ? "Deleting..." : "Delete Selected Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabPageLayout>
  );
};
