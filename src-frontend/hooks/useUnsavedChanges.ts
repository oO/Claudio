import { useEffect, useCallback } from 'react';
import { useTabContext } from '@/contexts/TabContext';

/**
 * Hook to manage unsaved changes for any editor component
 * Automatically updates the tab's hasUnsavedChanges flag
 * 
 * @param tabId - The ID of the current tab (if available)
 * @param hasChanges - Whether the editor has unsaved changes
 * @returns Object with handleSave callback that resets the unsaved state
 */
export const useUnsavedChanges = (hasChanges: boolean) => {
  const { activeTabId, updateTab } = useTabContext();

  // Update the tab's hasUnsavedChanges flag whenever it changes
  useEffect(() => {
    if (activeTabId) {
      updateTab(activeTabId, { hasUnsavedChanges: hasChanges });
    }
  }, [hasChanges, activeTabId, updateTab]);

  // Callback to mark changes as saved
  const markAsSaved = useCallback(() => {
    if (activeTabId) {
      updateTab(activeTabId, { hasUnsavedChanges: false });
    }
  }, [activeTabId, updateTab]);

  return { markAsSaved };
};

export default useUnsavedChanges;