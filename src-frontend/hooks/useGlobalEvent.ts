import { useEffect, useRef } from 'react';
import { eventManager } from '@/lib/TauriEventManager';
import { logger } from '@/lib/logger';

/**
 * Filter options for event routing
 */
interface EventFilter {
  /** Route only events with this session_id */
  sessionId?: string;
  /** Route only events with this handle_id */  
  handleId?: string;
  /** Route only events with this project_id */
  projectId?: string;
  /** Route only events with this claudio_id */
  claudioid?: string;
  /** Custom filter function */
  custom?: (payload: any) => boolean;
}

/**
 * React hook for subscribing to Tauri events via the global event manager
 * 
 * Benefits:
 * - No duplicate event listeners
 * - Survives React re-renders
 * - Automatic cleanup on unmount
 * - Type-safe event payloads
 * - Built-in filtering support
 * 
 * @example
 * ```typescript
 * // Subscribe to all session-file-changed events
 * useGlobalEvent('session-file-changed', (event) => {
 *   console.log('Session changed:', event);
 * });
 * 
 * // Subscribe only to events for a specific project
 * useGlobalEvent('session-file-changed', (event) => {
 *   refreshSessions();
 * }, { projectId: 'my-project-id' });
 * ```
 */
export function useGlobalEvent<T = any>(
  eventName: string,
  callback: (payload: T) => void,
  filter?: EventFilter,
  enabled = true
): void {
  const callbackRef = useRef(callback);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Keep callback ref current
  callbackRef.current = callback;
  
  useEffect(() => {
    if (!enabled) {
      logger.log(`🚫 useGlobalEvent disabled for '${eventName}'`);
      return;
    }
    
    logger.log(`🎧 useGlobalEvent setting up subscription for '${eventName}'`, { filter });
    
    // Subscribe to the event
    const setupSubscription = async () => {
      try {
        const unsubscribe = await eventManager.subscribe(
          eventName,
          (payload: T) => {
            // Debug logging for React callback
            if (eventName === 'session-file-changed') {
              logger.debug(`🔍 React callback for ${eventName}:`, payload);
            }

            try {
              // Use ref to get latest callback
              callbackRef.current(payload);
            } catch (error) {
              logger.error(`❌ useGlobalEvent callback error for '${eventName}':`, error);
            }
          },
          filter
        );
        
        unsubscribeRef.current = unsubscribe;
        logger.log(`✅ useGlobalEvent subscription active for '${eventName}'`);
      } catch (error) {
        logger.error(`❌ useGlobalEvent failed to subscribe to '${eventName}':`, error);
      }
    };
    
    setupSubscription();
    
    // Cleanup on unmount or dependency change
    return () => {
      logger.log(`🧹 useGlobalEvent cleaning up subscription for '${eventName}'`);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [eventName, enabled, filter?.sessionId, filter?.handleId, filter?.projectId, filter?.claudioid]);
}

/**
 * Hook specifically for session file events with project filtering
 */
export function useSessionFileEvents<T = any>(
  projectId: string | undefined,
  onSessionChanged: (event: T) => void,
  enabled = true
): void {
  useGlobalEvent<T>(
    'session-file-changed',
    onSessionChanged,
    projectId ? { projectId } : undefined,
    enabled && !!projectId
  );
}

/**
 * Hook specifically for session message streaming with handle filtering
 */
export function useSessionMessageStream(
  handleId: string | undefined,
  onMessage: (event: any) => void,
  enabled = true
): void {
  useGlobalEvent(
    'session_message_stream',
    onMessage,
    handleId ? { handleId } : undefined,
    enabled && !!handleId
  );
}

/**
 * Hook specifically for Claude process events with session filtering
 */
export function useClaudeProcessEvents(
  sessionId: string | undefined,
  onProcessEvent: (event: any) => void,
  enabled = true
): void {
  useGlobalEvent(
    'claude-process-event',
    onProcessEvent,
    sessionId ? { sessionId } : undefined,
    enabled && !!sessionId
  );
}

/**
 * Hook specifically for agent events with run ID filtering
 */
export function useAgentEvents(
  runId: string | undefined,
  onOutput?: (output: string) => void,
  onError?: (error: string) => void,
  onComplete?: (success: boolean) => void,
  enabled = true
): void {
  const isEnabled = enabled && !!runId;
  
  useGlobalEvent(
    `agent-output:${runId}`,
    onOutput || (() => {}),
    undefined,
    isEnabled && !!onOutput
  );
  
  useGlobalEvent(
    `agent-error:${runId}`,
    onError || (() => {}),
    undefined,
    isEnabled && !!onError
  );
  
  useGlobalEvent(
    `agent-complete:${runId}`,
    onComplete || (() => {}),
    undefined,
    isEnabled && !!onComplete
  );
}

/**
 * Debug hook to get current event manager state
 */
export function useEventManagerDebug(): {
  listeners: string[];
  subscriptions: Record<string, number>;
} {
  const debugInfo = eventManager.getDebugInfo();
  logger.log('🔍 Event Manager Debug Info:', debugInfo);
  return debugInfo;
}