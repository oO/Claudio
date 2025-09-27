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
    // Just go back to projects - the ProjectsTab will maintain its own state
    updateTab(tab.id, {
      type: "projects", 
      title: "Projects",
      claudeFileId: undefined,
    });
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