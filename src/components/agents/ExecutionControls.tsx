import React from "react";
import { Play, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExecutionControlsProps {
  isRunning: boolean;
  isExecuteDisabled: boolean;
  onExecute: () => void;
  onStop: () => void;
  className?: string;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  isExecuteDisabled,
  onExecute,
  onStop,
  className,
}) => {
  return (
    <Button
      onClick={isRunning ? onStop : onExecute}
      disabled={isExecuteDisabled}
      variant={isRunning ? "destructive" : "default"}
      className={className}
    >
      {isRunning ? (
        <>
          <StopCircle className="mr-2 h-4 w-4" />
          Stop
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Execute
        </>
      )}
    </Button>
  );
};