import React from 'react';
import { useTabState } from '@/hooks/useTabState';
import { ClaudeCodeSession } from '@/components/sessions';
import type { Tab } from '@/contexts/TabContext';

interface ChatTabWrapperProps {
  tab: Tab;
}

export const ChatTabWrapper: React.FC<ChatTabWrapperProps> = ({ tab }) => {
  const { updateTab } = useTabState();

  const handleBack = () => {
    // Always use the restoreProjectState approach instead of navigation stack
    if (tab.restoreProjectState) {
      updateTab(tab.id, {
        type: "projects",
        title: "Project", // This will be updated by ProjectsTab
        restoreProjectState: tab.restoreProjectState,
        // Clear the session-specific data
        sessionData: undefined,
        sessionId: undefined,
        initialProjectPath: undefined,
      });
    } else if (tab.previousState && tab.previousState.type === "projects") {
      // Legacy fallback
      updateTab(tab.id, {
        type: "projects",
        title: tab.previousState.title,
        restoreProjectState: {
          selectedProject: tab.previousState.selectedProject,
          sessions: tab.previousState.sessions,
        },
        // Clear the session-specific data
        sessionData: undefined,
        sessionId: undefined,
        initialProjectPath: undefined,
        previousState: undefined,
      });
    } else {
      // Default fallback - go to projects list
      updateTab(tab.id, {
        type: "projects",
        title: "Projects",
        // Clear the session-specific data
        sessionData: undefined,
        sessionId: undefined,
        initialProjectPath: undefined,
      });
    }
  };

  return (
    <ClaudeCodeSession
      session={tab.sessionData}
      sessionId={tab.sessionId}
      initialProjectPath={tab.initialProjectPath || tab.sessionId}
      onBack={handleBack}
    />
  );
};