import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '@/lib/logger';

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
  status: string; // "thinking" or "idle"
  title?: string;
  message?: string;
}

/**
 * Thinking state for individual sessions
 */
interface ThinkingState {
  [sessionId: string]: {
    title: string;
    message: string;
    isThinking: boolean;
  };
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
    let unlistenThinking: UnlistenFn | null = null;

    const setupThinkingListener = async () => {
      try {
        unlistenThinking = await listen<ClaudeThinkingEvent>('claude-session-thinking', (event) => {
          const { session_id, status, title, message } = event.payload;
          
          logger.debug(`Claude thinking event: ${session_id} → ${status}`);
          
          if (status === 'thinking' && title && message) {
            // Add thinking state
            setThinkingSessions(prev => ({
              ...prev,
              [session_id]: { title, message, isThinking: true }
            }));
          } else {
            // Remove thinking state
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
      if (unlistenThinking) {
        unlistenThinking();
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
    return thinkingSessions[sessionId]?.isThinking || false;
  }, [thinkingSessions]);

  // Get thinking data for session
  const getThinkingData = useCallback((sessionId: string) => {
    return thinkingSessions[sessionId] || null;
  }, [thinkingSessions]);

  return {
    // State
    liveSessions,
    thinkingSessions,
    isLoading,
    error,
    
    // Actions
    refreshLiveSessions,
    getSessionStatus,
    
    // Helpers
    getAllLiveSessions,
    isSessionThinking,
    getThinkingData,
    
    // Stats
    totalSessions: liveSessions.length,
    thinkingCount: Object.keys(thinkingSessions).length,
  };
};