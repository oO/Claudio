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
    // Always fallback to projects tab without using navigation stack
    updateTab(tab.id, {
      type: "projects",
      title: tab.previousState?.title || "Projects",
      // Restore project state if it exists
      restoreProjectState: tab.restoreProjectState,
      // Clear the claude file data
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

  return (
    <ClaudeFileEditor
      file={file}
      onBack={handleBack}
    />
  );
};