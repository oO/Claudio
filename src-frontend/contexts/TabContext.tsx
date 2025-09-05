import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import type { NavigationStack } from './NavigationContext';

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
  addTab: (tab: Omit<Tab, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => string;
  removeTab: (id: string, force?: boolean) => boolean;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  getTabById: (id: string) => Tab | undefined;
  closeAllTabs: () => void;
  getTabsByType: (type: Tab['type']) => Tab[];
}

const TabContext = createContext<TabContextType | undefined>(undefined);

// const STORAGE_KEY = 'claudia_tabs'; // No longer needed - persistence disabled
const MAX_TABS = 20;

export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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

  // Tab persistence disabled - no longer saving to localStorage
  // useEffect(() => {
  //   if (tabs.length > 0) {
  //     const tabsToSave = tabs.map(tab => ({
  //       ...tab,
  //       createdAt: tab.createdAt.toISOString(),
  //       updatedAt: tab.updatedAt.toISOString()
  //     }));
  //     localStorage.setItem(STORAGE_KEY, JSON.stringify(tabsToSave));
  //   }
  // }, [tabs]);

  const generateTabId = () => {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addTab = useCallback((tabData: Omit<Tab, 'id' | 'order' | 'createdAt' | 'updatedAt'>): string => {
    if (tabs.length >= MAX_TABS) {
      throw new Error(`Maximum number of tabs (${MAX_TABS}) reached`);
    }

    const newTab: Tab = {
      ...tabData,
      id: generateTabId(),
      order: tabs.length,
      lastActivityAt: tabData.lastActivityAt ?? undefined, // Default to undefined if not provided
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
    
    return true;
  }, [activeTabId, tabs]);

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

  const value: TabContextType = {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    updateTab,
    setActiveTab,
    reorderTabs,
    getTabById,
    closeAllTabs,
    getTabsByType
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
