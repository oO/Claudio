import React from "react";
import { Badge } from "@/components/ui/badge";
import { EventIcon } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { HookEvent } from "@/types/hooks";

export interface HookMetadataProps {
  event: HookEvent;
  count?: number;
  label?: string;
  description?: string;
  className?: string;
}

const EVENT_INFO: Record<HookEvent, { label: string; description: string }> = {
  PreToolUse: {
    label: 'Pre Tool Use',
    description: 'Runs before tool calls, can block and provide feedback'
  },
  PostToolUse: {
    label: 'Post Tool Use',
    description: 'Runs after successful tool completion'
  },
  Notification: {
    label: 'Notification',
    description: 'Customizes notifications when Claude needs attention'
  },
  Stop: {
    label: 'Stop',
    description: 'Runs when Claude finishes responding'
  },
  SubagentStop: {
    label: 'Subagent Stop',
    description: 'Runs when a Claude subagent (Task) finishes'
  }
};

export const HookMetadata: React.FC<HookMetadataProps> = ({
  event,
  count,
  label,
  description,
  className
}) => {
  const eventInfo = EVENT_INFO[event];
  const displayLabel = label || eventInfo.label;
  const displayDescription = description || eventInfo.description;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <EventIcon event={event} />
      <span className="hidden sm:inline font-medium">{displayLabel}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="h-5 px-1">
          {count}
        </Badge>
      )}
      {displayDescription && (
        <span className="text-sm text-muted-foreground hidden md:inline">
          - {displayDescription}
        </span>
      )}
    </div>
  );
};