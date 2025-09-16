import { useCallback } from 'react';
import type { ClaudeStreamMessage } from "@/lib/outputCache";
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
 * Requires all session context data to work properly - no fallbacks
 */
export const useMessageClipboard = ({
  message,
  projectPath,
  sessionId,
  sessionFilePath,
}: UseMessageClipboardProps) => {
  return useCallback(async () => {
    const contributingUuids = message._contributingMessageUuids || (message.uuid ? [message.uuid] : []);
    
    // Require all session data - no silent fallbacks
    if (!projectPath || !sessionId || !sessionFilePath) {
      const missing = [];
      if (!projectPath) missing.push('projectPath');
      if (!sessionId) missing.push('sessionId');
      if (!sessionFilePath) missing.push('sessionFilePath');
      
      const errorMsg = `Cannot copy message location: missing required session data: ${missing.join(', ')}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    if (contributingUuids.length === 0) {
      const errorMsg = 'Cannot copy message location: no contributing UUIDs found';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    try {
      // Build minimal message location object for finding messages in source file
      const messageLocation = {
        session_id: sessionId,
        session_path: sessionFilePath,
        ui_index: message.ui_index,
        messages_uuid: contributingUuids,
        project_path: projectPath
      };
      const locationJson = JSON.stringify(messageLocation, null, 2);
      await navigator.clipboard.writeText(locationJson);
      logger.log(`Copied message location JSON to clipboard:`, messageLocation);
    } catch (error) {
      logger.error("Failed to copy message location:", error);
      throw error;
    }
  }, [message, projectPath, sessionId, sessionFilePath]);
};