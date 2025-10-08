import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export interface ManagerLoadingStateProps {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Shared loading state component for all managers
 * Provides consistent centered loading spinner
 */
export const ManagerLoadingState: React.FC<ManagerLoadingStateProps> = ({
  className,
}) => {
  return (
    <div className={cn("flex items-center justify-center py-8 relative", className)}>
      <DebugLabel label="ManagerLoadingState" />
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
};
