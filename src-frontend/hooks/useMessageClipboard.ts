import { useCallback } from 'react';
import type { ClaudeStreamMessage } from '@/components/agents';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';

interface UseMessageClipboardProps {
  message: ClaudeStreamMessage;
  projectPath?: string;
  sessionId?: string;
  sessionFilePath?: string;
}

/**
 * Hook that provides clipboard functionality for message numbers
 * Handles copying message location JSON or UUID fallback
 */
export const useMessageClipboard = ({
  message,
  projectPath,
  sessionId,
  sessionFilePath,
}: UseMessageClipboardProps) => {
  return useCallback(async () => {
    const contributingUuids = message._contributingMessageUuids || (message.uuid ? [message.uuid] : []);
    
    if (contributingUuids.length > 0 && projectPath && sessionId && sessionFilePath) {
      try {
        // Build minimal message location object for finding messages in source file
        const messageLocation = {
          session_id: sessionId,
          session_path: sessionFilePath,
          ui_index: message.messageNumber,
          messages_uuid: contributingUuids,
          project_path: projectPath
        };
        const locationJson = JSON.stringify(messageLocation, null, 2);
        await navigator.clipboard.writeText(locationJson);
        logger.log(`Copied message location JSON to clipboard:`, messageLocation);
      } catch (error) {
        logger.error("Failed to copy message location:", error);
      }
    } else if (message.uuid || (message as any).leafUuid) {
      // Fallback to just UUID if missing data
      const fallbackId = message.uuid || (message as any).leafUuid;
      try {
        await navigator.clipboard.writeText(fallbackId);
        logger.log(`Copied message ID to clipboard: ${fallbackId}`);
      } catch (error) {
        logger.error("Failed to copy message ID:", error);
      }
    }
  }, [message, projectPath, sessionId, sessionFilePath]);
};