import React from "react";
import { Clock, CheckCircle, XCircle, AlertCircle, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ExecutionStatus = "running" | "completed" | "failed" | "cancelled" | "idle";

export interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  animated?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const ExecutionStatusBadge: React.FC<ExecutionStatusBadgeProps> = ({
  status,
  animated = true,
  size = "default",
  className
}) => {
  const statusConfig = {
    running: {
      icon: PlayCircle,
      label: "Running",
      variant: "default" as const,
      classes: "bg-green-500/10 text-green-600 border-green-500/50 dark:text-green-400"
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      variant: "secondary" as const,
      classes: "bg-blue-500/10 text-blue-600 border-blue-500/50 dark:text-blue-400"
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      variant: "destructive" as const,
      classes: "bg-destructive/10 text-destructive border-destructive/50"
    },
    cancelled: {
      icon: AlertCircle,
      label: "Cancelled",
      variant: "secondary" as const,
      classes: "bg-yellow-500/10 text-yellow-600 border-yellow-500/50 dark:text-yellow-400"
    },
    idle: {
      icon: Clock,
      label: "Idle",
      variant: "outline" as const,
      classes: "text-muted-foreground"
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    default: "text-xs px-2.5 py-1.5",
    lg: "text-sm px-3 py-2"
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1.5 font-medium border",
        sizeClasses[size],
        config.classes,
        className
      )}
    >
      <Icon className={cn(
        iconSizeClasses[size],
        animated && status === "running" && "animate-spin"
      )} />
      {config.label}
    </Badge>
  );
};