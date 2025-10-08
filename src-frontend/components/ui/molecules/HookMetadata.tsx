import React from "react";
import { Badge } from "@/components/ui/badge";
import { EventIcon } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { HookEvent, HOOK_REGISTRY } from "@/types/hooks";

export interface HookMetadataProps {
  event: HookEvent;
  count?: number;
  label?: string;
  description?: string;
  className?: string;
}

export const HookMetadata: React.FC<HookMetadataProps> = ({
  event,
  count,
  label,
  description,
  className
}) => {
  const eventInfo = HOOK_REGISTRY[event];
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