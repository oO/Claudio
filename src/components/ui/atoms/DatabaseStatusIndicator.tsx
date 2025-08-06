import React from "react";
import { Database, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatabaseStatusIndicatorProps {
  isConnected: boolean;
  isLoading?: boolean;
  className?: string;
}

export const DatabaseStatusIndicator: React.FC<DatabaseStatusIndicatorProps> = ({
  isConnected,
  isLoading = false,
  className
}) => {
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <Database className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Connecting...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2",
      isConnected ? "text-green-600 dark:text-green-400" : "text-destructive",
      className
    )}>
      {isConnected ? (
        <>
          <Check className="h-4 w-4" />
          <span className="text-sm">Database Connected</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Database Error</span>
        </>
      )}
    </div>
  );
};