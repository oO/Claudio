import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import { listen } from '@tauri-apps/api/event';

/**
 * Project file event types that can be received from the backend
 */
export interface ProjectFileEvent {
  type: 'ProjectAdded' | 'ProjectRemoved' | 'ProjectModified';
  data: {
    project_id: string;
  };
}

interface UseProjectListWatcherOptions {
  /**
   * Callback when project list changes and needs refresh
   */
  onProjectListChanged: () => Promise<void>;
  /**
   * Whether file watching is enabled
   */
  enabled?: boolean;
}

/**
 * Hook to watch project directory for changes using Tauri's native file watching
 * This replaces polling approaches with efficient file system events
 */
export function useProjectListWatcher({
  onProjectListChanged,
  enabled = true,
}: UseProjectListWatcherOptions) {
  const isStartedRef = useRef(false);
  
  // Removed: Hook call logging - too noisy on every render

  // Handle project file events from backend
  const handleProjectFileEvent = useCallback(async (event: ProjectFileEvent) => {
    
    // All project events should trigger a refresh of the project list
    try {
      await onProjectListChanged();
    } catch (error) {
      logger.error('Failed to refresh project list after file change:', error);
    }
  }, [onProjectListChanged]);

  // Start/stop the project watcher based on enabled state
  useEffect(() => {
    if (!enabled) {
      if (isStartedRef.current) {
        invoke('stop_project_watching').catch((error) => {
          logger.error('Failed to stop project watching:', error);
        });
        isStartedRef.current = false;
      }
      return;
    }

    if (!isStartedRef.current) {
      // Start the backend watcher (it logs its own results)
      invoke('start_project_watching').then(() => {
        isStartedRef.current = true;
      }).catch((error) => {
        logger.error('Failed to start project watching:', error);
      });
    }

    // Listen for project file events
    let unlisten: (() => void) | null = null;
    
    const setupListener = async () => {
      try {
        unlisten = await listen<ProjectFileEvent>('project_file_event', (event) => {
          handleProjectFileEvent(event.payload);
        });
      } catch (error) {
        logger.error('Failed to setup project file event listener:', error);
      }
    };
    
    setupListener();

    // Cleanup function
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [enabled, handleProjectFileEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStartedRef.current) {
        invoke('stop_project_watching').catch((error) => {
          logger.error('Failed to stop project watching on cleanup:', error);
        });
        isStartedRef.current = false;
      }
    };
  }, []);

  // Manual refresh function for compatibility
  const forceRefresh = useCallback(async () => {
    try {
      await onProjectListChanged();
    } catch (error) {
      logger.error('Failed to force refresh project list:', error);
    }
  }, [onProjectListChanged]);

  return {
    /**
     * Whether the project watcher is currently running
     */
    isWatching: isStartedRef.current,
    
    /**
     * Manual refresh function (for backward compatibility)
     */
    forceRefresh,
  };
}