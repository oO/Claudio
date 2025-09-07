import { useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { Tab } from '@/contexts/TabContext';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'tabs_session';

export interface PersistedTab {
  type: Tab['type'];
  title: string;
  sessionId?: string;
  initialProjectPath?: string;
  agentRunId?: string;
  claudeFileId?: string;
  restoreProjectState?: any;
}

/**
 * Hook for persisting tab state to backend storage
 * Provides save/load functionality with automatic tab filtering
 */
export const useTabPersistence = () => {
  /**
   * Save tabs to backend storage
   * Only saves tabs that can be meaningfully restored
   */
  const saveTabs = useCallback(async (tabs: Tab[]) => {
    try {
      // Filter to only restorable tab types
      const restorableTabs: PersistedTab[] = tabs
        .filter(tab => {
          // Exclude temporary tabs that can't be restored
          return ![
            'create-agent',
            'import-agent'
          ].includes(tab.type);
        })
        .map(tab => ({
          type: tab.type,
          title: tab.title,
          sessionId: tab.sessionId,
          initialProjectPath: tab.initialProjectPath,
          agentRunId: tab.agentRunId,
          claudeFileId: tab.claudeFileId,
          restoreProjectState: tab.restoreProjectState,
        }));

      if (restorableTabs.length === 0) {
        // Clear storage if no tabs to restore
        await api.saveSetting(STORAGE_KEY, '');
        return;
      }

      await api.saveSetting(STORAGE_KEY, JSON.stringify(restorableTabs));
      
      logger.debug('💾 Saved tab session:', { count: restorableTabs.length });
    } catch (error) {
      logger.error('Failed to save tab session:', error);
    }
  }, []);

  /**
   * Load tabs from backend storage
   * Returns array of persisted tab data that can be restored
   */
  const loadTabs = useCallback(async (): Promise<PersistedTab[]> => {
    try {
      const serialized = await api.getSetting(STORAGE_KEY);
      if (!serialized) {
        return [];
      }

      // The data is already a JSON string from backend, parse it once
      const parsed = JSON.parse(serialized) as PersistedTab[];
      if (!Array.isArray(parsed)) {
        logger.warn('Invalid tab session data found, ignoring');
        return [];
      }

      logger.debug('📂 Loaded tab session:', { count: parsed.length });
      return parsed;
    } catch (error) {
      logger.error('Failed to load tab session:', error);
      return [];
    }
  }, []);

  /**
   * Clear saved tab session
   */
  const clearSavedTabs = useCallback(async () => {
    try {
      await api.saveSetting(STORAGE_KEY, '');
      logger.debug('🗑️ Cleared saved tab session');
    } catch (error) {
      logger.error('Failed to clear tab session:', error);
    }
  }, []);

  return {
    saveTabs,
    loadTabs,
    clearSavedTabs,
  };
};