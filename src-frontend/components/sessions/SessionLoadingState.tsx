import React from "react";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Loading state component for session initialization
 * Shows spinner and loading message while session handle is being set up
 */
export const SessionLoadingState: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center relative">
      <DebugLabel label="SessionLoadingState" />
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    </div>
  );
};