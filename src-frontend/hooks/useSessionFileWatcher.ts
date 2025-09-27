import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import { useSessionFileEvents } from '@/hooks/useGlobalEvent';
import type { Session } from '@/lib/api';

/**
 * Session file event types that can be received from the backend
 * This matches the actual structure sent by the backend: {type, data}
 */
export interface SessionFileEvent {
  type: 'Modified' | 'Created' | 'Removed';
  data: {
    session_id: string;
    project_id: string;
    file_path: string;
    modified_at?: number;
    created_at?: number;
  };
}

interface UseSessionFileWatcherOptions {
  /**
   * Current session being viewed (if any)
   */
  session?: Session;
  /**
   * Project ID to watch for session changes
   */
  projectId?: string;
  /**
   * Callback when session file is modified and needs refresh
   */
  onSessionChanged: () => Promise<void>;
  /**
   * Callback when a new session is created in the project
   */
  onSessionCreated?: (sessionId: string) => void;
  /**
   * Callback when a session is removed/deleted
   */
  onSessionRemoved?: (sessionId: string) => void;
  /**
   * Whether file watching is enabled
   */
  enabled?: boolean;
  /**
   * Unique tab ID for this session tab
   */
  tabId: string;
}

/**
 * Global registry to track which sessions have active tabs
 * This allows us to only watch session files that are currently opened
 */
class SessionTabRegistry {
  private activeTabs = new Map<string, Set<string>>(); // projectId -> Set<sessionId>
  private tabsPerSession = new Map<string, Set<string>>(); // sessionId -> Set<tabId>
  private watchedProjects = new Set<string>();

  /**
   * Register a tab for a specific session
   */
  registerTab(tabId: string, projectId: string, sessionId?: string) {
    
    // Start watching project if not already watched (even for session list watchers without specific session)
    if (!this.watchedProjects.has(projectId)) {
      this.startWatchingProject(projectId);
    }

    // If no specific session, we're done (session list watcher case)
    if (!sessionId) {
      return;
    }

    // Add to project's active sessions
    if (!this.activeTabs.has(projectId)) {
      this.activeTabs.set(projectId, new Set());
    }
    this.activeTabs.get(projectId)!.add(sessionId);

    // Track tabs for this session
    if (!this.tabsPerSession.has(sessionId)) {
      this.tabsPerSession.set(sessionId, new Set());
    }
    this.tabsPerSession.get(sessionId)!.add(tabId);

  }

  /**
   * Unregister a tab
   */
  unregisterTab(tabId: string, projectId: string, sessionId?: string) {
    // If no specific session, just stop watching project if no other sessions
    if (!sessionId) {
      const projectSessions = this.activeTabs.get(projectId);
      if (!projectSessions || projectSessions.size === 0) {
        this.stopWatchingProject(projectId);
      }
      return;
    }

    // Remove tab from session
    const sessionTabs = this.tabsPerSession.get(sessionId);
    if (sessionTabs) {
      sessionTabs.delete(tabId);
      
      // If no more tabs for this session, remove session from active list
      if (sessionTabs.size === 0) {
        this.tabsPerSession.delete(sessionId);
        
        const projectSessions = this.activeTabs.get(projectId);
        if (projectSessions) {
          projectSessions.delete(sessionId);
          
          // If no more sessions in project, stop watching
          if (projectSessions.size === 0) {
            this.activeTabs.delete(projectId);
            this.stopWatchingProject(projectId);
          }
        }
      }
    }

  }

  /**
   * Check if a session has active tabs
   */
  hasActiveTab(sessionId: string): boolean {
    const tabs = this.tabsPerSession.get(sessionId);
    return tabs ? tabs.size > 0 : false;
  }

  /**
   * Get all active sessions for a project
   */
  getActiveSessionsForProject(projectId: string): string[] {
    return Array.from(this.activeTabs.get(projectId) || []);
  }

  private async startWatchingProject(projectId: string) {
    try {
      await invoke('start_session_watching', { projectId });
      this.watchedProjects.add(projectId);
    } catch (error) {
      logger.error(`Failed to start watching project ${projectId}:`, error);
    }
  }

  private async stopWatchingProject(projectId: string) {
    try {
      await invoke('stop_session_watching', { projectId });
      this.watchedProjects.delete(projectId);
    } catch (error) {
      logger.error(`Failed to stop watching project ${projectId}:`, error);
    }
  }
}

// Global registry instance
const sessionTabRegistry = new SessionTabRegistry();

/**
 * Hook to watch session files using Tauri's native file watching instead of polling
 * Only watches sessions that have active tabs open to optimize performance
 * 
 * This replaces the old useSessionPolling hook with efficient file system events
 */
export function useSessionFileWatcher({
  session,
  projectId,
  onSessionChanged,
  onSessionCreated,
  onSessionRemoved,
  enabled = true,
  tabId
}: UseSessionFileWatcherOptions) {
  
  const scrollPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Store scroll position before refresh
  const preserveScrollPosition = useCallback(() => {
    scrollPositionRef.current = {
      x: window.scrollX,
      y: window.scrollY
    };
  }, []);

  // Restore scroll position after refresh
  const restoreScrollPosition = useCallback(() => {
    const { x, y } = scrollPositionRef.current;
    setTimeout(() => {
      window.scrollTo(x, y);
    }, 100);
  }, []);

  // Handle session file events from backend
  const handleSessionFileEvent = useCallback(async (event: SessionFileEvent) => {
    // Extract type and data from new event structure
    const eventType = event.type;
    const eventData = event.data;

    // Only handle events for the current project
    if (projectId && eventData.project_id !== projectId) {
      return;
    }

    switch (eventType) {
      case 'Modified':
        // If we're watching a session list (no specific session), always refresh
        if (!session) {
          try {
            await onSessionChanged();
          } catch (error) {
            logger.error('Failed to refresh session list after file change:', error);
          }
        }
        // If watching a specific session, check if it has active tabs
        else {
          if (sessionTabRegistry.hasActiveTab(eventData.session_id)) {
            // If this is the current session, refresh it
            if (eventData.session_id === session.id) {
              preserveScrollPosition();
              try {
                await onSessionChanged();
                restoreScrollPosition();
              } catch (error) {
                logger.error('Failed to refresh session after file change:', error);
              }
            }
          }
        }
        break;

      case 'Created':
        onSessionCreated?.(eventData.session_id);
        break;

      case 'Removed':
        onSessionRemoved?.(eventData.session_id);
        break;

      default:
        logger.warn('Unknown session file event type:', eventType);
    }
  }, [session, projectId, onSessionChanged, onSessionCreated, onSessionRemoved, preserveScrollPosition, restoreScrollPosition]);

  // Register/unregister this tab in the global registry
  // Use ref to track previous session and prevent cleanup during session switches
  const prevSessionIdRef = useRef<string | undefined>();
  const isUnmountingRef = useRef(false);
  
  // Handle session registration/switching
  useEffect(() => {
    
    
    if (!enabled || !projectId) {
      // If we're disabling, clean up previous session if any
      if (prevSessionIdRef.current && projectId) {
        sessionTabRegistry.unregisterTab(tabId, projectId, prevSessionIdRef.current);
        prevSessionIdRef.current = undefined;
      }
      return;
    }


    // For session list watchers (no specific session), register without sessionId
    if (!session) {
      try {
        sessionTabRegistry.registerTab(tabId, projectId, undefined);
      } catch (error) {
        logger.error('Failed to register session list watcher:', error);
      }
      return;
    }

    const currentSessionId = session.id;
    const previousSessionId = prevSessionIdRef.current;

    // Register the new session first
    sessionTabRegistry.registerTab(tabId, projectId, currentSessionId);
    
    // Then unregister the previous session (if different)
    // This ensures active sessions list never becomes empty during session switches
    if (previousSessionId && previousSessionId !== currentSessionId) {
      sessionTabRegistry.unregisterTab(tabId, projectId, previousSessionId);
    }
    
    // Update ref for next time
    prevSessionIdRef.current = currentSessionId;
  }, [enabled, tabId, projectId, session?.id]);

  // Separate effect for cleanup on unmount only
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (prevSessionIdRef.current && projectId) {
        sessionTabRegistry.unregisterTab(tabId, projectId, prevSessionIdRef.current);
        prevSessionIdRef.current = undefined;
      }
    };
  }, [projectId]); // Include projectId dependency for cleanup

  // Use global event manager for session file changes
  useSessionFileEvents<SessionFileEvent>(
    projectId,
    handleSessionFileEvent,
    enabled
  );

  // Manual refresh function for compatibility
  const forceRefresh = useCallback(async () => {
    try {
      preserveScrollPosition();
      await onSessionChanged();
      restoreScrollPosition();
    } catch (error) {
      logger.error('Failed to force refresh session:', error);
    }
  }, [onSessionChanged, preserveScrollPosition, restoreScrollPosition]);

  return {
    /**
     * Whether this session is being watched (has active tabs)
     */
    isWatching: session ? sessionTabRegistry.hasActiveTab(session.id) : false,
    
    /**
     * Which project we're currently watching (if any)
     */
    watchingProject: projectId,
    
    /**
     * Manual refresh function (for backward compatibility)
     */
    forceRefresh,
    
    /**
     * Get all active sessions for the current project
     */
    getActiveSessions: () => projectId ? sessionTabRegistry.getActiveSessionsForProject(projectId) : [],
  };
}

/**
 * Simple hook for just getting notified when ANY session file changes in a project
 * Useful for session lists that need to refresh when sessions are added/removed/modified
 * This version uses a unique tab ID for session list components
 */
export function useSessionListWatcher(
  projectId: string | undefined,
  onSessionListChanged: () => Promise<void>,
  enabled = true
) {
  // Generate a unique tab ID for this session list component
  const tabId = useRef(`session-list-${Math.random().toString(36).substr(2, 9)}`);

  // Immediate debug logging (no useEffect)

  // Debug logging
  useEffect(() => {
    if (projectId && enabled) {
    }
  }, [projectId, enabled]);

  // Initial fetch when component mounts with valid projectId
  useEffect(() => {
    if (projectId && enabled) {
      onSessionListChanged().catch(error => {
        logger.error(`Initial session list fetch failed for project ${projectId}:`, error);
      });
    }
  }, [projectId, enabled]); // Only run when projectId or enabled changes

  return useSessionFileWatcher({
    projectId,
    onSessionChanged: async () => {
      await onSessionListChanged();
    },
    onSessionCreated: async () => {
      await onSessionListChanged();
    },
    onSessionRemoved: async () => {
      await onSessionListChanged();
    },
    enabled,
    tabId: tabId.current
  });
}