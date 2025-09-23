import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Tab } from '@/contexts/TabContext';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'tabs_session';

// Simple interface - just save raw tab data
export interface PersistedTabSession {
  tabs: Partial<Tab>[];  // Save tabs as-is, minus runtime stuff
  panelBreaks: number[];
  activePanelIndex: number;
}

// Default empty session structure
const DEFAULT_EMPTY_SESSION: PersistedTabSession = {
  tabs: [],
  panelBreaks: [],
  activePanelIndex: 0,
};

/**
 * KISS Tab persistence - just save/restore raw tab data on shutdown
 * No complex dehydration/rehydration nonsense!
 */
export const useTabPersistence = () => {

  /**
   * Save current tabs directly - no dehydration complexity
   */
  const saveTabs = useCallback(async (tabs: Tab[], panelBreaks: number[] = [], activePanelIndex: number = 0) => {
    try {
      
      // KISS: Only save minimal creation inputs, not fetched data
      const tabsToSave: Partial<Tab>[] = tabs.map(tab => {
        // Base fields that every tab needs
        const baseTab: Partial<Tab> = {
          type: tab.type,
          title: tab.title,
        };
        
        // Add type-specific creation parameters only
        switch (tab.type) {
          case 'project':
            return { ...baseTab, initialProjectPath: tab.initialProjectPath };
          case 'project-session':
            return { ...baseTab, sessionId: tab.sessionId, displayId: tab.displayId, initialProjectPath: tab.initialProjectPath };
          case 'claude-file':
            return { ...baseTab, claudeFileId: tab.claudeFileId };
          default:
            // Singleton tabs (projects, usage, settings, etc.) - just type & title
            return baseTab;
        }
        // Skip ALL fetched data: sessionData, restoreProjectState, agentData, etc.
        // These will be re-fetched on restoration - that's what the components do anyway!
      });

      if (tabsToSave.length === 0) {
        // Save empty session if no tabs
        await api.saveClaudioAppSetting(STORAGE_KEY, JSON.stringify(DEFAULT_EMPTY_SESSION));
        return;
      }

      const sessionData: PersistedTabSession = {
        tabs: tabsToSave,
        panelBreaks,
        activePanelIndex,
      };

      await api.saveClaudioAppSetting(STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      logger.error('Failed to save tab session:', error);
    }
  }, []);

  /**
   * Load raw tab data - no complex rehydration needed!
   */
  const loadTabs = useCallback(async (): Promise<PersistedTabSession> => {
    try {
      logger.info('📂 Loading tab session from API...');
      const serialized = await api.loadClaudioAppSetting(STORAGE_KEY);

      if (!serialized) {
        logger.info('📂 No saved tabs found');
        return DEFAULT_EMPTY_SESSION;
      }

      const parsed = JSON.parse(serialized) as PersistedTabSession;
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tabs)) {
        logger.warn('Invalid tab session data, starting fresh');
        return DEFAULT_EMPTY_SESSION;
      }

      const sessionData: PersistedTabSession = {
        tabs: parsed.tabs,
        panelBreaks: parsed.panelBreaks || DEFAULT_EMPTY_SESSION.panelBreaks,
        activePanelIndex: parsed.activePanelIndex ?? DEFAULT_EMPTY_SESSION.activePanelIndex,
      };


      return sessionData;
    } catch (error) {
      logger.error('Failed to load tab session:', error);
      return DEFAULT_EMPTY_SESSION;
    }
  }, []);

  /**
   * Clear saved tab session (explicit user action)
   */
  const clearSavedTabs = useCallback(async () => {
    try {
      await api.saveClaudioAppSetting(STORAGE_KEY, JSON.stringify(DEFAULT_EMPTY_SESSION));
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