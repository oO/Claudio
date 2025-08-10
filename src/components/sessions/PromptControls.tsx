import React from "react";
import { Send, Square, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export interface PromptControlsProps {
  onSend: () => void;
  onCancel?: () => void;
  onExpand?: () => void;
  canSend: boolean;
  isLoading: boolean;
  disabled?: boolean;
  showExpandButton?: boolean;
  className?: string;
}

/**
 * Control buttons for the prompt input (Send, Stop, Expand)
 */
export const PromptControls: React.FC<PromptControlsProps> = ({
  onSend,
  onCancel,
  onExpand,
  canSend,
  isLoading,
  disabled = false,
  showExpandButton = false,
  className,
}) => {
  return (
    <>
      <DebugLabel label="PromptControls" />
      <div className={cn("relative flex items-center gap-2", className)}>
      {/* Expand Button (only shown in compact mode) */}
      {showExpandButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onExpand}
          disabled={disabled}
          className="h-8 w-8"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
      
      {/* Send/Stop Button */}
      <Button
        onClick={isLoading ? onCancel : onSend}
        disabled={isLoading ? false : (!canSend || disabled)}
        variant={isLoading ? "destructive" : "default"}
        size="default"
        className="min-w-[60px]"
      >
        {isLoading ? (
          <>
            <Square className="h-4 w-4 mr-1" />
            Stop
          </>
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
    </>
  );
};