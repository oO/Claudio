import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { Loader2, Plus, MoreVertical, Trash2, Settings, Activity, FolderOpen } from "lucide-react";
import { api, type Project, type Session, type ClaudeMdFile } from "@/lib/api";
import { logger } from "@/lib/logger";
import { prettifyProjectName } from "@/lib/utils";
import { formatSessionIdCompact } from "@/lib/sessionUtils";
import { ProjectList, ProjectDetail } from "@/components/projects";
import { RunningClaudeSessions } from "@/components/sessions/RunningClaudeSessions";
import { SessionDetail } from "@/components/sessions/SessionDetail";
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
import { Toast, type ToastType } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { TabPageLayout } from "@/components/common";
import { useTabState } from "@/hooks/useTabState";
import { useScreenTracking, useProjectListWatcher, useSessionCreation } from "@/hooks";
// Removed: useNavigation - over-engineered for simple 3-level navigation
import { SESSION_TYPES } from "@/lib/sessionHandleApi";
import { Tab } from "@/contexts/TabContext";

interface ProjectsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ tab, isActive }) => {
  const { updateTab, findTabBySessionId, createProjectTab } = useTabState();
  const { createClaudioSession } = useSessionCreation();
  // Simple 3-level navigation state - KISS approach
  type ViewLevel = 'projects' | 'project' | 'session';

  // Initialize viewLevel based on tab type and restoration state
  const getInitialViewLevel = (): ViewLevel => {
    if (tab.type === 'project-session') return 'session';
    if (tab.type === 'project') return 'project';
    return 'projects';
  };

  const [viewLevel, setViewLevel] = useState<ViewLevel>(getInitialViewLevel());


  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeProjectTab, setActiveProjectTab] = useState<string>("sessions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Session viewing state - to render SessionDetail directly
  const [viewingSession, setViewingSession] = useState<{
    session: any;
    projectPath: string;
    backState: {
      selectedProject: Project | null;
      activeTab: string;
    };
  } | null>(null);
  const [projectDeleteDialogOpen, setProjectDeleteDialogOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    show: boolean;
  }>({ message: "", type: "info", show: false });

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

  // Watch for project list changes using file watcher
  useProjectListWatcher({
    onProjectListChanged: async () => {
      // Always trigger flash animation
            updateTab(tab.id, { lastActivityAt: Date.now() });
      
      // Only refresh data if tab is visible and in project list mode
      if (isActive && tab.type === "projects" && !selectedProject) {
                await loadProjects();
      }
    },
    enabled: tab.type === "projects", // Watch even when tab is not active so it can flash
  });


  // Removed: Dialog state logging - pure noise

  // Load projects when tab becomes active and is of type 'projects'
  useEffect(() => {
    const loadTabContent = async () => {
      if (isActive && tab.type === "projects") {
        // Load project list for projects mode
        loadProjects();
      } else if (isActive && tab.type === "project") {
        if (tab.restoreProjectState) {
          // Set up restored project state
          const project = tab.restoreProjectState.selectedProject;
          setSelectedProject(project);
          setActiveProjectTab(tab.restoreProjectState.activeTab || "sessions");
          logger.debug('Applied restored project state:', project?.path);
        } else if (tab.initialProjectPath) {
          // Restore project from path
          try {
            const projectList = await api.listProjects();
            const project = projectList.find((p: any) => p.path === tab.initialProjectPath);

            if (project) {
              setSelectedProject(project);
              setActiveProjectTab("sessions");

              // Update tab title to show project name
              const projectName = getProjectName(project.path);
              updateTab(tab.id, { title: projectName });

              logger.debug('Restored project from path:', project.path);
            } else {
              logger.warn(`Project not found for restoration: ${tab.initialProjectPath}`);
              setError(`Project not found: ${tab.initialProjectPath}`);
            }
          } catch (error) {
            logger.error('Failed to restore project tab:', error);
            setError('Failed to restore project tab');
          }
        }
      }
    };

    loadTabContent();
  }, [isActive, tab.type]);

  // Handle project-session tabs restoration
  useEffect(() => {
    const setupSessionTab = async () => {
      if (isActive && tab.type === 'project-session' && !viewingSession) {
        if (tab.sessionId && tab.initialProjectPath) {
          // Restore session from sessionId and path
          try {
            const projectList = await api.listProjects();
            const project = projectList.find((p: any) => p.path === tab.initialProjectPath);

            if (project && project.id) {
              const projectSessions = await api.getProjectSessions(project.id);
              const session = projectSessions.find((s: any) => s.id === tab.sessionId);

              if (session) {
                setSelectedProject(project);
                setViewingSession({
                  session: session,
                  projectPath: tab.initialProjectPath,
                  backState: {
                    selectedProject: project,
                    activeTab: "sessions"
                  }
                });
                logger.debug('Restored session from sessionId and path');
              } else {
                logger.warn(`Session not found: ${tab.sessionId}`);
              }
            } else {
              logger.warn(`Project not found: ${tab.initialProjectPath}`);
            }
          } catch (error) {
            logger.error('Failed to restore session tab:', error);
          }
        }
      }
    };

    setupSessionTab();
  }, [isActive, tab.type, tab.restoreProjectState, tab.sessionId, tab.initialProjectPath, viewingSession]);

  // Determine view level based on current state - KISS approach
  useEffect(() => {
    const newViewLevel = viewingSession ? 'session' : selectedProject ? 'project' : 'projects';

    if (newViewLevel !== viewLevel) {
      logger.debug('View level changing from', viewLevel, 'to', newViewLevel);
      setViewLevel(newViewLevel);
    }
  }, [viewingSession, selectedProject, viewLevel]);

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

  const handleProjectClick = async (project: Project, event?: React.MouseEvent) => {
    // Check for Cmd+click (Mac) or Ctrl+click (Windows/Linux) to open in new tab
    if (event?.metaKey || event?.ctrlKey) {
      logger.log('Opening project in new tab due to modifier key:', project.id);
      const projectName = getProjectName(project.path);
      createProjectTab(project, projectName);
      return; // Don't process normal click
    }
    try {
      setSelectedProject(project);
      setError(null);

      const projectName = getProjectName(project.path);

      // Update tab to reflect project selection - simple approach
      updateTab(tab.id, {
        title: projectName,
        type: 'project',
        initialProjectPath: project.path,
        restoreProjectState: {
          selectedProject: project,
          activeTab: activeProjectTab
        }
      });
    } catch (err) {
      logger.error("Failed to select project:", err);
      setError("Failed to select project.");
      setSelectedProject(null);
    }
  };

  const handleBack = () => {
    logger.debug('handleBack clicked:', viewLevel);

    // Simple state-based navigation - KISS approach
    if (viewLevel === 'session') {
      logger.debug('Session to Project navigation');
      // Session -> Project: Clear viewing session
      setViewingSession(null);
      if (selectedProject) {
        const projectName = getProjectName(selectedProject.path);
        updateTab(tab.id, { title: projectName, type: 'project', displayId: undefined });
        logger.debug('Updated tab to project:', projectName);
      }
    } else if (viewLevel === 'project') {
      logger.debug('Project to Projects navigation');
      // Project -> Projects: Always works - where else would a project come from?
      setSelectedProject(null);
      setActiveProjectTab("sessions");
      updateTab(tab.id, {
        title: "Projects",
        type: 'projects',
        restoreProjectState: undefined,  // Clear restore state so it doesn't restore project again
        initialProjectPath: undefined    // Clear this too
      });
      logger.debug('Updated tab to projects list');
    } else {
      logger.debug('Already at projects level');
    }
  };

  // Get project name from path
  const getProjectName = (path: string): string => {
    return prettifyProjectName(path);
  };

  // Session counts are now managed by ProjectSessionTab
  const getSessionCount = () => 0; // TODO: Get from ProjectSessionTab if needed
  const getTodoCount = () => 0; // TODO: Get from ProjectSessionTab if needed

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


  // Helper function to show toast notifications
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, show: true });
  };

  const handleProjectDeleted = async (projectId: string) => {
    setIsDeletingProject(true);
    try {

      // Call the deletion API and get the results
      const result = await api.deleteClaudeProject(projectId);

      // Deletion summary logged by backend API

      // Remove project from projects list
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      // Go back to projects view in the same tab
      handleBack();
      setProjectDeleteDialogOpen(false);

      // Create deletion summary for toast
      const projectName = getProjectName(selectedProject?.path || '');
      let deletionParts = [];
      
      if (result.sessions_deleted > 0) {
        deletionParts.push(`${result.sessions_deleted} sessions`);
      }
      if (result.claudio_sessions_deleted > 0) {
        deletionParts.push(`${result.claudio_sessions_deleted} claudio sessions`);
      }
      if (result.todos_deleted > 0) {
        deletionParts.push(`${result.todos_deleted} todos`);
      }
      if (result.timelines_deleted > 0) {
        deletionParts.push(`${result.timelines_deleted} timelines`);
      }
      if (result.agents_deleted > 0) {
        deletionParts.push(`${result.agents_deleted} agents`);
      }
      if (result.memories_deleted > 0) {
        deletionParts.push(`${result.memories_deleted} memories`);
      }
      if (result.settings_deleted > 0) {
        deletionParts.push(`${result.settings_deleted} settings`);
      }

      const deletionSummary = deletionParts.join(', ');
      
      // Show success toast
      showToast(
        `${projectName} deleted successfully! Removed: ${deletionSummary} (${result.size_mb.toFixed(1)} MB freed)`,
        'success'
      );
    } catch (error) {
      logger.error("Failed to delete project:", error);
      showToast(`Failed to delete project: ${error}`, 'error');
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleProjectDeleteClick = async () => {

    if (!selectedProject) return;

    // Reset delete options to defaults when opening dialog
    setDeleteOptions({
      sessions: true, // Always enabled and locked
      agents: false, // Optional
      memories: false, // Optional (CLAUDE.md files)
      settings: false, // Optional (.claude/ directory and settings)
    });

    setProjectDeleteDialogOpen(true);

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

  const handleNewClaudioSession = async (projectPath?: string) => {
    try {
      let pathToUse = projectPath;
      
      if (!pathToUse) {
        // Show native folder picker dialog
        const selectedPath = await open({
          directory: true,
          multiple: false,
          title: "Select Project Folder",
        });
        
        if (!selectedPath) {
          logger.debug('No folder selected, cancelling session creation');
          return;
        }
        
        pathToUse = selectedPath;
        logger.debug('Selected folder:', pathToUse);
      }
      
      // Use shared session creation hook
      const claudioId = await createClaudioSession({ projectPath: pathToUse });
      
      // Create a minimal Session object for the new Claudio session
      const newSession: Session = {
        id: claudioId, // Just the claudioId - backend will handle everything else
        project_id: pathToUse.split('/').pop() || 'project',
        project_path: pathToUse,
        created_at: Date.now(),
        modified_at: Date.now(),
        first_message: undefined,
        message_timestamp: undefined,
        size_bytes: 0,
        live_session_type: SESSION_TYPES.CLAUDIO,
      };
      
      // Update current tab to project-session type and show inline like native sessions
      const projectName = pathToUse.split("/").pop() || "Project";
      const sessionShort = formatSessionIdCompact(claudioId.replace('claudio-', ''));
      
      updateTab(tab.id, { 
        title: projectName,
        displayId: sessionShort || undefined,
        type: 'project-session',
        sessionId: claudioId,
        sessionData: newSession 
      });
      
      // Set viewing session state to render SessionDetail inline
      setViewingSession({
        session: newSession,
        projectPath: pathToUse,
        backState: {
          selectedProject: selectedProject,
          activeTab: "sessions",
        },
      });
      
      
    } catch (error) {
      logger.error('Failed to create Claudio session:', error);
      // TODO: Show toast notification if available
    }
  };


  // Handle back navigation from session view - simple approach
  const handleBackFromSession = () => {
    logger.debug('handleBackFromSession clicked:', viewLevel);

    if (viewingSession) {
      // Restore previous state from backState
      setSelectedProject(viewingSession.backState.selectedProject);
      setActiveProjectTab(viewingSession.backState.activeTab);
      setViewingSession(null);

      // Update tab to project view
      if (viewingSession.backState.selectedProject) {
        const projectName = getProjectName(viewingSession.backState.selectedProject.path);
        updateTab(tab.id, { title: projectName, type: 'project', displayId: undefined });
        logger.debug('Session to Project updated tab:', projectName);
      }
    }
  };

  // Handle session resume - fetch updated session data and refresh the view
  const handleSessionResumed = async (claudioId: string) => {
    logger.debug('Session resumed with new claudio_id:', claudioId);

    try {
      if (!viewingSession?.backState?.selectedProject?.id) {
        logger.error('Cannot refresh session: missing project info');
        return;
      }

      // Get updated session data directly from API
      const updatedSessions = await api.getProjectSessions(viewingSession.backState.selectedProject.id);
      const updatedSession = updatedSessions.find((s: any) => s.id === claudioId);

      if (!updatedSession) {
        logger.error('Could not find resumed session with claudio_id:', claudioId);
        return;
      }

      // Update the viewing session with the new session data
      setViewingSession({
        session: updatedSession,
        projectPath: viewingSession.projectPath,
        backState: {
          ...viewingSession.backState,
        }
      });

      // Update tab with new session info
      const projectName = getProjectName(viewingSession.projectPath);
      const sessionShort = formatSessionIdCompact(claudioId.replace('claudio-', ''));
      updateTab(tab.id, {
        title: projectName,
        displayId: sessionShort || undefined,
        type: 'project-session',
        sessionId: claudioId,
      });

    } catch (error) {
      logger.error("Failed to refresh session after resume:", error);
    }
  };


  // Render SessionDetail if viewing a session (with valid session object) - legacy inline view
  if (viewingSession && viewingSession.session) {
    return (
      <>
        <DebugLabel label="ProjectsTab" />
        <SessionDetail
          session={viewingSession.session}
          projectPath={viewingSession.projectPath}
          onBack={handleBackFromSession}
          tabId={tab.id}
          isActive={isActive}
          onSetTabActivity={() => updateTab(tab.id, { lastActivityAt: Date.now() })}
          onSessionResumed={handleSessionResumed}
        />
      </>
    );
  }

  return (
    <>
      <DebugLabel label="ProjectsTab" />
      <TabPageLayout
        title={
          selectedProject ? getProjectName(selectedProject.path) : "Projects"
        }
        subtitle={
          selectedProject
            ? selectedProject.path
            : "Browse your Claude Code sessions"
        }
        onBack={selectedProject ? handleBack : undefined}
        contentPadding={false}
        actions={
          selectedProject ? (
            <DropdownMenu
              onOpenChange={(open) => {
                // Dropdown state change handled by component
              }}
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
                onCloseAutoFocus={(e) => {
                  // Menu close focus handled by component
                }}
              >
                <DropdownMenuItem
                  onClick={(e) => {
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

            {/* Content - always show, loading handled inside components */}
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
                      projectPath={selectedProject.path}
                      projectId={selectedProject.id}
                      initialActiveTab={activeProjectTab}
                      onActiveTabChange={setActiveProjectTab}
                      onSessionClick={async (session) => {
                        
                        // Check for deduplication FIRST - before any processing
                        const existingTab = findTabBySessionId(session.id);
                        if (existingTab && existingTab.id !== tab.id) {
                          logger.log('Session already open in tab:', existingTab.id, 'focusing that tab instead');
                          window.dispatchEvent(
                            new CustomEvent("switch-to-tab", {
                              detail: { tabId: existingTab.id },
                            }),
                          );
                          return; // Don't proceed with opening in current tab
                        }
                        
                        if (session.live_session_type === SESSION_TYPES.CLAUDIO) {
                          // Interactive claudio session - same pattern as native sessions
                          logger.debug('Continuing claudio session:', session.id);

                          const projectName = getProjectName(session.project_path);
                          const sessionShort = session.id ? formatSessionIdCompact(session.id) ?? undefined : undefined;

                          // Simple session navigation - just update tab and set viewing session
                          updateTab(tab.id, {
                            title: projectName,
                            displayId: sessionShort,
                            type: 'project-session',
                            sessionId: session.id,
                            sessionData: session
                          });

                          setViewingSession({
                            session: session,
                            projectPath: session.project_path,
                            backState: {
                              selectedProject: selectedProject,
                              activeTab: activeProjectTab,
                            },
                          });
                        } else {
                          // Native Claude Code session - set viewing session state for read-only view
                          logger.debug('Opening native session:', session.id);

                          const projectName = getProjectName(session.project_path);
                          const sessionShort = session.id ? formatSessionIdCompact(session.id) ?? undefined : undefined;

                          // Simple session navigation for native sessions too
                          updateTab(tab.id, {
                            title: projectName,
                            displayId: sessionShort,
                            type: 'project-session',
                            sessionId: session.id,
                            sessionData: session
                          });

                          setViewingSession({
                            session: session,
                            projectPath: session.project_path,
                            backState: {
                              selectedProject: selectedProject,
                              activeTab: activeProjectTab,
                            },
                          });
                          
                        }
                      }}
                      onEditClaudeFile={(
                        file: ClaudeMdFile,
                        currentActiveTab: string,
                      ) => {
                        // Open CLAUDE.md file in same tab
                        updateTab(tab.id, {
                          type: "claude-file",
                          title: file.relative_path,
                          claudeFileId: file.absolute_path,
                          sourceContext: currentActiveTab,
                        });
                      }}
                      onEditAgent={(agent, currentActiveTab: string) => {
                        // Open agent edit in same tab
                        updateTab(tab.id, {
                          type: "create-agent",
                          title: `Edit ${agent.name}`,
                          agentData: agent,
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
                      onSessionDeleted={async (sessionId) => {
                        // Session deletion handled by ProjectSessionTab
                        updateTab(tab.id, { lastActivityAt: Date.now() });
                      }}
                      onProjectDeleted={handleProjectDeleted}
                      onToast={(message, type) => {
                        // Simple toast implementation - could be enhanced with a proper toast system
                        // TODO: Integrate with a proper toast notification system
                      }}
                      onSessionsDeleted={async () => {
                        // Session deletion handled by ProjectSessionTab
                        updateTab(tab.id, { lastActivityAt: Date.now() });
                      }}
                      onSessionsRefresh={async () => {
                        // Session refresh handled by ProjectSessionTab
                        updateTab(tab.id, { lastActivityAt: Date.now() });
                      }}
                      selectedProject={selectedProject}
                      currentTab={tab}
                      onUpdateTab={updateTab}
                      onStartNewClaudioSession={handleNewClaudioSession}
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
                      className="mb-4 flex gap-2 justify-end"
                    >
                      <Button
                        onClick={() => handleNewClaudioSession()}
                        size="default"
                        className="accent-button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Session
                      </Button>
                    </motion.div>

                    {/* Running Claude Sessions */}
                    <RunningClaudeSessions />

                    {/* Project list */}
                    {projects.length === 0 && !loading ? (
                      <div className="text-center py-8">
                        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                          No projects found
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create a new Claude Code session to get started.
                        </p>
                        <Button onClick={() => handleNewClaudioSession()} size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          New Session
                        </Button>
                      </div>
                    ) : projects.length > 0 ? (
                      <ProjectList
                        projects={projects}
                        onProjectClick={handleProjectClick}
                        loading={loading}
                        className="animate-fade-in"
                      />
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
          </div>
        </div>

        {/* Project delete confirmation dialog */}
        <Dialog
          open={projectDeleteDialogOpen}
          onOpenChange={(open) => {
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

      {/* Toast notifications */}
      {toast.show && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={5000}
            onDismiss={() => setToast(prev => ({ ...prev, show: false }))}
          />
        </div>
      )}
    </>
  );
};
