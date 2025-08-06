import React from "react";
import { Clock, Hash, DollarSign, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgentIcon } from "@/components/ui/atoms/AgentIcon";
import { ExecutionStatusBadge, ExecutionStatus } from "@/components/ui/atoms/ExecutionStatusBadge";
import { formatISOTimestamp } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export interface ExecutionMetadataProps {
  agentName: string;
  agentIcon?: string;
  task: string;
  model: string;
  status: ExecutionStatus;
  createdAt: string;
  duration?: number;
  totalTokens?: number;
  cost?: number;
  orientation?: "horizontal" | "vertical";
  compact?: boolean;
  className?: string;
}

export const ExecutionMetadata: React.FC<ExecutionMetadataProps> = ({
  agentName,
  agentIcon,
  task,
  model,
  status,
  createdAt,
  duration,
  totalTokens,
  cost,
  orientation = "horizontal",
  compact = false,
  className
}) => {
  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTokens = (tokens?: number) => {
    if (!tokens) return "0";
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const containerClasses = cn(
    "flex gap-4",
    orientation === "vertical" ? "flex-col" : "flex-row items-start",
    className
  );

  const headerClasses = cn(
    "flex gap-3",
    orientation === "vertical" ? "flex-col" : "flex-row items-start"
  );

  const metadataClasses = cn(
    "flex gap-3 text-xs text-muted-foreground",
    compact && "gap-2",
    orientation === "vertical" ? "flex-col" : "flex-row flex-wrap items-center"
  );

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5">
            <AgentIcon iconName={agentIcon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                "font-semibold",
                compact ? "text-base" : "text-lg"
              )}>
                {agentName}
              </h3>
              <ExecutionStatusBadge 
                status={status} 
                size={compact ? "sm" : "default"}
                animated={status === "running"}
              />
            </div>
            {!compact && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {task}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={metadataClasses}>
        <Badge variant="outline" className="text-xs">
          {model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
        </Badge>
        
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatISOTimestamp(createdAt)}</span>
        </div>
        
        {duration && (
          <span>{formatDuration(duration)}</span>
        )}
        
        {totalTokens && (
          <div className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            <span>{formatTokens(totalTokens)}</span>
          </div>
        )}
        
        {cost && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>${cost.toFixed(4)}</span>
          </div>
        )}
      </div>

      {compact && task && (
        <p className="text-sm text-muted-foreground truncate">
          {task}
        </p>
      )}
    </div>
  );
};