import { useEffect, useCallback } from 'react';
import { api, type WindowState } from '@/lib/api';
import { logger } from '@/lib/logger';

export const useWindowState = () => {
  const saveCurrentWindowState = useCallback(async () => {
    try {
      const currentState = await api.getCurrentWindowState();
      await api.saveWindowState(currentState);
      logger.log('Window state saved manually:', currentState);
      return currentState;
    } catch (error) {
      logger.error('Failed to save window state manually:', error);
      throw error;
    }
  }, []);

  const restoreWindowState = useCallback(async () => {
    try {
      await api.restoreWindowState();
      logger.log('Window state restored manually');
    } catch (error) {
      logger.error('Failed to restore window state manually:', error);
      throw error;
    }
  }, []);

  const loadWindowState = useCallback(async (): Promise<WindowState> => {
    try {
      const state = await api.loadWindowState();
      logger.log('Loaded window state:', state);
      return state;
    } catch (error) {
      logger.error('Failed to load window state:', error);
      throw error;
    }
  }, []);

  // Auto-restore on mount
  useEffect(() => {
    const autoRestore = async () => {
      try {
        await restoreWindowState();
      } catch (error) {
        logger.warn('Auto-restore failed, using defaults:', error);
      }
    };

    // Small delay to ensure window is fully initialized
    const timeoutId = setTimeout(autoRestore, 100);
    return () => clearTimeout(timeoutId);
  }, [restoreWindowState]);

  // Auto-save on important events (backend handles move/resize debouncing)
  useEffect(() => {
    const autoSave = async () => {
      try {
        await saveCurrentWindowState();
      } catch (error) {
        // Silent fail for event-based saves
        logger.debug('Event-based window state save failed:', error);
      }
    };

    // Save on visibility change (user switching apps)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        autoSave();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveCurrentWindowState]);

  return {
    saveCurrentWindowState,
    restoreWindowState,
    loadWindowState,
  };
};