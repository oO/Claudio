import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import type { NavigationStack } from './NavigationContext';
import { useTabPersistence, type PersistedTabSession } from '@/hooks/useTabPersistence';
import { useSettingsState } from '@/hooks/useSettingsState';
import { logger } from '@/lib/logger';

export interface Tab {
  id: string;
  type: 'chat' | 'agents' | 'projects' | 'project' | 'project-session' | 'usage' | 'mcp' | 'settings' | 'claude-md' | 'claude-file' | 'create-agent' | 'import-agent';
  title: string;
  displayId?: string; // For session tabs - shows session ID that never truncates
  sessionId?: string;  // for chat tabs
  sessionData?: any; // for chat tabs - stores full session object
  claudeSession?: any; // legacy field - stores claudio session metadata
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
    viewingSession?: {
      session: any;
      projectPath: string;
      backState: {
        selectedProject: any;
        activeTab: string;
      };
    };
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
  activeTabs: Record<number, string>; // Active tab per panel: { 0: "tab-1", 1: "tab-5" }
  panelMinWidth: number; // Minimum width per panel for splitting logic
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
  setPanelMinWidth: (width: number) => void; // Update minimum panel width
  
  // Multi-view panel support
  setActiveTabForPanel: (panelIndex: number, tabId: string) => void;
  getActiveTabForPanel: (panelIndex: number) => string | null;
  getPanelIndexForTab: (tabId: string) => number;
  ensureActiveTabs: () => Record<number, string>;
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
  const activePanelIndexRef = useRef<number>(0); // Ref to avoid stale closure in useEffect
  const tabsRef = useRef<Tab[]>([]); // Always have current tabs for event listeners
  const panelBreaksRef = useRef<number[]>([]); // Always have current panelBreaks for event listeners
  const panelMinWidthRef = useRef<number>(PANEL_MIN_WIDTH); // Always have current panelMinWidth for event listeners
  const [activeTabs, setActiveTabs] = useState<Record<number, string>>({}); // Active tab per panel
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const [isInitialRestoration, setIsInitialRestoration] = useState(true); // Prevent saves during startup restoration
  const [restorationAttempted, setRestorationAttempted] = useState(false); // Track if we've attempted restoration (React Strict Mode safety)
  const { saveTabs, loadTabs, clearSavedTabs } = useTabPersistence();
  const { settings } = useSettingsState();
  const [panelMinWidth, setPanelMinWidth] = useState<number>(PANEL_MIN_WIDTH);

  // Debouncing for save operations to prevent rapid-fire saves during restoration/shutdown
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSave = useCallback((tabs: Tab[], panelBreaks: number[], activePanelIndex: number, panelMinWidth: number) => {
    // Double-check: Don't save during initial restoration
    if (isInitialRestoration) {
      logger.debug('Skipping save during initial restoration');
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule save with debounce
    saveTimeoutRef.current = setTimeout(() => {
      logger.debug('Saving tabs state:', { tabCount: tabs.length, panelBreaks, activePanelIndex, panelMinWidth });
      saveTabs(tabs, panelBreaks, activePanelIndex, panelMinWidth);
      saveTimeoutRef.current = null;
    }, 500); // 500ms debounce for in-memory store (much lighter now)
  }, [saveTabs, isInitialRestoration]);

  // Keep refs in sync with state for event listeners
  useEffect(() => {
    activePanelIndexRef.current = activePanelIndex;
    tabsRef.current = tabs;
    panelBreaksRef.current = panelBreaks;
    panelMinWidthRef.current = panelMinWidth;
  }, [activePanelIndex, tabs, panelBreaks, panelMinWidth]);

  // Track window width changes for panel calculations
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper to ensure each panel has exactly one active tab
  const ensureActiveTabs = useCallback(() => {
    // Calculate panel count directly from panelBreaks
    const panelCount = panelBreaks.length + 1;
    const newActiveTabs: Record<number, string> = {};
    
    for (let panelIndex = 0; panelIndex < panelCount; panelIndex++) {
      // Calculate panel tabs directly without calling getTabsForPanel
      let panelTabs: Tab[];
      if (panelCount === 1) {
        panelTabs = tabs;
      } else {
        const startIndex = panelIndex === 0 ? 0 : panelBreaks[panelIndex - 1];
        const endIndex = panelIndex < panelBreaks.length ? panelBreaks[panelIndex] : tabs.length;
        panelTabs = tabs.slice(startIndex, endIndex);
      }
      
      if (panelTabs.length === 0) continue;
      
      // Check if this panel already has an active tab
      const currentActive = activeTabs[panelIndex];
      const hasValidActiveTab = currentActive && panelTabs.some(tab => tab.id === currentActive);
      
      if (hasValidActiveTab) {
        // Keep existing active tab
        newActiveTabs[panelIndex] = currentActive;
      } else {
        // Set first tab in panel as active
        newActiveTabs[panelIndex] = panelTabs[0].id;
      }
    }
    
    // Only update state if something actually changed
    const hasChanges = Object.keys(newActiveTabs).some(
      panelIndex => newActiveTabs[Number(panelIndex)] !== activeTabs[Number(panelIndex)]
    );
    
    if (hasChanges) {
      setActiveTabs(newActiveTabs);
    }
    
    // Update global activeTabId to match the active panel's active tab
    const activePanelTab = newActiveTabs[activePanelIndex];
    if (activePanelTab && activePanelTab !== activeTabId) {
      setActiveTabId(activePanelTab);
    }
    
    return newActiveTabs;
  }, [tabs, panelBreaks, activeTabs, activePanelIndex, activeTabId]);

  // Ensure each panel has an active tab whenever panels or tabs change
  useEffect(() => {
    // Skip if no tabs
    if (tabs.length === 0) return;
    
    // Inline logic to avoid circular dependency
    const panelCount = panelBreaks.length + 1;
    const newActiveTabs: Record<number, string> = {};
    let hasChanges = false;
    
    for (let panelIndex = 0; panelIndex < panelCount; panelIndex++) {
      // Calculate panel tabs directly
      let panelTabs: Tab[];
      if (panelCount === 1) {
        panelTabs = tabs;
      } else {
        const startIndex = panelIndex === 0 ? 0 : panelBreaks[panelIndex - 1];
        const endIndex = panelIndex < panelBreaks.length ? panelBreaks[panelIndex] : tabs.length;
        panelTabs = tabs.slice(startIndex, endIndex);
      }
      
      if (panelTabs.length === 0) continue;
      
      // Check if this panel already has an active tab
      const currentActive = activeTabs[panelIndex];
      const hasValidActiveTab = currentActive && panelTabs.some(tab => tab.id === currentActive);
      
      if (hasValidActiveTab) {
        // Keep existing active tab
        newActiveTabs[panelIndex] = currentActive;
      } else {
        // Set first tab in panel as active
        newActiveTabs[panelIndex] = panelTabs[0].id;
        hasChanges = true;
      }
      
      // Check if this panel's active tab changed
      if (newActiveTabs[panelIndex] !== activeTabs[panelIndex]) {
        hasChanges = true;
      }
    }
    
    // Ensure single panel mode always has panel 0 as active
    if (panelCount === 1 && activePanelIndexRef.current !== 0) {
      setActivePanelIndex(0);
      hasChanges = true;
    }
    
    // Only update state if something actually changed
    if (hasChanges) {
      setActiveTabs(newActiveTabs);
      
      // Update global activeTabId to match the active panel's active tab
      const targetPanelIndex = panelCount === 1 ? 0 : activePanelIndexRef.current;
      const activePanelTab = newActiveTabs[targetPanelIndex];
      if (activePanelTab && activePanelTab !== activeTabId) {
        setActiveTabId(activePanelTab);
      }
    }
  }, [tabs, panelBreaks]); // REMOVED activeTabs, activePanelIndex, activeTabId to break circular dependency

  // Auto-restore tabs on app startup (independent of Welcome screen)
  useEffect(() => {
    const attemptInitialRestore = async () => {
      
      // Only attempt restoration once - React Strict Mode safe
      if (restorationAttempted) {
        // Tab restoration already attempted
        return;
      }

      // Mark that we've attempted restoration
      setRestorationAttempted(true);

      try {
        const sessionData = await loadTabs();


        if (sessionData.tabs.length > 0) {
          
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
            setPanelMinWidth(sessionData.panelMinWidth || PANEL_MIN_WIDTH);
            setActiveTabId(restoredTabs[0].id);

            logger.info(`Tab restoration completed: ${restoredTabs.length} tabs restored`);
          }
        } else {
          // No saved tabs, but still set default panelMinWidth
          setPanelMinWidth(sessionData.panelMinWidth || PANEL_MIN_WIDTH);
          logger.info('Tab restoration completed: no saved tabs found');
        }
      } catch (error) {
        logger.error('Failed to restore tabs on startup:', error);
      } finally {
        // Mark initial restoration as complete, allowing saves to begin
        setIsInitialRestoration(false);
      }
    };

    attemptInitialRestore();
  }, []); // Run once on mount ONLY

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

  // Debounced save effect: Save tabs when they change, but debounce to prevent rapid-fire saves
  useEffect(() => {
    // Only save after initial restoration is complete
    if (!isInitialRestoration) {
      debouncedSave(tabs, panelBreaks, activePanelIndex, panelMinWidth);
    }
  }, [tabs, panelBreaks, activePanelIndex, panelMinWidth, debouncedSave, isInitialRestoration]);

  // Immediate save on shutdown events - using refs to avoid multiple cleanup functions
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Clear any pending debounced save and save immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveTabs(tabsRef.current, panelBreaksRef.current, activePanelIndexRef.current, panelMinWidthRef.current);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also listen for Tauri app close events (more reliable for Tauri apps)
    const setupTauriListeners = async () => {
      try {
        // Import Tauri event system
        const { listen } = await import('@tauri-apps/api/event');

        // Listen for Tauri app close event
        const unlisten = await listen('tauri://close-requested', () => {
          // Clear any pending debounced save and save immediately
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          saveTabs(tabsRef.current, panelBreaksRef.current, activePanelIndexRef.current, panelMinWidthRef.current);
        });

        return unlisten;
      } catch (error) {
        logger.warn('Failed to set up Tauri listeners (might be in dev mode):', error);
        return () => {}; // noop
      }
    };

    let tauriUnlisten: (() => void) | null = null;
    setupTauriListeners().then(unlisten => {
      tauriUnlisten = unlisten;
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (tauriUnlisten) tauriUnlisten();

      // Clear any pending debounced save and save immediately on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveTabs(tabsRef.current, panelBreaksRef.current, activePanelIndexRef.current, panelMinWidthRef.current);
    };
  }, [saveTabs]); // Only depend on saveTabs - refs are always current!

  const generateTabId = () => {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Helper method to find which panel a tab belongs to
  const getPanelIndexForTab = useCallback((tabId: string): number => {
    // Find which panel this tab belongs to based on panelBreaks
    if (panelBreaks.length === 0) return 0; // Single panel
    
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return 0;
    
    // Find which panel this tab index falls into
    for (let i = 0; i < panelBreaks.length; i++) {
      if (tabIndex < panelBreaks[i]) {
        return i;
      }
    }
    
    // Last panel
    return panelBreaks.length;
  }, [tabs, panelBreaks]);

  const addTab = useCallback((tabData: Omit<Tab, 'id' | 'order' | 'createdAt' | 'updatedAt'>, panelIndex?: number): string => {
    if (tabs.length >= MAX_TABS) {
      throw new Error(`Maximum number of tabs (${MAX_TABS}) reached`);
    }

    // Default to active panel if not specified
    const targetPanelIndex = panelIndex ?? activePanelIndex;
    const panelCount = panelBreaks.length + 1;
    
    // Calculate insertion index for the target panel
    let insertionIndex: number;
    if (panelCount === 1 || targetPanelIndex === panelCount - 1) {
      // Single panel or last panel: append to end
      insertionIndex = tabs.length;
    } else {
      // Insert at the end of the target panel (before next panel break)
      insertionIndex = panelBreaks[targetPanelIndex];
    }

    const newTab: Tab = {
      ...tabData,
      id: generateTabId(),
      order: insertionIndex,
      lastActivityAt: tabData.lastActivityAt ?? undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert tab at the correct position and update orders
    setTabs(prevTabs => {
      const newTabs = [...prevTabs];
      newTabs.splice(insertionIndex, 0, newTab);
      
      // Update orders for all tabs after insertion point
      for (let i = insertionIndex + 1; i < newTabs.length; i++) {
        newTabs[i] = { ...newTabs[i], order: i };
      }
      
      return newTabs;
    });

    // Update panel breaks if we inserted in a non-last panel
    if (targetPanelIndex < panelCount - 1) {
      setPanelBreaks(prevBreaks => 
        prevBreaks.map((breakPoint, index) => 
          index >= targetPanelIndex ? breakPoint + 1 : breakPoint
        )
      );
    }

    setActiveTabId(newTab.id);
    setActiveTabs(prev => ({ ...prev, [targetPanelIndex]: newTab.id }));
    setActivePanelIndex(targetPanelIndex);

    return newTab.id;
  }, [tabs.length, activePanelIndex, panelBreaks]);

  const removeTab = useCallback((id: string, force: boolean = false) => {
    // Check if tab has unsaved changes and we're not forcing removal
    const tab = tabs.find(t => t.id === id);
    if (tab?.hasUnsavedChanges && !force) {
      // Return false to indicate the tab wasn't removed
      return false;
    }
    
    // Session filters are now just component state, no cleanup needed
    
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
    
    // No auto-cleanup - panels remain even if empty
    
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
      
      // Also update per-panel active tab tracking
      const panelIndex = getPanelIndexForTab(id);
      setActiveTabs(prev => ({ ...prev, [panelIndex]: id }));
      setActivePanelIndex(panelIndex);
    }
  }, [tabs, getPanelIndexForTab]);

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
    // Session filters are now just component state, no cleanup needed
    
    setTabs([]);
    setActiveTabId(null);
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
    // Create empty panel - no tab count restriction
    const splitPoint = tabs.length; // Split after all existing tabs (empty panel)
    const newPanelBreaks = [...panelBreaks, splitPoint];
    setPanelBreaks(newPanelBreaks);
    setActivePanelIndex(newPanelBreaks.length); // Focus the new panel (last index)
    
    
  }, [panelBreaks, tabs.length, ensureActiveTabs]);

  const closePanel = useCallback((panelIndex: number, keepTabs: boolean = true) => {
    const panelCount = getPanelCount();
    if (panelCount <= 1) {
      logger.warn('Cannot close the last panel');
      return;
    }
    
    if (panelIndex < 0 || panelIndex >= panelCount) {
      logger.warn('Invalid panel index:', panelIndex);
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
    // Only restricted by window width, not tab count
    const currentPanelCount = getPanelCount();
    const requiredWidth = (currentPanelCount + 1) * panelMinWidth;
    return windowWidth >= requiredWidth;
  }, [getPanelCount, panelMinWidth, windowWidth]);

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
    setPanelMinWidth(sessionData.panelMinWidth || PANEL_MIN_WIDTH);
    
    // Set the first restored tab as active
    if (restoredTabs.length > 0) {
      setActiveTabId(restoredTabs[0].id);
    }


  }, [ensureActiveTabs]);

  // Multi-view panel support methods
  const setActiveTabForPanel = useCallback((panelIndex: number, tabId: string) => {
    setActiveTabs(prev => ({ ...prev, [panelIndex]: tabId }));
    setActivePanelIndex(panelIndex);
    // Also update global activeTabId for backward compatibility
    setActiveTabId(tabId);
  }, []);

  const getActiveTabForPanel = useCallback((panelIndex: number): string | null => {
    return activeTabs[panelIndex] || null;
  }, [activeTabs]);

  const updatePanelMinWidth = useCallback((width: number) => {
    const clampedWidth = Math.max(300, Math.min(800, width));
    setPanelMinWidth(clampedWidth);
  }, []);

  const value: TabContextType = {
    tabs,
    activeTabId,
    panelBreaks,
    activePanelIndex,
    activeTabs,
    panelMinWidth,
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
    canAddPanel,
    setPanelMinWidth: updatePanelMinWidth,
    setActiveTabForPanel,
    getActiveTabForPanel,
    getPanelIndexForTab,
    ensureActiveTabs
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
