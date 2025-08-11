import React from "react";
import { Clock, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/ui/atoms";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CodeEditorToolbarProps {
  timeout?: number;
  onTimeoutChange: (timeout?: number) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export const CodeEditorToolbar: React.FC<CodeEditorToolbarProps> = ({
  timeout,
  onTimeoutChange,
  onDelete,
  readOnly = false,
  showTooltip = true,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Timeout Configuration */}
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <Input
          type="number"
          placeholder="60"
          value={timeout || ''}
          onChange={(e) => onTimeoutChange(e.target.value ? parseInt(e.target.value) : undefined)}
          disabled={readOnly}
          className="w-20 h-8"
          min="1"
          max="300"
        />
        <span className="text-sm text-muted-foreground">seconds</span>
        {showTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Maximum execution time for this command (1-300 seconds)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {/* Delete Button */}
      {!readOnly && onDelete && (
        <ActionButton
          variant="ghost"
          size="sm"
          onClick={onDelete}
          icon={Trash2}
          label="Delete command"
          showLabel={false}
          className="text-destructive hover:text-destructive"
        />
      )}
    </div>
  );
};