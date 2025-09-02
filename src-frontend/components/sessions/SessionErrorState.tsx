import React from "react";
import { Button } from "@/components/ui/button";
import { DebugLabel } from "@/components/ui/atoms";

interface SessionErrorStateProps {
  error: string;
  onBack: () => void;
}

/**
 * Error state component for session initialization failures
 * Shows error message with back button to return to sessions list
 */
export const SessionErrorState: React.FC<SessionErrorStateProps> = ({
  error,
  onBack,
}) => {
  return (
    <div className="flex-1 flex items-center justify-center relative">
      <DebugLabel label="SessionErrorState" />
      <div className="text-center">
        <p className="text-red-500 mb-4">Failed to load session</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onBack} variant="outline">
          Back to Sessions
        </Button>
      </div>
    </div>
  );
};