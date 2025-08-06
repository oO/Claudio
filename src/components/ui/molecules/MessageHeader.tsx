import React from "react";
import { LucideIcon } from "lucide-react";
import { MessageRoleIcon, MessageTimestamp, MessageUsageStats, type MessageRole } from "../atoms";
import { ActionButtonGroup } from "./ActionButtonGroup";
import { cn } from "@/lib/utils";

interface MessageHeaderProps {
  role: MessageRole;
  timestamp?: string | Date;
  usage?: { input_tokens: number; output_tokens: number };
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  actions?: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    variant?: "default" | "ghost" | "destructive";
  }>;
  className?: string;
}

/**
 * Molecule component combining message role icon, metadata, and actions
 * Provides consistent header layout for all message types
 */
export const MessageHeader: React.FC<MessageHeaderProps> = ({ 
  role,
  timestamp,
  usage,
  costUsd,
  durationMs,
  numTurns,
  actions,
  className 
}) => {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <MessageRoleIcon role={role} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageTimestamp timestamp={timestamp} />
          </div>
          {actions && actions.length > 0 && (
            <ActionButtonGroup actions={actions} size="sm" />
          )}
        </div>
        <MessageUsageStats
          usage={usage}
          costUsd={costUsd}
          durationMs={durationMs}
          numTurns={numTurns}
          className="mt-1"
        />
      </div>
    </div>
  );
};