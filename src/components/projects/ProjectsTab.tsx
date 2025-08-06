import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { api, type Project, type Session, type ClaudeMdFile } from '@/lib/api';
import { ProjectList } from '@/components/projects';
import { SessionList, RunningClaudeSessions } from '@/components/sessions';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/atoms/ActionButton';
import { LoadingSpinner } from '@/components/ui/atoms/LoadingSpinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TabPageLayout } from '@/components/common';
import { useTabState } from '@/hooks/useTabState';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';

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
  
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);
  
  // Load projects when tab becomes active and is of type 'projects'
  useEffect(() => {
    if (isActive && tab.type === 'projects') {
      // Check if we need to restore a previous state (like project detail view)
      if (tab.previousState?.type === 'project-detail' && tab.previousState.selectedProject) {
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
      setError("Failed to load projects. Please ensure ~/.claude directory exists.");
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
    updateTab(tab.id, { title: 'Projects' });
  };
  
  // Get project name from path
  const getProjectName = (path: string): string => {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  };
  
  const handleSessionDeleted = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };
  
  const handleProjectDeleted = (projectId: string) => {
    // Remove project from projects list
    setProjects(prev => prev.filter(p => p.id !== projectId));
    // Go back to projects view in the same tab
    handleBack();
  };
  
  const handleNewSession = () => {
    // Create a new chat tab
    createChatTab();
  };

  return (
    <TabPageLayout
      title={selectedProject ? getProjectName(selectedProject.path) : "Projects"}
      subtitle={selectedProject ? `${selectedProject.path} • ${sessions.length} session${sessions.length !== 1 ? 's' : ''}` : "Browse your Claude Code sessions"}
      onBack={selectedProject ? handleBack : undefined}
      contentPadding={false}
      actions={selectedProject ? (
        <DropdownMenu>
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                // Handle project deletion
                const confirmed = window.confirm(`Are you sure you want to delete the project "${getProjectName(selectedProject.path)}"?\n\nThis will permanently delete all project sessions and data.`);
                if (confirmed) {
                  handleProjectDeleted(selectedProject.id);
                }
              }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : undefined}
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
                  <SessionList
                    sessions={sessions}
                    projectPath={selectedProject.path}
                    projectId={selectedProject.id}
                    onBack={handleBack}
                    onSessionClick={(session) => {
                      // Update tab to show this session
                      updateTab(tab.id, {
                        type: 'chat',
                        title: session.project_path.split('/').pop() || 'Session',
                        sessionId: session.id,
                        sessionData: session, // Store full session object
                        initialProjectPath: session.project_path,
                      });
                    }}
                    onEditClaudeFile={(file: ClaudeMdFile) => {
                      // Open CLAUDE.md file in a new tab with return context
                      window.dispatchEvent(new CustomEvent('open-claude-file', { 
                        detail: { 
                          file,
                          returnContext: {
                            type: 'project-detail',
                            selectedProject,
                            sessions
                          }
                        } 
                      }));
                    }}
                    onExecuteAgent={(agent) => {
                      // Open agent execution in a new tab
                      window.dispatchEvent(new CustomEvent('open-agent-execution', { 
                        detail: { agent } 
                      }));
                    }}
                    onEditAgent={(agent) => {
                      // Open agent edit in a new tab with return context
                      window.dispatchEvent(new CustomEvent('create-edit-agent-tab', { 
                        detail: { 
                          agent,
                          returnContext: {
                            type: 'project-detail',
                            title: selectedProject ? getProjectName(selectedProject.path) : 'Projects',
                            selectedProject,
                            sessions
                          }
                        } 
                      }));
                    }}
                    onExportAgent={(agent) => {
                      // Export project agent (same logic as personal agents)
                      console.log('Export project agent:', agent);
                      // TODO: Implement proper export dialog
                    }}
                    onDeleteAgent={(agent) => {
                      // Delete agent and refresh agents list
                      // This would need to be implemented properly with confirmation dialog
                      console.log('Delete agent:', agent);
                    }}
                    onCreateAgent={() => {
                      // Open create agent tab for project agents
                      window.dispatchEvent(new CustomEvent('open-create-agent-tab'));
                    }}
                    onImportAgent={() => {
                      // Open import agent tab for project agents  
                      window.dispatchEvent(new CustomEvent('open-import-agent-tab'));
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
                    className="mb-4"
                  >
                    <Button
                      onClick={handleNewSession}
                      size="default"
                      className="w-full max-w-md"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Claude Code session
                    </Button>
                  </motion.div>

                  {/* Running Claude Sessions */}
                  <RunningClaudeSessions />

                  {/* Project list */}
                  {projects.length > 0 ? (
                    <ProjectList
                      projects={projects}
                      onProjectClick={handleProjectClick}
                      onProjectSettings={(project) => {
                        // Project settings functionality can be added here if needed
                        console.log('Project settings clicked for:', project);
                      }}
                      onProjectDeleted={handleProjectDeleted}
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
    </TabPageLayout>
  );
};