import React from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Thinking mode type definition
 */
export type ThinkingMode = "auto" | "think" | "think_hard" | "think_harder" | "ultrathink";

/**
 * Thinking mode configuration
 */
export type ThinkingModeConfig = {
  id: ThinkingMode;
  name: string;
  description: string;
  level: number; // 0-4 for visual indicator
  phrase?: string; // The phrase to append
};

export const THINKING_MODES: ThinkingModeConfig[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Let Claude decide",
    level: 0
  },
  {
    id: "think",
    name: "Think",
    description: "Basic reasoning",
    level: 1,
    phrase: "think"
  },
  {
    id: "think_hard",
    name: "Think Hard",
    description: "Deeper analysis",
    level: 2,
    phrase: "think hard"
  },
  {
    id: "think_harder",
    name: "Think Harder",
    description: "Extensive reasoning",
    level: 3,
    phrase: "think harder"
  },
  {
    id: "ultrathink",
    name: "Ultrathink",
    description: "Maximum computation",
    level: 4,
    phrase: "ultrathink"
  }
];

/**
 * ThinkingModeIndicator component - Shows visual indicator bars for thinking level
 */
const ThinkingModeIndicator: React.FC<{ level: number }> = ({ level }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 h-3 rounded-full transition-colors",
            i <= level ? "bg-blue-500" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
};

export interface ThinkingModeSelectorProps {
  selectedThinkingMode: ThinkingMode;
  onThinkingModeSelect: (mode: ThinkingMode) => void;
  disabled?: boolean;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Thinking mode selection component with indicator and dropdown
 */
export const ThinkingModeSelector: React.FC<ThinkingModeSelectorProps> = ({
  selectedThinkingMode,
  onThinkingModeSelect,
  disabled = false,
  showTooltip = true,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedMode = THINKING_MODES.find(m => m.id === selectedThinkingMode) || THINKING_MODES[0];

  const triggerButton = (
    <Button
      variant="outline"
      size="default"
      disabled={disabled}
      className={cn("gap-2", className)}
    >
      <Brain className="h-4 w-4" />
      <ThinkingModeIndicator level={selectedMode.level} />
    </Button>
  );

  return (
    <Popover
      trigger={
        showTooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {triggerButton}
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{selectedMode.name}</p>
                <p className="text-xs text-muted-foreground">{selectedMode.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : triggerButton
      }
      content={
        <div className="w-[280px] p-1">
          {THINKING_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                onThinkingModeSelect(mode.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                "hover:bg-accent",
                selectedThinkingMode === mode.id && "bg-accent"
              )}
            >
              <Brain className="h-4 w-4 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm">
                  {mode.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {mode.description}
                </div>
              </div>
              <ThinkingModeIndicator level={mode.level} />
            </button>
          ))}
        </div>
      }
      open={open}
      onOpenChange={setOpen}
      align="start"
      side="top"
    />
  );
};