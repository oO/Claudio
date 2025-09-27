import { useCallback, useMemo, useState, useEffect } from 'react';
import { useTabContext } from '@/contexts/TabContext';
import { Tab } from '@/contexts/TabContext';
import { formatSessionIdCompact } from '@/lib/sessionUtils';
import { logger } from '@/lib/logger';

interface UseTabStateReturn {
  // State
  tabs: Tab[];
  activeTab: Tab | undefined;
  activeTabId: string | null;
  tabCount: number;
  sessionTabCount: number;
  
  // Operations
  createSessionTab: (initialProjectPath?: string, title?: string, sessionId?: string) => string;
  createProjectTab: (project: any, projectName: string, options?: {
    viewLevel?: 'project' | 'session';
    session?: any;
    activeTab?: string;
  }) => string;
  createProjectsTab: () => string | null;
  createUsageTab: () => string | null;
  createMCPTab: () => string | null;
  createSettingsTab: () => string | null;
  createClaudeMdTab: () => string | null;
  createAgentsTab: () => string | null;
  createClaudeFileTab: (filePath: string, fileName: string) => string;
  createCreateAgentTab: () => string;
  createImportAgentTab: () => string;
  closeTab: (id: string, force?: boolean) => Promise<boolean>;
  closeCurrentTab: () => Promise<boolean>;
  switchToTab: (id: string) => void;
  switchToNextTab: () => void;
  switchToPreviousTab: () => void;
  switchToTabByIndex: (index: number) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabStatus: (id: string, status: Tab['status']) => void;
  markTabAsChanged: (id: string, hasChanges: boolean) => void;
  findTabBySessionId: (sessionId: string) => Tab | undefined;
  findTabByType: (type: Tab['type']) => Tab | undefined;
  getTabById: (id: string) => Tab | undefined;
  canAddTab: () => boolean;
}

export const useTabState = (): UseTabStateReturn => {
  const {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    updateTab,
    setActiveTab,
    getTabById,
    getTabsByType
  } = useTabContext();

  const activeTab = useMemo(() =>
    activeTabId ? getTabById(activeTabId) : undefined,
    [activeTabId, getTabById]
  );

  const tabCount = tabs.length;
  const sessionTabCount = useMemo(() => getTabsByType('project-session').length, [getTabsByType]);

  const createSessionTab = useCallback((initialProjectPath?: string, title?: string, sessionId?: string): string => {
    logger.log('🔥 createSessionTab called with:', { initialProjectPath, title, sessionId });

    // Check if tab already exists for this session
    if (sessionId) {
      const currentTabs = getTabsByType('project-session');
      const existingTab = currentTabs.find(tab => tab.sessionId === sessionId);
      logger.log('🔍 Checking for existing tab with sessionId:', sessionId, 'found:', existingTab?.id);

      if (existingTab) {
        logger.log('✅ Found existing tab, switching to:', existingTab.id);
        setActiveTab(existingTab.id);
        return existingTab.id;
      }
    }

    // Build session tab title: <project name> <compact session_id>
    let tabTitle = title;
    if (!tabTitle && sessionId && initialProjectPath) {
      const projectName = initialProjectPath.split('/').pop() || 'Project';
      const sessionShort = formatSessionIdCompact(sessionId);
      tabTitle = `${projectName} ${sessionShort}`;
    } else if (!tabTitle) {
      tabTitle = `Session ${sessionTabCount + 1}`;
    }

    logger.log('📝 Creating new tab with title:', tabTitle, 'sessionId:', sessionId);

    const newTabId = addTab({
      type: 'project-session',
      title: tabTitle,
      sessionId: sessionId, // Use provided sessionId, or undefined for legacy behavior
      initialProjectPath, // Set the project path for new sessions
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'messages-square',
    });

    logger.log('✨ Created new tab with ID:', newTabId);
    return newTabId;
  }, [addTab, sessionTabCount, getTabsByType, setActiveTab]);


  const createProjectsTab = useCallback((): string | null => {
    // Always create a new projects tab (no singleton behavior)
    return addTab({
      type: 'projects',
      title: 'Projects',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'folder-open',
    });
  }, [addTab]);

  const createUsageTab = useCallback((): string | null => {
    // Check if usage tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'usage');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'usage',
      title: 'Dashboard',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'bar-chart',
    });
  }, [addTab, tabs, setActiveTab]);

  const createMCPTab = useCallback((): string | null => {
    // Check if MCP tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'mcp');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'mcp',
      title: 'MCP Servers',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'server',
    });
  }, [addTab, tabs, setActiveTab]);

  const createSettingsTab = useCallback((): string | null => {
    // Check if settings tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'settings');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'settings',
      title: 'Settings',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'settings',
    });
  }, [addTab, tabs, setActiveTab]);

  const createClaudeMdTab = useCallback((): string | null => {
    // Check if claude-md tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'claude-md');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'claude-md',
      title: 'CLAUDE.md',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'file-text',
    });
  }, [addTab, tabs, setActiveTab]);

  const createAgentsTab = useCallback((): string | null => {
    // Check if agents tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'agents');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'agents',
      title: 'Personal Agents',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'robot',
    });
  }, [addTab, tabs, setActiveTab]);

  const createClaudeFileTab = useCallback((filePath: string, fileName: string): string => {
    // Check if tab already exists for this file
    const existingTab = tabs.find(tab => tab.type === 'claude-file' && tab.claudeFileId === filePath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'claude-file',
      title: fileName,
      claudeFileId: filePath,
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'file-text',
    });
  }, [addTab, tabs, setActiveTab]);

  const createCreateAgentTab = useCallback((): string => {
    // Check if create agent tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'create-agent');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'create-agent',
      title: 'Create Agent',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'plus',
    });
  }, [addTab, tabs, setActiveTab]);

  const createImportAgentTab = useCallback((): string => {
    // Check if import agent tab already exists (singleton)
    const existingTab = tabs.find(tab => tab.type === 'import-agent');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    return addTab({
      type: 'import-agent',
      title: 'Import Agent',
      status: 'idle',
      hasUnsavedChanges: false,
      icon: 'import',
    });
  }, [addTab, tabs, setActiveTab]);

  const closeTab = useCallback(async (id: string, force: boolean = false): Promise<boolean> => {
    const tab = getTabById(id);
    if (!tab) return true;

    // removeTab now handles the unsaved changes check
    return removeTab(id, force);
  }, [getTabById, removeTab]);

  const closeCurrentTab = useCallback(async (): Promise<boolean> => {
    if (!activeTabId) return true;
    return closeTab(activeTabId);
  }, [activeTabId, closeTab]);

  const switchToNextTab = useCallback(() => {
    if (tabs.length === 0) return;
    
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
  }, [tabs, activeTabId, setActiveTab]);

  const switchToPreviousTab = useCallback(() => {
    if (tabs.length === 0) return;
    
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    setActiveTab(tabs[previousIndex].id);
  }, [tabs, activeTabId, setActiveTab]);

  const switchToTabByIndex = useCallback((index: number) => {
    if (index >= 0 && index < tabs.length) {
      setActiveTab(tabs[index].id);
    }
  }, [tabs, setActiveTab]);

  const updateTabTitle = useCallback((id: string, title: string) => {
    updateTab(id, { title });
  }, [updateTab]);

  const updateTabStatus = useCallback((id: string, status: Tab['status']) => {
    updateTab(id, { status });
  }, [updateTab]);

  const markTabAsChanged = useCallback((id: string, hasChanges: boolean) => {
    updateTab(id, { hasUnsavedChanges: hasChanges });
  }, [updateTab]);

  const findTabBySessionId = useCallback((sessionId: string): Tab | undefined => {
    return tabs.find(tab => (tab.type === 'project-session' || tab.type === 'chat') && tab.sessionId === sessionId);
  }, [tabs]);


  const findTabByType = useCallback((type: Tab['type']): Tab | undefined => {
    return tabs.find(tab => tab.type === type);
  }, [tabs]);

  const canAddTab = useCallback((): boolean => {
    return tabs.length < 20; // MAX_TABS from context
  }, [tabs.length]);

  const createProjectTab = useCallback((
    project: any,
    projectName: string,
    options?: {
      viewLevel?: 'project' | 'session';
      session?: any;
      activeTab?: string;
    }
  ): string => {
    const { viewLevel = 'project', session, activeTab = 'sessions' } = options || {};

    // Create tab at session level if session is provided
    if (viewLevel === 'session' && session) {
      const sessionShort = session.id ? session.id.replace('claudio-', '').substr(-6) : undefined;
      return addTab({
        type: 'project-session',
        title: `${projectName} ${sessionShort}`,
        displayId: sessionShort,
        sessionId: session.id,
        sessionData: session,
        status: 'idle',
        hasUnsavedChanges: false,
        initialProjectPath: project.path,
        icon: 'messages-square',
        restoreProjectState: {
          selectedProject: project,
          activeTab: activeTab,
          viewingSession: {
            session: session,
            projectPath: project.path,
            backState: {
              selectedProject: project,
              activeTab: activeTab
            }
          }
        }
      });
    }

    // Create tab at project level (default)
    return addTab({
      type: 'project',
      title: projectName,
      status: 'idle',
      hasUnsavedChanges: false,
      initialProjectPath: project.path,
      icon: 'folder',
      restoreProjectState: {
        selectedProject: project,
        sessions: [],
        activeTab: activeTab
      }
    });
  }, [addTab]);

  return {
    // State
    tabs,
    activeTab,
    activeTabId,
    tabCount,
    sessionTabCount,
    
    // Operations
    createSessionTab,
    createProjectTab,
    createProjectsTab,
    createUsageTab,
    createMCPTab,
    createSettingsTab,
    createClaudeMdTab,
    createAgentsTab,
    createClaudeFileTab,
    createCreateAgentTab,
    createImportAgentTab,
    closeTab,
    closeCurrentTab,
    switchToTab: setActiveTab,
    switchToNextTab,
    switchToPreviousTab,
    switchToTabByIndex,
    updateTab,
    updateTabTitle,
    updateTabStatus,
    markTabAsChanged,
    findTabBySessionId,
    findTabByType,
    getTabById,
    canAddTab
  };
};