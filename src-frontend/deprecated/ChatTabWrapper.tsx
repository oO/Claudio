import React from 'react';
import { useTabState } from '@/hooks/useTabState';
// import { ClaudeCodeSession } from '@/components/sessions'; // DEPRECATED: moved to /deprecated folder
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
    <div className="p-4 text-center">
      <h2 className="text-lg font-semibold mb-2">Chat Tab Temporarily Disabled</h2>
      <p className="text-muted-foreground">
        This feature is being migrated to use the new SessionHandleView architecture.
        <br />
        Please use the Projects tab to access sessions for now.
      </p>
    </div>
  );
  
  // TODO: Update to use SessionHandleView instead of deprecated ClaudeCodeSession
  // return (
  //   <ClaudeCodeSession
  //     session={tab.sessionData}
  //     sessionId={tab.sessionId}
  //     initialProjectPath={tab.initialProjectPath || tab.sessionId}
  //     onBack={handleBack}
  //   />
  // );
};