import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import type { NavigationStack } from './NavigationContext';
import { useTabPersistence, type PersistedTabSession } from '@/hooks/useTabPersistence';
import { useSettingsState } from '@/hooks/useSettingsState';
import { logger } from '@/lib/logger';

export interface Tab {
  id: string;
  type: 'chat' | 'agent' | 'agents' | 'projects' | 'project' | 'project-session' | 'usage' | 'mcp' | 'settings' | 'claude-md' | 'claude-file' | 'create-agent' | 'import-agent';
  title: string;
  displayId?: string; // For session tabs - shows session ID that never truncates
  sessionId?: string;  // for chat tabs
  sessionData?: any; // for chat tabs - stores full session object
  claudeSession?: any; // legacy field - stores claudio session metadata
  agentRunId?: string; // for agent tabs
  agentData?: any; // for agent-execution tabs
  claudeFileId?: string; // for claude-file tabs
  sourceContext?: string; // context about where the file was opened from (e.g., "memories", "agents")
  initialProjectPath?: string; // for chat tabs
  
  // Navigation stack for hierarchical navigation
  navigationStack?: NavigationStack;
  
  // Legacy navigation context - will be deprecated in favor of navigationStack
  previousState?: {
    type: 'projects';
    title: string;
    selectedProject?: any;
    sessions?: any[];
  };
  
  // Project state restoration - used for proper tab hierarchy navigation
  restoreProjectState?: {
    selectedProject: any;
    sessions?: any[];
    activeTab?: string;
  };
  
  status: 'active' | 'idle' | 'running' | 'complete' | 'error';
  hasUnsavedChanges: boolean;
  lastActivityAt?: number; // Timestamp of last activity for flash animation
  order: number;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string | null;
  panelBreaks: number[]; // Panel break points: [3, 6] means panel 0: tabs 0-2, panel 1: tabs 3-5, panel 2: tabs 6+
  activePanelIndex: number; // Which panel is currently active
  addTab: (tab: Omit<Tab, 'id' | 'order' | 'createdAt' | 'updatedAt'>, panelIndex?: number) => string;
  removeTab: (id: string, force?: boolean) => boolean;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  getTabById: (id: string) => Tab | undefined;
  closeAllTabs: () => void;
  getTabsByType: (type: Tab['type']) => Tab[];
  restoreTabs: (sessionData: PersistedTabSession) => Promise<void>;
  
  // Panel management  
  addPanel: () => void; // Add a new empty panel
  closePanel: (panelIndex: number, keepTabs?: boolean) => void;
  getTabsForPanel: (panelIndex: number) => Tab[];
  getActivePanelIndex: () => number;
  getPanelCount: () => number;
  getPanelCounts: () => number[]; // For backwards compatibility
  canAddPanel: () => boolean; // Check if window width allows another panel
}

const TabContext = createContext<TabContextType | undefined>(undefined);

// const STORAGE_KEY = 'claudia_tabs'; // No longer needed - persistence disabled
const MAX_TABS = 20;
const PANEL_MIN_WIDTH = 500; // Minimum width per panel in pixels

export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [panelBreaks, setPanelBreaks] = useState<number[]>([]); // Empty array = single panel with all tabs
  const [activePanelIndex, setActivePanelIndex] = useState<number>(0);
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const { saveTabs, loadTabs } = useTabPersistence();
  const { settings } = useSettingsState();

  // Track window width changes for panel calculations
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-restore tabs on app startup (independent of Welcome screen)
  useEffect(() => {
    const attemptInitialRestore = async () => {
      logger.info('🚀 RESTORATION USEEFFECT FIRED', { tabsLength: tabs.length });
      
      // Only attempt restoration if we haven't loaded tabs yet
      if (tabs.length > 0) {
        logger.info('🚫 SKIPPING RESTORATION - TABS ALREADY EXIST', { tabsLength: tabs.length });
        return;
      }

      try {
        logger.info('🔄 ATTEMPTING INITIAL TAB RESTORATION...');
        const sessionData = await loadTabs();
        
        if (sessionData.tabs.length > 0) {
          logger.info('🔄 RESTORING TABS (KISS approach):', sessionData);
          
          // Simple restoration - just recreate tabs from saved data
          const restoredTabs: Tab[] = sessionData.tabs.map((savedTab, index) => ({
            // Generate new runtime fields
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            order: index,
            status: 'idle' as const,
            hasUnsavedChanges: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            
            // Restore all the saved fields directly (complete creation payload)
            type: savedTab.type!,
            title: savedTab.title!,
            sessionId: savedTab.sessionId,
            displayId: savedTab.displayId,
            agentRunId: savedTab.agentRunId,
            claudeFileId: savedTab.claudeFileId,
            initialProjectPath: savedTab.initialProjectPath,
            restoreProjectState: savedTab.restoreProjectState,
            sessionData: savedTab.sessionData,       // ← RESTORE SESSION DATA
            agentData: savedTab.agentData,           // ← RESTORE AGENT DATA  
            previousState: savedTab.previousState,   // ← RESTORE PREVIOUS STATE
          }));
          
          if (restoredTabs.length > 0) {
            setTabs(restoredTabs);
            setPanelBreaks(sessionData.panelBreaks || []);
            setActivePanelIndex(sessionData.activePanelIndex || 0);
            setActiveTabId(restoredTabs[0].id);
            logger.info('✅ SIMPLE RESTORATION COMPLETE:', { 
              tabCount: restoredTabs.length,
              types: restoredTabs.map(t => t.type)
            });
          }
        } else {
          logger.info('📭 NO SAVED TABS TO RESTORE ON STARTUP');
        }
      } catch (error) {
        logger.error('❌ FAILED TO RESTORE TABS ON STARTUP:', error);
      }
    };

    attemptInitialRestore();
  }, []); // Run once on mount

  // Start with welcome message, then open default Projects tab after delay
  // Removed automatic project tab creation - users should manually open tabs
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     // Create default projects tab after delay
  //     const defaultTab: Tab = {
  //       id: generateTabId(),
  //       type: 'projects',
  //       title: 'Projects',
  //       status: 'idle',
  //       hasUnsavedChanges: false,
  //       order: 0,
  //       createdAt: new Date(),
  //       updatedAt: new Date()
  //     };
  //     setTabs([defaultTab]);
  //     setActiveTabId(defaultTab.id);
  //   }, 4000); // 4 second delay to comfortably read welcome message and credits

  //   return () => clearTimeout(timer);
  // }, []);

  // KISS: No immediate saves - only save on shutdown!

  // Save tabs and panel state on component unmount (app closing) and window unload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      logger.info('🛑 APP RECEIVED BEFOREUNLOAD EVENT - saving tabs...', {
        tabCount: tabs.length,
        reason: 'beforeunload'
      });
      // Always save, even if tabs.length is 0 (empty state is valid)
      saveTabs(tabs, panelBreaks, activePanelIndex);
    };

    logger.info('🎧 Setting up quit/shutdown listeners...');
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also listen for Tauri app close events (more reliable for Tauri apps)
    const setupTauriListeners = async () => {
      try {
        // Import Tauri event system
        const { listen } = await import('@tauri-apps/api/event');
        
        // Listen for Tauri app close event  
        const unlisten = await listen('tauri://close-requested', () => {
          logger.info('🛑 APP RECEIVED TAURI CLOSE EVENT - saving tabs...', {
            tabCount: tabs.length,
            reason: 'tauri-close'
          });
          saveTabs(tabs, panelBreaks, activePanelIndex);
        });
        
        logger.info('🎧 Tauri close listener set up successfully');
        return unlisten;
      } catch (error) {
        logger.warn('⚠️ Failed to set up Tauri listeners (might be in dev mode):', error);
        return () => {}; // noop
      }
    };
    
    let tauriUnlisten: (() => void) | null = null;
    setupTauriListeners().then(unlisten => {
      tauriUnlisten = unlisten;
    });
    
    return () => {
      logger.info('🛑 APP COMPONENT UNMOUNTING - saving tabs...', {
        tabCount: tabs.length,
        reason: 'component-unmount'
      });
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (tauriUnlisten) tauriUnlisten();
      // Always save on unmount, even if tabs.length is 0
      saveTabs(tabs, panelBreaks, activePanelIndex);
    };
  }, [tabs, panelBreaks, activePanelIndex, saveTabs]);

  const generateTabId = () => {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addTab = useCallback((tabData: Omit<Tab, 'id' | 'order' | 'createdAt' | 'updatedAt'>, panelIndex?: number): string => {
    if (tabs.length >= MAX_TABS) {
      throw new Error(`Maximum number of tabs (${MAX_TABS}) reached`);
    }

    const newTab: Tab = {
      ...tabData,
      id: generateTabId(),
      order: tabs.length,
      lastActivityAt: tabData.lastActivityAt ?? undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);

    return newTab.id;
  }, [tabs.length]);

  const removeTab = useCallback((id: string, force: boolean = false) => {
    // Check if tab has unsaved changes and we're not forcing removal
    const tab = tabs.find(t => t.id === id);
    if (tab?.hasUnsavedChanges && !force) {
      // Return false to indicate the tab wasn't removed
      return false;
    }
    
    // Clean up localStorage entries for this tab
    const filterKeys = [
      `claudio-session-filters-regular-${id}`,
      `claudio-session-filters-native-${id}`,
      `claudio-session-filters-claudio-${id}`,
    ];
    
    filterKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    setTabs(prevTabs => {
      const filteredTabs = prevTabs.filter(tab => tab.id !== id);
      
      // Reorder remaining tabs
      const reorderedTabs = filteredTabs.map((tab, index) => ({
        ...tab,
        order: index
      }));

      // Update active tab if necessary
      if (activeTabId === id && reorderedTabs.length > 0) {
        const removedTabIndex = prevTabs.findIndex(tab => tab.id === id);
        const newActiveIndex = Math.min(removedTabIndex, reorderedTabs.length - 1);
        setActiveTabId(reorderedTabs[newActiveIndex].id);
      } else if (reorderedTabs.length === 0) {
        setActiveTabId(null);
      }

      return reorderedTabs;
    });
    
    // Auto-cleanup: If removing a tab leaves a panel empty, remove that panel
    const newTabCount = tabs.length - 1; // tabs.length after removal
    if (newTabCount > 0) {
      setPanelBreaks(prevBreaks => {
        // Filter out any breaks that would create empty panels
        const validBreaks = prevBreaks.filter(breakPoint => breakPoint < newTabCount);
        
        // If breaks changed, adjust active panel and log the cleanup
        if (validBreaks.length !== prevBreaks.length) {
          const newPanelCount = validBreaks.length + 1;
          setActivePanelIndex(prev => Math.min(prev, newPanelCount - 1));
          
          logger.debug('🧹 Auto-cleaned empty panels:', {
            oldBreaks: prevBreaks,
            newBreaks: validBreaks,
            removedEmptyPanels: prevBreaks.length - validBreaks.length,
            adjustedActivePanelIndex: Math.min(activePanelIndex, newPanelCount - 1)
          });
        }
        
        return validBreaks;
      });
    } else {
      // No tabs left, reset to single empty panel
      setPanelBreaks([]);
      setActivePanelIndex(0);
    }
    
    return true;
  }, [activeTabId, tabs, activePanelIndex]);

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === id 
          ? { ...tab, ...updates, updatedAt: new Date() }
          : tab
      )
    );
  }, []);

  const setActiveTab = useCallback((id: string) => {
    if (tabs.find(tab => tab.id === id)) {
      setActiveTabId(id);
    }
  }, [tabs]);

  const reorderTabs = useCallback((startIndex: number, endIndex: number) => {
    setTabs(prevTabs => {
      const newTabs = [...prevTabs];
      const [removed] = newTabs.splice(startIndex, 1);
      newTabs.splice(endIndex, 0, removed);
      
      // Update order property
      return newTabs.map((tab, index) => ({
        ...tab,
        order: index
      }));
    });
  }, []);

  const getTabById = useCallback((id: string): Tab | undefined => {
    return tabs.find(tab => tab.id === id);
  }, [tabs]);

  const closeAllTabs = useCallback(() => {
    // Clean up all tab-scoped localStorage entries
    tabs.forEach(tab => {
      const filterKeys = [
        `claudio-session-filters-regular-${tab.id}`,
        `claudio-session-filters-native-${tab.id}`,
        `claudio-session-filters-claudio-${tab.id}`,
      ];
      
      filterKeys.forEach(key => {
        localStorage.removeItem(key);
      });
    });
    
    setTabs([]);
    setActiveTabId(null);
    // localStorage.removeItem(STORAGE_KEY); // Persistence disabled
  }, [tabs]);

  const getTabsByType = useCallback((type: Tab['type']): Tab[] => {
    return tabs.filter(tab => tab.type === type);
  }, [tabs]);

  // Helper function to get panel count
  const getPanelCount = useCallback((): number => {
    return panelBreaks.length + 1; // breaks array + 1 = number of panels
  }, [panelBreaks]);

  // Helper function to compute panel counts (for backwards compatibility)
  const getPanelCounts = useCallback((): number[] => {
    if (panelBreaks.length === 0) {
      // Single panel with all tabs
      return [tabs.length];
    }
    
    const counts: number[] = [];
    let previousBreak = 0;
    
    for (const breakPoint of panelBreaks) {
      counts.push(breakPoint - previousBreak);
      previousBreak = breakPoint;
    }
    
    // Last panel gets remaining tabs
    counts.push(tabs.length - previousBreak);
    
    return counts;
  }, [panelBreaks, tabs.length]);

  // Panel management methods  
  const addPanel = useCallback(() => {
    if (tabs.length < 2) {
      logger.warn('➕ Cannot split with less than 2 tabs');
      return;
    }
    
    // Split before the last tab (move last tab to new panel)
    const newPanelBreaks = [...panelBreaks, tabs.length - 1];
    setPanelBreaks(newPanelBreaks);
    setActivePanelIndex(newPanelBreaks.length); // Focus the new panel (last index)
    
    logger.debug('➕ Split panel - moved last tab to new panel:', {
      newPanelBreaks,
      activePanelIndex: newPanelBreaks.length,
      lastTabMovedToNewPanel: true
    });
  }, [panelBreaks, tabs.length]);

  const closePanel = useCallback((panelIndex: number, keepTabs: boolean = true) => {
    const panelCount = getPanelCount();
    if (panelCount <= 1) {
      logger.warn('🗑️ Cannot close the last panel');
      return;
    }
    
    if (panelIndex < 0 || panelIndex >= panelCount) {
      logger.warn('🗑️ Invalid panel index:', panelIndex);
      return;
    }
    
    const newPanelBreaks = [...panelBreaks];
    
    if (panelIndex === 0) {
      // Closing first panel: remove the first break
      newPanelBreaks.shift();
    } else if (panelIndex === panelCount - 1) {
      // Closing last panel: remove the last break
      newPanelBreaks.pop();
    } else {
      // Closing middle panel: merge with previous panel
      newPanelBreaks.splice(panelIndex - 1, 1);
    }
    
    // Adjust active panel index if needed
    let newActivePanelIndex = activePanelIndex;
    if (activePanelIndex >= panelIndex) {
      newActivePanelIndex = Math.max(0, activePanelIndex - 1);
    }
    
    setPanelBreaks(newPanelBreaks);
    setActivePanelIndex(newActivePanelIndex);
    
    logger.debug('🗑️ Closed panel:', { 
      panelIndex, 
      keepTabs, 
      newPanelBreaks,
      newActivePanelIndex
    });
  }, [panelBreaks, activePanelIndex, getPanelCount]);

  const getTabsForPanel = useCallback((panelIndex: number): Tab[] => {
    const panelCount = getPanelCount();
    if (panelIndex < 0 || panelIndex >= panelCount) {
      return [];
    }
    
    if (panelBreaks.length === 0) {
      // Single panel with all tabs
      return panelIndex === 0 ? tabs : [];
    }
    
    // Calculate start and end indices based on panel breaks
    let startIndex = 0;
    if (panelIndex > 0) {
      startIndex = panelBreaks[panelIndex - 1] || 0;
    }
    
    const endIndex = panelBreaks[panelIndex] || tabs.length;
    
    return tabs.slice(startIndex, endIndex);
  }, [tabs, panelBreaks, getPanelCount]);

  const getActivePanelIndex = useCallback((): number => {
    return activePanelIndex;
  }, [activePanelIndex]);

  const canAddPanel = useCallback((): boolean => {
    // Need at least 2 tabs to split
    if (tabs.length < 2) return false;
    
    const currentPanelCount = getPanelCount();
    const panelMinWidth = settings?.panelMinWidth || PANEL_MIN_WIDTH;
    const requiredWidth = (currentPanelCount + 1) * panelMinWidth;
    return windowWidth >= requiredWidth;
  }, [tabs.length, getPanelCount, settings?.panelMinWidth, windowWidth]);

  const restoreTabs = useCallback(async (sessionData: PersistedTabSession): Promise<void> => {
    if (sessionData.tabs.length === 0) return;

    // Simple restoration - same as startup restoration
    const restoredTabs: Tab[] = sessionData.tabs.slice(0, MAX_TABS).map((savedTab, index) => ({
      // Generate new runtime fields
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: index,
      status: 'idle' as const,
      hasUnsavedChanges: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Restore all the saved fields directly (complete creation payload)
      type: savedTab.type!,
      title: savedTab.title!,
      sessionId: savedTab.sessionId,
      displayId: savedTab.displayId,
      agentRunId: savedTab.agentRunId,
      claudeFileId: savedTab.claudeFileId,
      initialProjectPath: savedTab.initialProjectPath,
      restoreProjectState: savedTab.restoreProjectState,
      sessionData: savedTab.sessionData,       // ← RESTORE SESSION DATA
      agentData: savedTab.agentData,           // ← RESTORE AGENT DATA  
      previousState: savedTab.previousState,   // ← RESTORE PREVIOUS STATE
    }));

    // Restore tabs and panel state
    setTabs(restoredTabs);
    setPanelBreaks(sessionData.panelBreaks || []);
    setActivePanelIndex(sessionData.activePanelIndex || 0);
    
    // Set the first restored tab as active
    if (restoredTabs.length > 0) {
      setActiveTabId(restoredTabs[0].id);
    }

    logger.info('✨ Simple tab restoration complete:', { 
      tabCount: restoredTabs.length,
      types: restoredTabs.map(t => t.type)
    });
  }, []);

  const value: TabContextType = {
    tabs,
    activeTabId,
    panelBreaks,
    activePanelIndex,
    addTab,
    removeTab,
    updateTab,
    setActiveTab,
    reorderTabs,
    getTabById,
    closeAllTabs,
    getTabsByType,
    restoreTabs,
    addPanel,
    closePanel,
    getTabsForPanel,
    getActivePanelIndex,
    getPanelCount,
    getPanelCounts,
    canAddPanel
  };

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within a TabProvider');
  }
  return context;
};
