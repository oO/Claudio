import React, { useCallback } from "react";
import {
  MessageSquare,
  Clock,
  ArrowUpFromLine,
  ArrowDownToLine,
} from "lucide-react";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { useMessageClipboard } from "@/hooks/useMessageClipboard";
import { useSessionContext } from "@/contexts/SessionContext";
import { useMessageEnhancement } from "@/contexts/MessageEnhancementContext";
import { logger } from "@/lib/logger";

interface MessageFooterProps {
  message: ClaudeStreamMessage;
}

/**
 * Footer component that displays message metadata: tokens, timestamp, and message number.
 * Handles the clipboard functionality for message numbers.
 */
export const MessageFooter: React.FC<MessageFooterProps> = ({ message }) => {
  // Get session data from context instead of props
  const { projectPath, sessionId, sessionFilePath } = useSessionContext();
  
  // Get enhanced message with combined UUIDs from context
  const { enhancedMessage } = useMessageEnhancement();

  const rawClipboardHandler = useMessageClipboard({
    message: enhancedMessage,
    projectPath,
    sessionId,
    sessionFilePath,
  });

  const handleClipboard = useCallback(async () => {
    try {
      await rawClipboardHandler();
    } catch (error) {
      logger.error("Clipboard operation failed:", error);
      // Show user-friendly error (you could also use a toast here)
      alert(`Failed to copy message location: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [rawClipboardHandler]);

  // Resolve usage from message object
  const resolvedUsage =
    (message as any).message?.usage || (message as any).usage;

  // Check if we should render the footer at all
  const shouldRender =
    message.ui_index ||
    message.timestamp ||
    (resolvedUsage?.input_tokens && resolvedUsage.input_tokens > 0) ||
    (resolvedUsage?.output_tokens && resolvedUsage.output_tokens > 0);

  if (!shouldRender) return null;

  return (
    <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground mt-2">
      {/* Output tokens */}
      {resolvedUsage?.output_tokens && resolvedUsage.output_tokens > 0 && (
        <div className="flex items-center">
          <ArrowUpFromLine className="h-3 w-3" />
          {resolvedUsage.output_tokens}
        </div>
      )}

      {/* Input tokens */}
      {resolvedUsage?.input_tokens && resolvedUsage.input_tokens > 0 && (
        <div className="flex items-center">
          <ArrowDownToLine className="h-3 w-3" />
          {resolvedUsage.input_tokens}
        </div>
      )}

      {/* Timestamp */}
      {message.timestamp && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      )}

      {/* Message number with clipboard functionality */}
      {message.ui_index && (
        <div
          className="flex items-center gap-1 cursor-pointer bg-accent text-foreground hover:text-accent-foreground px-2 py-1 rounded-full transition-colors"
          onClick={handleClipboard}
          title="Click to copy message location JSON (all contributing messages)"
        >
          <MessageSquare className="h-3 w-3" />
          {message.ui_index.toString().padStart(3, "0")}
        </div>
      )}
    </div>
  );
};
