import { useCallback } from 'react';
import type { ClaudeStreamMessage } from '@/components/agents';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';

interface UseMessageClipboardProps {
  message: ClaudeStreamMessage;
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
}

/**
 * Hook that provides clipboard functionality for message numbers
 * Handles copying message location JSON or UUID fallback
 */
export const useMessageClipboard = ({
  message,
  projectId,
  sessionId,
  sessionFilePath,
}: UseMessageClipboardProps) => {
  return useCallback(async () => {
    const contributingUuids = message._contributingMessageUuids || (message.uuid ? [message.uuid] : []);
    
    // Debug logging to see what's missing
    const debugData = {
      contributingUuids,
      contributingUuidsLength: contributingUuids.length,
      projectId,
      sessionId,
      sessionFilePath,
      allConditionsMet: contributingUuids.length > 0 && projectId && sessionId && sessionFilePath,
      timestamp: new Date().toISOString()
    };
    
    // Send debug info to backend log
    invoke('log_frontend_debug', {
      component: 'useMessageClipboard',
      data: debugData
    }).catch(err => logger.error('Failed to send debug to backend:', err));
    
    if (contributingUuids.length > 0 && projectId && sessionId && sessionFilePath) {
      try {
        // Build complete message location object (Single Source of Truth)
        const messageLocation = {
          project: projectId,
          session: sessionId,
          messages: contributingUuids,
          session_path: sessionFilePath
        };
        const locationJson = JSON.stringify(messageLocation, null, 2);
        await navigator.clipboard.writeText(locationJson);
        logger.log(`Copied message location JSON to clipboard:`, messageLocation);
      } catch (error) {
        logger.error("Failed to copy message location:", error);
      }
    } else if (message.uuid) {
      // Fallback to just UUID if missing data
      try {
        await navigator.clipboard.writeText(message.uuid);
        logger.log(`Copied message UUID to clipboard: ${message.uuid}`);
      } catch (error) {
        logger.error("Failed to copy message UUID:", error);
      }
    }
  }, [message, projectId, sessionId, sessionFilePath]);
};