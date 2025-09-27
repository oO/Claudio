import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import { eventManager } from '@/lib/TauriEventManager';

/**
 * Type definition for a native Claude session (matches backend)
 */
export interface LiveClaudeSession {
  session_id: string;
  project_path: string;
  status: string; // "idle" or "active"
  type: string; // "claude_session"
}

/**
 * Type definition for Claude thinking events (matches backend)
 */
export interface ClaudeThinkingEvent {
  session_id: string;
  project_path: string;
  status: string; // "active" or "idle"
  title?: string;    // Still sent by backend but we ignore it
  message?: string;  // Still sent by backend but we ignore it
}

/**
 * Thinking state for individual sessions (boolean only)
 */
interface ThinkingState {
  [sessionId: string]: boolean;
}

/**
 * Hook for tracking native Claude sessions and their thinking status
 * This provides real-time updates for sessions that exist outside of Claudio
 */
export const useNativeClaudeSessions = () => {
  const [liveSessions, setLiveSessions] = useState<LiveClaudeSession[]>([]);
  const [thinkingSessions, setThinkingSessions] = useState<ThinkingState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial live sessions
  const refreshLiveSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const sessions = await invoke<LiveClaudeSession[]>('get_live_claude_sessions');
      setLiveSessions(sessions);
      logger.info(`Loaded ${sessions.length} live Claude sessions`);
      logger.debug('Native Claude sessions:', sessions);
    } catch (err) {
      const errorMsg = `Failed to load live Claude sessions: ${err}`;
      logger.error(errorMsg);
      setError(errorMsg);
      setLiveSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get status for specific session
  const getSessionStatus = useCallback(async (sessionId: string): Promise<LiveClaudeSession | null> => {
    try {
      const session = await invoke<LiveClaudeSession | null>('get_claude_session_status', { sessionId });
      return session;
    } catch (err) {
      logger.error(`Failed to get Claude session status for ${sessionId}:`, err);
      return null;
    }
  }, []);

  // Listen for real-time thinking updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupThinkingListener = async () => {
      try {
        unsubscribe = await eventManager.subscribe<ClaudeThinkingEvent>('claude-session-thinking', (thinkingEvent) => {
          const { session_id, status } = thinkingEvent;
          
          logger.info(`🧠 Claude thinking event received:`, { session_id, status });
          
          if (status === 'active') {
            // Set thinking state to true
            logger.debug(`Setting thinking state for session ${session_id}`);
            setThinkingSessions(prev => ({
              ...prev,
              [session_id]: true
            }));
          } else {
            // Remove thinking state
            logger.debug(`Removing thinking state for session ${session_id} (status: ${status})`);
            setThinkingSessions(prev => {
              const updated = { ...prev };
              delete updated[session_id];
              return updated;
            });
          }
        });
        
        logger.debug('Claude thinking listener setup complete');
      } catch (err) {
        logger.error('Failed to setup Claude thinking listener:', err);
      }
    };

    setupThinkingListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    refreshLiveSessions();
  }, [refreshLiveSessions]);

  // Get all live sessions (no project filtering needed - we just match by session ID)
  const getAllLiveSessions = useCallback((): LiveClaudeSession[] => {
    return liveSessions;
  }, [liveSessions]);

  // Check if session is thinking
  const isSessionThinking = useCallback((sessionId: string): boolean => {
    return thinkingSessions[sessionId] || false;
  }, [thinkingSessions]);
  
  // Query initial state for a session (async version)
  const queryInitialSessionState = useCallback(async (sessionId: string): Promise<void> => {
    // Don't query if we already have state for this session
    if (sessionId in thinkingSessions) {
      logger.debug(`🧠 Session ${sessionId} already has cached thinking state`);
      return;
    }
    
    try {
      const sessionStatus = await getSessionStatus(sessionId);
      if (sessionStatus && sessionStatus.status === "active") {
        // Update thinking state for this session
        setThinkingSessions(prev => ({
          ...prev,
          [sessionId]: true
        }));
        logger.info(`🧠 Initial query: Session ${sessionId} is active (thinking)`);
      } else {
        logger.debug(`🧠 Initial query: Session ${sessionId} is idle or not found`);
      }
    } catch (error) {
      logger.error(`Failed to query initial session status for ${sessionId}:`, error);
    }
  }, [thinkingSessions, getSessionStatus]);


  return {
    // State
    liveSessions,
    thinkingSessions,
    isLoading,
    error,
    
    // Actions
    refreshLiveSessions,
    getSessionStatus,
    queryInitialSessionState,
    
    // Helpers
    getAllLiveSessions,
    isSessionThinking,
    
    // Stats
    totalSessions: liveSessions.length,
    thinkingCount: Object.keys(thinkingSessions).length,
  };
};