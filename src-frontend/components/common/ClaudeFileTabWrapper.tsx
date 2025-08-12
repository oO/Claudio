import React, { lazy } from 'react';
import { useTabState } from '@/hooks/useTabState';
import type { Tab } from '@/contexts/TabContext';

const ClaudeFileEditor = lazy(() =>
  import("@/components/claude").then((m) => ({
    default: m.ClaudeFileEditor,
  })),
);

interface ClaudeFileTabWrapperProps {
  tab: Tab;
}

export const ClaudeFileTabWrapper: React.FC<ClaudeFileTabWrapperProps> = ({ tab }) => {
  const { updateTab } = useTabState();

  const handleBack = () => {
    // Check if we came from a project detail view
    if (tab.previousState?.type === "projects" && tab.previousState?.selectedProject) {
      // Return to the project detail view with the correct state
      updateTab(tab.id, {
        type: "projects",
        title: tab.previousState.title || "Projects",
        // Restore the full project state to show project detail, not project list
        restoreProjectState: {
          selectedProject: tab.previousState.selectedProject,
          sessions: tab.previousState.sessions || [],
          activeTab: tab.restoreProjectState?.activeTab || "memories",
        },
        // Clear the claude file data
        claudeFileId: undefined,
      });
    } else {
      // Fallback to projects tab list
      updateTab(tab.id, {
        type: "projects",
        title: "Projects",
        // Clear any restore state to show project list
        restoreProjectState: undefined,
        claudeFileId: undefined,
      });
    }
  };

  if (!tab.claudeFileId) {
    return <div className="p-4">No Claude file path specified</div>;
  }

  // Create a ClaudeMdFile object from the stored file path
  const file = {
    absolute_path: tab.claudeFileId,
    relative_path: tab.title,
    size: 0,
    modified: 0,
  };

  // Determine initial mode based on source context
  // Files opened from memories tab should start in view mode
  const initialMode = tab.sourceContext === "memories" ? "preview" : "edit";

  const handleDelete = () => {
    // Refresh the parent component that manages the file list
    // This could be improved by using a more sophisticated state management approach
    window.dispatchEvent(new CustomEvent('file-deleted', { 
      detail: { filePath: file.absolute_path } 
    }));
  };

  return (
    <ClaudeFileEditor
      file={file}
      onBack={handleBack}
      initialMode={initialMode}
      onDelete={handleDelete}
    />
  );
};