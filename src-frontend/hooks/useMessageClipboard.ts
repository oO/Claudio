import { useCallback } from 'react';
import type { ClaudeStreamMessage } from '@/components/agents';

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
        console.log(`Copied message location JSON to clipboard:`, messageLocation);
      } catch (error) {
        console.error("Failed to copy message location:", error);
      }
    } else if (message.uuid) {
      // Fallback to just UUID if missing data
      try {
        await navigator.clipboard.writeText(message.uuid);
        console.log(`Copied message UUID to clipboard: ${message.uuid}`);
      } catch (error) {
        console.error("Failed to copy message UUID:", error);
      }
    }
  }, [message, projectId, sessionId, sessionFilePath]);
};