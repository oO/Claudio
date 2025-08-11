import React from "react";
import { cn } from "@/lib/utils";

interface MessageTimestampProps {
  timestamp?: string | Date;
  className?: string;
}

/**
 * Atomic component for displaying message timestamps
 * Provides consistent timestamp formatting and styling
 */
export const MessageTimestamp: React.FC<MessageTimestampProps> = ({ 
  timestamp, 
  className 
}) => {
  if (!timestamp) return null;

  const formatTimestamp = (ts: string | Date): string => {
    const date = typeof ts === 'string' ? new Date(ts) : ts;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {formatTimestamp(timestamp)}
    </span>
  );
};