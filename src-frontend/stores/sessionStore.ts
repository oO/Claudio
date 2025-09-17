import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { api } from '@/lib/api';
import type { Session, Project } from '@/lib/api';
import { logger } from '@/lib/logger';
import { eventManager } from '@/lib/TauriEventManager';

interface SessionCacheMetadata {
  lastFetched: number;
  isStale: boolean;
}

interface SessionState {
  // Projects and sessions data
  projects: Project[];
  sessions: Record<string, Session[]>; // Keyed by projectId
  sessionCacheMetadata: Record<string, SessionCacheMetadata>; // Keyed by projectId
  currentSessionId: string | null;
  currentSession: Session | null;
  sessionOutputs: Record<string, string>; // Keyed by sessionId

  // UI state
  isLoadingProjects: boolean;
  isLoadingSessions: boolean;
  isLoadingOutputs: boolean;
  error: string | null;

  // File watching state
  watchedProjects: Set<string>;
  fileWatcherInitialized: boolean;
  
  // Actions
  fetchProjects: () => Promise<void>;
  fetchProjectSessions: (projectId: string, force?: boolean) => Promise<void>;
  setCurrentSession: (sessionId: string | null) => void;
  fetchSessionOutput: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string, projectId: string) => Promise<void>;
  clearError: () => void;

  // File watching
  initializeFileWatcher: () => Promise<void>;
  addProjectToWatch: (projectId: string) => void;
  handleFileChange: (projectId: string) => void;

  // Real-time updates
  handleSessionUpdate: (session: Session) => void;
  handleOutputUpdate: (sessionId: string, output: string) => void;
}

const sessionStore: StateCreator<
  SessionState,
  [],
  [['zustand/subscribeWithSelector', never]],
  SessionState
> = (set, get) => ({
    // Initial state
    projects: [],
    sessions: {},
    sessionCacheMetadata: {},
    currentSessionId: null,
    currentSession: null,
    sessionOutputs: {},
    isLoadingProjects: false,
    isLoadingSessions: false,
    isLoadingOutputs: false,
    error: null,
    watchedProjects: new Set(),
    fileWatcherInitialized: false,
    
    // Fetch all projects
    fetchProjects: async () => {
      set({ isLoadingProjects: true, error: null });
      try {
        const projects = await api.listProjects();
        set({ projects, isLoadingProjects: false });
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch projects',
          isLoadingProjects: false 
        });
      }
    },
    
    // Fetch sessions for a specific project with simple caching
    fetchProjectSessions: async (projectId: string, force = false) => {
      const state = get();
      const now = Date.now();
      const metadata = state.sessionCacheMetadata[projectId];

      // Check if we have recent cached data (within 5 seconds) and don't force
      if (!force && metadata && !metadata.isStale && (now - metadata.lastFetched) < 5000) {
        return;
      }

      set({ isLoadingSessions: true, error: null });
      try {
        const projectSessions = await api.getProjectSessions(projectId);
        set((state) => ({
          sessions: {
            ...state.sessions,
            [projectId]: projectSessions
          },
          sessionCacheMetadata: {
            ...state.sessionCacheMetadata,
            [projectId]: {
              lastFetched: now,
              isStale: false
            }
          },
          isLoadingSessions: false
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch sessions',
          isLoadingSessions: false
        });
      }
    },
    
    // Set current session
    setCurrentSession: (sessionId: string | null) => {
      const { sessions } = get();
      let currentSession: Session | null = null;
      
      if (sessionId) {
        // Find session across all projects
        for (const projectSessions of Object.values(sessions)) {
          const found = projectSessions.find((s) => s.id === sessionId);
          if (found) {
            currentSession = found;
            break;
          }
        }
      }
      
      set({ currentSessionId: sessionId, currentSession });
    },
    
    // Fetch session output
    fetchSessionOutput: async (sessionId: string) => {
      set({ isLoadingOutputs: true, error: null });
      try {
        const output = await api.getClaudeSessionOutput(sessionId);
        set((state) => ({
          sessionOutputs: {
            ...state.sessionOutputs,
            [sessionId]: output
          },
          isLoadingOutputs: false
        }));
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch session output',
          isLoadingOutputs: false 
        });
      }
    },
    
    // Delete session
    deleteSession: async (sessionId: string, projectId: string) => {
      try {
        // Note: API doesn't have a deleteSession method, so this is a placeholder
        logger.warn('deleteSession not implemented in API');
        
        // Update local state
        set((state) => ({
          sessions: {
            ...state.sessions,
            [projectId]: state.sessions[projectId]?.filter((s) => s.id !== sessionId) || []
          },
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
          currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
          sessionOutputs: Object.fromEntries(
            Object.entries(state.sessionOutputs).filter(([id]) => id !== sessionId)
          )
        }));
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to delete session'
        });
        throw error;
      }
    },
    
    // Clear error
    clearError: () => set({ error: null }),

    // Initialize file watcher (call once globally)
    initializeFileWatcher: async () => {
      const state = get();
      if (state.fileWatcherInitialized) {
        return; // Already initialized
      }

      try {
        await eventManager.subscribe('session-file-changed', (payload: any) => {
          const projectId = payload.project_id || payload.data?.project_id;
          if (projectId) {
            get().handleFileChange(projectId);
          }
        });

        set({ fileWatcherInitialized: true });
      } catch (error) {
        logger.error('Failed to initialize session file watcher:', error);
      }
    },

    // Add project to watch list
    addProjectToWatch: (projectId: string) => {
      const state = get();
      if (!state.watchedProjects.has(projectId)) {
        const newWatchedProjects = new Set(state.watchedProjects);
        newWatchedProjects.add(projectId);
        set({ watchedProjects: newWatchedProjects });
      }
    },

    // Handle file change for a project
    handleFileChange: (projectId: string) => {
      const state = get();

      // Only process if we're watching this project
      if (!state.watchedProjects.has(projectId)) {
        return;
      }

      // Mark cache as stale
      set((state) => ({
        sessionCacheMetadata: {
          ...state.sessionCacheMetadata,
          [projectId]: {
            ...state.sessionCacheMetadata[projectId],
            isStale: true
          }
        }
      }));

      // Debounced refetch (use a simple timeout to avoid rapid calls)
      setTimeout(() => {
        const currentState = get();
        if (currentState.sessionCacheMetadata[projectId]?.isStale) {
          currentState.fetchProjectSessions(projectId, true);
        }
      }, 500); // 500ms debounce
    },

    // Handle session update
    handleSessionUpdate: (session: Session) => {
      set(state => {
        const projectId = session.project_id;
        const projectSessions = state.sessions[projectId] || [];
        const existingIndex = projectSessions.findIndex((s) => s.id === session.id);
        
        let updatedSessions;
        if (existingIndex >= 0) {
          updatedSessions = [...projectSessions];
          updatedSessions[existingIndex] = session;
        } else {
          updatedSessions = [session, ...projectSessions];
        }
        
        return {
          sessions: {
            ...state.sessions,
            [projectId]: updatedSessions
          },
          currentSession: state.currentSessionId === session.id ? session : state.currentSession
        };
      });
    },
    
    // Handle output update
    handleOutputUpdate: (sessionId: string, output: string) => {
      set((state) => ({
        sessionOutputs: {
          ...state.sessionOutputs,
          [sessionId]: output
        }
      }));
    }
  });

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector(sessionStore)
);

/**
 * Custom hook to replace useSessionListWatcher pattern
 * Provides cached sessions and sets up centralized file watching
 */
export function useProjectSessions(projectId: string | undefined) {
  const store = useSessionStore();

  // Get sessions for this project from cache
  const sessions = projectId ? store.sessions[projectId] || [] : [];
  const isLoading = store.isLoadingSessions;
  const error = store.error;

  // Initialize file watcher on first use (globally)
  React.useEffect(() => {
    store.initializeFileWatcher();
  }, []);

  // Set up watching and fetch sessions when projectId changes
  React.useEffect(() => {
    if (!projectId) return;

    // Add to watch list
    store.addProjectToWatch(projectId);

    // Fetch sessions (will use cache if recent)
    store.fetchProjectSessions(projectId);
  }, [projectId]); // store is stable in zustand, don't include it

  return {
    sessions,
    isLoading,
    error,
    refetch: () => projectId && store.fetchProjectSessions(projectId, true)
  };
}