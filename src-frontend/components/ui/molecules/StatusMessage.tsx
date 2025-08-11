import React from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatusMessageProps {
  type: "error" | "success" | "warning" | "info";
  message: string;
  className?: string;
  onDismiss?: () => void;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type,
  message,
  className,
  onDismiss
}) => {
  const typeConfig = {
    error: {
      icon: AlertTriangle,
      classes: "border-destructive/50 bg-destructive/10 text-destructive"
    },
    success: {
      icon: Check,
      classes: "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"
    },
    warning: {
      icon: AlertTriangle,
      classes: "border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
    },
    info: {
      icon: Info,
      classes: "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Card className={cn("p-4", config.classes, className)}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0" />
        <span className="font-medium flex-1">{message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 hover:opacity-70 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  );
};