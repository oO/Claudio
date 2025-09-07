import { Tab } from '@/contexts/TabContext';
import { NavigationStack } from '@/contexts/NavigationContext';
import { TabDehydrator, BasePersistedTab } from '../useTabDehydration';
import { logger } from '@/lib/logger';

/**
 * Generate a new tab ID
 */
const generateTabId = (): string => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Simple dehydrator for basic tabs that don't need special state
 * Used for: projects, agents, usage, mcp, settings
 */
export const createSimpleDehydrator = (tabType: Tab['type']): TabDehydrator<BasePersistedTab> => ({
  dehydrate: (tab: Tab): BasePersistedTab => ({
    type: tab.type,
    title: tab.title,
  }),

  rehydrate: (data: BasePersistedTab, index: number): Tab => ({
    id: generateTabId(),
    type: data.type,
    title: data.title,
    status: 'idle' as const,
    hasUnsavedChanges: false,
    order: index,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  canPersist: (tab: Tab): boolean => {
    return tab.type === tabType;
  },
});

/**
 * Dehydrator for project tabs - saves project ID to restore everything from that
 * Much simpler than trying to save navigation stacks - everything can be inferred from the project ID
 */
interface ProjectTabData extends BasePersistedTab {
  projectId?: string; // The key piece of data - everything else can be reconstructed
}

export const projectDehydrator: TabDehydrator<ProjectTabData> = {
  dehydrate: (tab: Tab): ProjectTabData => {
    // Extract project ID from various sources
    let projectId: string | undefined;
    
    // Method 1: From restoreProjectState
    if (tab.restoreProjectState?.selectedProject?.project_id) {
      projectId = tab.restoreProjectState.selectedProject.project_id;
    }
    // Method 2: From initialProjectPath - convert to project_id format
    else if (tab.initialProjectPath) {
      projectId = tab.initialProjectPath.replace(/\//g, '-').replace(/\s+/g, '-');
      // Remove leading dash if it exists
      if (projectId.startsWith('-')) {
        projectId = projectId.substring(1);
      }
    }
    
    logger.info('🔍 DEHYDRATING PROJECT TAB:', {
      title: tab.title,
      type: tab.type,
      initialProjectPath: tab.initialProjectPath,
      extractedProjectId: projectId,
      restoreProjectState: tab.restoreProjectState,
      fullTab: tab, // Let's see the full tab structure
    });
    
    return {
      type: tab.type,
      title: tab.title,
      projectId,
    };
  },

  rehydrate: (data: ProjectTabData, index: number): Tab => {
    // Convert project ID back to project path and restore state if available
    let initialProjectPath: string | undefined;
    let restoreProjectState: any = undefined;
    
    if (data.projectId) {
      // Convert project ID back to path format
      // Handle both cases: with and without leading dash
      const pathWithoutSpaces = data.projectId.replace(/-/g, '/');
      initialProjectPath = pathWithoutSpaces.startsWith('/') ? pathWithoutSpaces : '/' + pathWithoutSpaces;
      
      // Set up restore state to indicate this should load the specific project
      restoreProjectState = {
        selectedProject: {
          project_id: data.projectId,
          project_path: initialProjectPath,
        }
      };
    }
    
    logger.info('🔄 REHYDRATING PROJECT TAB:', {
      projectId: data.projectId,
      title: data.title,
      reconstructedPath: initialProjectPath,
      restoreProjectState,
    });
    
    return {
      id: generateTabId(),
      type: data.type,
      title: data.title,
      initialProjectPath,
      restoreProjectState,
      status: 'idle' as const,
      hasUnsavedChanges: false,
      order: index,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  canPersist: (tab: Tab): boolean => {
    // Can persist project tabs that have either:
    // 1. A specific project selected (restoreProjectState.selectedProject)
    // 2. An initialProjectPath 
    // 3. Default to true for project list view
    const hasProjectData = !!(
      tab.restoreProjectState?.selectedProject?.project_id || 
      tab.initialProjectPath
    );
    
    logger.info('🤔 CAN PERSIST PROJECT TAB?', {
      type: tab.type,
      hasProjectData,
      hasSelectedProject: !!tab.restoreProjectState?.selectedProject,
      hasInitialPath: !!tab.initialProjectPath,
      canPersist: tab.type === 'project'
    });
    
    return tab.type === 'project';
  },
};

/**
 * Dehydrator for session tabs that need session ID and project path
 */
interface SessionTabData extends BasePersistedTab {
  sessionId?: string;
  displayId?: string;
  initialProjectPath?: string;
}

export const sessionDehydrator: TabDehydrator<SessionTabData> = {
  dehydrate: (tab: Tab): SessionTabData => ({
    type: tab.type,
    title: tab.title,
    sessionId: tab.sessionId,
    displayId: tab.displayId,
    initialProjectPath: tab.initialProjectPath,
  }),

  rehydrate: (data: SessionTabData, index: number): Tab => ({
    id: generateTabId(),
    type: data.type,
    title: data.title,
    sessionId: data.sessionId,
    displayId: data.displayId,
    initialProjectPath: data.initialProjectPath,
    status: 'idle' as const,
    hasUnsavedChanges: false,
    order: index,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  canPersist: (tab: Tab): boolean => {
    return tab.type === 'project-session' && !!tab.sessionId;
  },
};

/**
 * Dehydrator for agent run tabs
 */
interface AgentTabData extends BasePersistedTab {
  agentRunId?: string;
  initialProjectPath?: string;
}

export const agentDehydrator: TabDehydrator<AgentTabData> = {
  dehydrate: (tab: Tab): AgentTabData => ({
    type: tab.type,
    title: tab.title,
    agentRunId: tab.agentRunId,
    initialProjectPath: tab.initialProjectPath,
  }),

  rehydrate: (data: AgentTabData, index: number): Tab => ({
    id: generateTabId(),
    type: data.type,
    title: data.title,
    agentRunId: data.agentRunId,
    initialProjectPath: data.initialProjectPath,
    status: 'idle' as const,
    hasUnsavedChanges: false,
    order: index,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  canPersist: (tab: Tab): boolean => {
    return tab.type === 'agent' && !!tab.agentRunId;
  },
};

/**
 * Dehydrator for Claude file tabs
 */
interface ClaudeFileTabData extends BasePersistedTab {
  claudeFileId?: string;
}

export const claudeFileDehydrator: TabDehydrator<ClaudeFileTabData> = {
  dehydrate: (tab: Tab): ClaudeFileTabData => ({
    type: tab.type,
    title: tab.title,
    claudeFileId: tab.claudeFileId,
  }),

  rehydrate: (data: ClaudeFileTabData, index: number): Tab => ({
    id: generateTabId(),
    type: data.type,
    title: data.title,
    claudeFileId: data.claudeFileId,
    status: 'idle' as const,
    hasUnsavedChanges: false,
    order: index,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  canPersist: (tab: Tab): boolean => {
    return tab.type === 'claude-file' && !!tab.claudeFileId;
  },
};

/**
 * Non-persistable dehydrator for temporary tabs
 */
export const temporaryDehydrator: TabDehydrator<any> = {
  dehydrate: (tab: Tab): any => {
    throw new Error(`Temporary tab of type ${tab.type} cannot be dehydrated`);
  },

  rehydrate: (data: any, index: number): Tab => {
    throw new Error(`Temporary tab data cannot be rehydrated`);
  },

  canPersist: (): boolean => false,
};