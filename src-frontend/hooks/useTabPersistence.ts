import { useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { Tab } from '@/contexts/TabContext';
import { logger } from '@/lib/logger';
import { useTabDehydration, type BasePersistedTab } from './useTabDehydration';

const STORAGE_KEY = 'tabs_session';

export interface PersistedTabSession {
  tabs: BasePersistedTab[];
  panelBreaks: number[];
  activePanelIndex: number;
}

/**
 * Hook for persisting tab state to backend storage
 * Provides save/load functionality with automatic tab filtering
 */
export const useTabPersistence = () => {
  const { dehydrateTabs } = useTabDehydration();

  /**
   * Save tabs and panel state to backend storage
   * Only saves tabs that can be meaningfully restored
   */
  const saveTabs = useCallback(async (tabs: Tab[], panelBreaks: number[] = [], activePanelIndex: number = 0) => {
    try {
      // Use dehydration system to convert tabs to persistable data
      const restorableTabs: BasePersistedTab[] = dehydrateTabs(tabs);

      if (restorableTabs.length === 0) {
        // Clear storage if no tabs to restore
        await api.saveSetting(STORAGE_KEY, '');
        return;
      }

      const sessionData: PersistedTabSession = {
        tabs: restorableTabs,
        panelBreaks,
        activePanelIndex,
      };

      await api.saveSetting(STORAGE_KEY, JSON.stringify(sessionData));
      
      logger.debug('💾 Saved tab session:', { 
        tabCount: restorableTabs.length, 
        panelCount: panelBreaks.length + 1,
        activePanelIndex 
      });
    } catch (error) {
      logger.error('Failed to save tab session:', error);
    }
  }, [dehydrateTabs]);

  /**
   * Load tabs and panel state from backend storage
   * Returns persisted session data that can be restored
   */
  const loadTabs = useCallback(async (): Promise<PersistedTabSession> => {
    try {
      const serialized = await api.getSetting(STORAGE_KEY);
      if (!serialized) {
        return { tabs: [], panelBreaks: [], activePanelIndex: 0 };
      }

      // The data is already a JSON string from backend, parse it once
      const parsed = JSON.parse(serialized) as PersistedTabSession;
      
      // Validate structure
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tabs)) {
        logger.warn('Invalid tab session data found, ignoring');
        return { tabs: [], panelBreaks: [], activePanelIndex: 0 };
      }

      // Ensure panelBreaks and activePanelIndex exist
      const sessionData: PersistedTabSession = {
        tabs: parsed.tabs,
        panelBreaks: parsed.panelBreaks || [],
        activePanelIndex: parsed.activePanelIndex || 0,
      };

      logger.debug('📂 Loaded tab session:', { 
        tabCount: sessionData.tabs.length,
        panelCount: sessionData.panelBreaks.length + 1,
        activePanelIndex: sessionData.activePanelIndex
      });
      return sessionData;
    } catch (error) {
      logger.error('Failed to load tab session:', error);
      return { tabs: [], panelBreaks: [], activePanelIndex: 0 };
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