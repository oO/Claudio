import { useState, useCallback } from 'react';

/**
 * Simple hook to track unsaved changes - minimal implementation
 */
export const useUnsavedChanges = (isDirty: boolean = false) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(isDirty);

  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const markClean = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  return {
    hasUnsavedChanges,
    markDirty,
    markClean,
    setHasUnsavedChanges,
    markAsSaved: markClean // alias for backwards compatibility
  };
};