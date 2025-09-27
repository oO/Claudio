import React, { useCallback } from "react";
import {
  MessageSquare,
  Clock,
  ArrowUpFromLine,
  ArrowDownToLine,
  Cpu,
} from "lucide-react";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { useMessageClipboard } from "@/hooks/useMessageClipboard";
import { useSessionContext } from "@/contexts/SessionContext";
import { useMessageEnhancement } from "@/contexts/MessageEnhancementContext";
import { logger } from "@/lib/logger";

interface MessageFooterProps {
  message: ClaudeStreamMessage;
}

interface ParsedModel {
  name: string;
  version: string;
  date: Date | null;
  fullName: string;
}

/**
 * Parses Claude model names like "claude-sonnet-4-20250514" into structured components
 */
function parseModelName(modelString: string): ParsedModel | null {
  if (!modelString) return null;

  // Pattern: claude-{name}-{version}-{YYYYMMDD}
  const match = modelString.match(/^claude-([^-]+)-(\d+(?:\.\d+)?)-(\d{8})$/);
  if (!match) return null;

  const [, name, version, dateStr] = match;

  // Parse date (YYYYMMDD format)
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month, day);

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    version,
    date,
    fullName: modelString,
  };
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
      alert(
        `Failed to copy message location: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }, [rawClipboardHandler]);

  // Resolve usage from message object
  const resolvedUsage =
    (message as any).message?.usage || (message as any).usage;

  // Extract and parse model from message (assistant messages have message.message.model)
  const rawModel = (message as any).message?.model;
  const parsedModel = rawModel ? parseModelName(rawModel) : null;

  // Check if we should render the footer at all
  const shouldRender =
    message.ui_index ||
    message.timestamp ||
    parsedModel ||
    (resolvedUsage?.input_tokens && resolvedUsage.input_tokens > 0) ||
    (resolvedUsage?.output_tokens && resolvedUsage.output_tokens > 0);

  if (!shouldRender) return null;

  return (
    <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground mt-2">
      {/* Model - First metadata item */}
      {parsedModel && (
        <div
          className="flex items-center gap-1"
          title={`Model: ${parsedModel.fullName}${parsedModel.date ? ` (Released: ${parsedModel.date.toLocaleDateString()})` : ""}`}
        >
          <Cpu className="h-3 w-3" />
          <span>
            <span>{parsedModel.name}</span>
            {parsedModel.version && <span> v{parsedModel.version}</span>}
          </span>
        </div>
      )}

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
