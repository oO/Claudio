import { Tab } from '@/contexts/TabContext';
import {
  createSimpleDehydrator,
  projectDehydrator,
  sessionDehydrator,
  agentDehydrator,
  claudeFileDehydrator,
  temporaryDehydrator,
} from './tabDehydrators';

/**
 * Interface for tab-specific dehydration/rehydration logic
 * Each tab type should implement this to handle its own persistence
 */
export interface TabDehydrator<T = any> {
  /**
   * Convert a live tab into data that can be persisted
   * @param tab The live tab to dehydrate
   * @returns Serializable data needed to restore this tab
   */
  dehydrate: (tab: Tab) => T;
  
  /**
   * Convert persisted data back into a live tab
   * @param data The persisted data
   * @param index The tab's position in the tab list
   * @returns A fully restored Tab object
   */
  rehydrate: (data: T, index: number) => Tab;
  
  /**
   * Check if this tab type can be persisted
   * @param tab The tab to check
   * @returns true if the tab should be saved
   */
  canPersist: (tab: Tab) => boolean;
}

/**
 * Minimal persisted tab data - just the basics needed by all tabs
 */
export interface BasePersistedTab {
  type: Tab['type'];
  title: string;
}

/**
 * Registry of dehydrators for different tab types
 */
export type TabDehydratorRegistry = {
  [K in Tab['type']]?: TabDehydrator;
};

/**
 * Hook for managing tab dehydration/rehydration across different tab types
 */
export const useTabDehydration = () => {
  // Registry of dehydrators for each tab type
  const dehydrators: TabDehydratorRegistry = {
    // Simple tabs that don't need special state
    'projects': createSimpleDehydrator('projects'),
    'agents': createSimpleDehydrator('agents'),
    'usage': createSimpleDehydrator('usage'),
    'mcp': createSimpleDehydrator('mcp'),
    'settings': createSimpleDehydrator('settings'),
    'claude-md': createSimpleDehydrator('claude-md'),
    'chat': createSimpleDehydrator('chat'),
    
    // Complex tabs with specific state
    'project': projectDehydrator,
    'project-session': sessionDehydrator,
    'agent': agentDehydrator,
    'claude-file': claudeFileDehydrator,
    
    // Temporary tabs that can't be persisted
    'create-agent': temporaryDehydrator,
    'import-agent': temporaryDehydrator,
  };

  /**
   * Dehydrate a single tab using its specific dehydrator
   */
  const dehydrateTab = (tab: Tab): BasePersistedTab | null => {
    const dehydrator = dehydrators[tab.type];
    
    if (!dehydrator || !dehydrator.canPersist(tab)) {
      return null; // This tab type can't be persisted
    }
    
    return dehydrator.dehydrate(tab);
  };

  /**
   * Rehydrate a single tab using its specific dehydrator
   */
  const rehydrateTab = (data: BasePersistedTab, index: number): Tab | null => {
    logger.info(`🔄 REHYDRATING SINGLE TAB:`, { index, type: data.type, title: data.title, data });
    
    const dehydrator = dehydrators[data.type];
    
    if (!dehydrator) {
      logger.warn(`❌ No dehydrator found for tab type: ${data.type}`);
      return null;
    }
    
    try {
      const rehydratedTab = dehydrator.rehydrate(data, index);
      logger.info(`✅ SINGLE TAB REHYDRATION SUCCESS:`, { index, type: data.type, rehydratedTab });
      return rehydratedTab;
    } catch (error) {
      logger.error(`❌ SINGLE TAB REHYDRATION FAILED:`, { index, type: data.type, error });
      return null;
    }
  };

  /**
   * Dehydrate an array of tabs, filtering out non-persistable ones
   */
  const dehydrateTabs = (tabs: Tab[]): BasePersistedTab[] => {
    return tabs
      .map(dehydrateTab)
      .filter((data): data is BasePersistedTab => data !== null);
  };

  /**
   * Rehydrate an array of persisted tab data
   */
  const rehydrateTabs = (persistedTabs: BasePersistedTab[]): Tab[] => {
    logger.info('🔄 REHYDRATING TABS:', { count: persistedTabs.length, tabs: persistedTabs });
    
    const rehydratedTabs = persistedTabs
      .map((data, index) => {
        const tab = rehydrateTab(data, index);
        logger.info(`🔄 REHYDRATED TAB ${index}:`, { success: !!tab, type: data.type, title: data.title });
        return tab;
      })
      .filter((tab): tab is Tab => tab !== null);
      
    logger.info('✅ REHYDRATION COMPLETE:', { originalCount: persistedTabs.length, successCount: rehydratedTabs.length });
    return rehydratedTabs;
  };

  return {
    dehydrateTab,
    rehydrateTab,
    dehydrateTabs,
    rehydrateTabs,
    dehydrators, // Exposed so we can register dehydrators
  };
};